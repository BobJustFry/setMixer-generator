import copy
import json
import logging
import random
import struct
import time
import uuid
from pathlib import Path

import requests
from PIL import Image

from config.settings import get_comfyui_settings

log = logging.getLogger("renderer")

POLL_INTERVAL_SEC = 2
POLL_TIMEOUT_SEC = 900
KLEIN_WORKFLOW_PATH = Path(__file__).with_name("comfyui_workflow.json")
FLUX1_WORKFLOW_PATH = Path(__file__).with_name("comfyui_workflow_flux1.json")
FLUX1_IMG2IMG_WORKFLOW_PATH = Path(__file__).with_name("comfyui_workflow_flux1_img2img.json")
KLEIN_IMG2IMG_WORKFLOW_PATH = Path(__file__).with_name("comfyui_workflow_klein_img2img.json")

DEFAULT_MODEL = "flux1-dev-fp8.safetensors"
REFERENCE_DENOISE = 0.58

MODEL_CONFIG: dict[str, dict] = {
    "flux1-dev-fp8.safetensors": {
        "engine": "flux1",
        "steps": 28,
        "cfg": 1.0,
        "guidance": 3.5,
        "label": "Flux 1 Dev",
    },
    "flux-2-klein-base-4b-fp8.safetensors": {
        "engine": "klein",
        "steps": 20,
        "cfg": 4.0,
        "label": "Flux 2 Klein",
    },
    "flux-2-klein-4b-fp8.safetensors": {
        "engine": "klein",
        "steps": 4,
        "cfg": 1.0,
        "label": "Flux 2 Klein",
    },
}

MAX_GEN_LONG_SIDE = 1536

DEFAULT_NEGATIVE_PROMPT = (
    "text, watermark, logo, signature, blurry, low quality, jpeg artifacts, "
    "deformed, ugly, disfigured, poorly drawn, mutation, "
    "bad anatomy, wrong anatomy, anatomical errors, bad proportions, distorted body, "
    "asymmetrical, lopsided, unnatural pose, twisted limbs, "
    "extra limbs, missing limbs, fused limbs, duplicate limbs, extra arms, extra legs, "
    "malformed hands, extra fingers, missing fingers, deformed hands, "
    "extra eyes, missing eyes, distorted face, misaligned facial features, "
    "extra ears, three ears, duplicate ears, missing ears, asymmetrical ears, "
    "crooked ears, malformed ears, merged ears, wrong ear placement, "
    "wrong number of body parts, duplicate body parts, conjoined, chimera deformity, "
    "malformed object, warped geometry, impossible geometry, broken object, "
    "deformed machinery, incorrect mechanism, broken mechanism, melted metal, "
    "wrong number of wheels, floating parts, disconnected parts, misaligned parts, "
    "distorted vehicle, deformed motorcycle, broken phone, malformed headphones, "
    "extra headphone cups, wrong device shape, incorrect equipment, nonsensical apparatus"
)


def _parse_comfyui_error(resp: requests.Response) -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            if data.get("error"):
                err = data["error"]
                if isinstance(err, dict):
                    return str(err.get("message") or err)[:500]
                return str(err)[:500]
            node_errors = data.get("node_errors")
            if node_errors:
                return json.dumps(node_errors, ensure_ascii=False)[:500]
    except json.JSONDecodeError:
        pass
    return (resp.text or f"HTTP {resp.status_code}")[:500]


def _round8(value: int) -> int:
    return max(64, round(value / 8) * 8)


def _gen_dimensions(target_w: int, target_h: int) -> tuple[int, int]:
    aspect = target_w / max(target_h, 1)
    if aspect >= 1:
        gen_w = min(target_w, MAX_GEN_LONG_SIDE)
        gen_h = _round8(gen_w / aspect)
        gen_w = _round8(gen_w)
    else:
        gen_h = min(target_h, MAX_GEN_LONG_SIDE)
        gen_w = _round8(gen_h * aspect)
        gen_h = _round8(gen_h)
    return gen_w, gen_h


def _resolve_model(model_name: str) -> tuple[str, dict]:
    name = (model_name or "").strip() or DEFAULT_MODEL
    if name not in MODEL_CONFIG:
        log.warning("Unknown ComfyUI model %s, using default %s", name, DEFAULT_MODEL)
        name = DEFAULT_MODEL
    return name, MODEL_CONFIG[name]


def _build_klein_workflow(
    wf: dict,
    prompt: str,
    negative_prompt: str,
    gen_w: int,
    gen_h: int,
    model: str,
    sampler: dict,
    seed: int | None,
) -> int:
    wf["1"]["inputs"]["unet_name"] = model
    wf["4"]["inputs"]["width"] = gen_w
    wf["4"]["inputs"]["height"] = gen_h
    wf["5"]["inputs"]["text"] = prompt
    wf["6"]["inputs"]["text"] = negative_prompt
    wf["7"]["inputs"]["steps"] = sampler["steps"]
    wf["7"]["inputs"]["cfg"] = sampler["cfg"]
    used_seed = seed if seed is not None else random.randint(0, 2_147_483_647)
    wf["7"]["inputs"]["seed"] = used_seed
    wf["7"]["inputs"]["control_after_generate"] = "fixed"
    return used_seed


def _build_flux1_img2img_workflow(
    wf: dict,
    prompt: str,
    negative_prompt: str,
    gen_w: int,
    gen_h: int,
    model: str,
    sampler: dict,
    seed: int | None,
    reference_image: str,
    denoise: float,
) -> int:
    wf["4"]["inputs"]["ckpt_name"] = model
    wf["11"]["inputs"]["image"] = reference_image
    wf["12"]["inputs"]["width"] = gen_w
    wf["12"]["inputs"]["height"] = gen_h
    wf["6"]["inputs"]["text"] = prompt
    wf["7"]["inputs"]["text"] = negative_prompt
    wf["10"]["inputs"]["guidance"] = sampler.get("guidance", 3.5)
    wf["3"]["inputs"]["steps"] = sampler["steps"]
    wf["3"]["inputs"]["cfg"] = sampler["cfg"]
    wf["3"]["inputs"]["denoise"] = denoise
    used_seed = seed if seed is not None else random.randint(0, 2_147_483_647)
    wf["3"]["inputs"]["seed"] = used_seed
    wf["3"]["inputs"]["control_after_generate"] = "fixed"
    return used_seed


def _build_klein_img2img_workflow(
    wf: dict,
    prompt: str,
    negative_prompt: str,
    gen_w: int,
    gen_h: int,
    model: str,
    sampler: dict,
    seed: int | None,
    reference_image: str,
    denoise: float,
) -> int:
    wf["1"]["inputs"]["unet_name"] = model
    wf["11"]["inputs"]["image"] = reference_image
    wf["12"]["inputs"]["width"] = gen_w
    wf["12"]["inputs"]["height"] = gen_h
    wf["5"]["inputs"]["text"] = prompt
    wf["6"]["inputs"]["text"] = negative_prompt
    wf["7"]["inputs"]["steps"] = sampler["steps"]
    wf["7"]["inputs"]["cfg"] = sampler["cfg"]
    wf["7"]["inputs"]["denoise"] = denoise
    used_seed = seed if seed is not None else random.randint(0, 2_147_483_647)
    wf["7"]["inputs"]["seed"] = used_seed
    wf["7"]["inputs"]["control_after_generate"] = "fixed"
    return used_seed


def _build_flux1_workflow(
    wf: dict,
    prompt: str,
    negative_prompt: str,
    gen_w: int,
    gen_h: int,
    model: str,
    sampler: dict,
    seed: int | None,
) -> int:
    wf["4"]["inputs"]["ckpt_name"] = model
    wf["5"]["inputs"]["width"] = gen_w
    wf["5"]["inputs"]["height"] = gen_h
    wf["6"]["inputs"]["text"] = prompt
    wf["7"]["inputs"]["text"] = negative_prompt
    wf["10"]["inputs"]["guidance"] = sampler.get("guidance", 3.5)
    wf["3"]["inputs"]["steps"] = sampler["steps"]
    wf["3"]["inputs"]["cfg"] = sampler["cfg"]
    used_seed = seed if seed is not None else random.randint(0, 2_147_483_647)
    wf["3"]["inputs"]["seed"] = used_seed
    wf["3"]["inputs"]["control_after_generate"] = "fixed"
    return used_seed


def _build_workflow(
    prompt: str,
    negative_prompt: str,
    target_w: int,
    target_h: int,
    model_name: str,
    seed: int | None = None,
    reference_image: str | None = None,
) -> tuple[dict, int, int, int, str]:
    model, config = _resolve_model(model_name)
    gen_w, gen_h = _gen_dimensions(target_w, target_h)
    engine = config["engine"]
    use_img2img = bool(reference_image)

    if engine == "flux1":
        if use_img2img:
            wf = copy.deepcopy(json.loads(FLUX1_IMG2IMG_WORKFLOW_PATH.read_text(encoding="utf-8")))
            used_seed = _build_flux1_img2img_workflow(
                wf,
                prompt,
                negative_prompt,
                gen_w,
                gen_h,
                model,
                config,
                seed,
                reference_image,
                REFERENCE_DENOISE,
            )
        else:
            wf = copy.deepcopy(json.loads(FLUX1_WORKFLOW_PATH.read_text(encoding="utf-8")))
            used_seed = _build_flux1_workflow(wf, prompt, negative_prompt, gen_w, gen_h, model, config, seed)
    else:
        if use_img2img:
            wf = copy.deepcopy(json.loads(KLEIN_IMG2IMG_WORKFLOW_PATH.read_text(encoding="utf-8")))
            used_seed = _build_klein_img2img_workflow(
                wf,
                prompt,
                negative_prompt,
                gen_w,
                gen_h,
                model,
                config,
                seed,
                reference_image,
                REFERENCE_DENOISE,
            )
        else:
            wf = copy.deepcopy(json.loads(KLEIN_WORKFLOW_PATH.read_text(encoding="utf-8")))
            used_seed = _build_klein_workflow(wf, prompt, negative_prompt, gen_w, gen_h, model, config, seed)

    return wf, used_seed, gen_w, gen_h, config.get("label", "ComfyUI")


def _history_completed(entry: dict) -> bool:
    status = entry.get("status") or {}
    return bool(status.get("completed")) and status.get("status_str") == "success"


def _min_expected_png_bytes(width: int, height: int) -> int:
    pixels = max(width * height, 1)
    return max(50_000, pixels // 20)


def _validate_png_file(path: str, width: int, height: int) -> str | None:
    try:
        data = Path(path).read_bytes()
    except OSError as e:
        return f"Не удалось прочитать файл: {e}"
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return "ComfyUI вернул не PNG"
    img_w, img_h = struct.unpack(">II", data[16:24])
    if img_w != width or img_h != height:
        return f"Размер изображения {img_w}×{img_h}, ожидалось {width}×{height}"
    if len(data) < _min_expected_png_bytes(width, height):
        return "ComfyUI вернул пустое или повреждённое изображение"
    return None


def _extract_image_from_history(history_entry: dict) -> dict | None:
    outputs = history_entry.get("outputs") or {}
    for node_output in outputs.values():
        images = node_output.get("images") or []
        if images:
            return images[0]
    return None


def _upscale_image(source_path: str, target_w: int, target_h: int) -> None:
    with Image.open(source_path) as img:
        if img.size == (target_w, target_h):
            return
        resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        resized.save(source_path, format="PNG", optimize=True)


def _upload_image(base_url: str, local_path: str) -> tuple[str | None, str | None]:
    path = Path(local_path)
    if not path.is_file():
        return None, "Файл референса не найден"

    upload_name = f"setmixer_ref_{uuid.uuid4().hex[:12]}{path.suffix.lower() or '.png'}"
    mime = "image/png" if upload_name.endswith(".png") else "image/jpeg"

    try:
        with path.open("rb") as handle:
            resp = requests.post(
                f"{base_url}/upload/image",
                files={"image": (upload_name, handle, mime)},
                data={"overwrite": "true"},
                timeout=120,
            )
    except requests.RequestException as e:
        return None, f"Не удалось загрузить референс в ComfyUI: {e}"

    if resp.status_code != 200:
        return None, _parse_comfyui_error(resp)

    try:
        data = resp.json()
    except json.JSONDecodeError:
        return None, "ComfyUI вернул некорректный ответ при загрузке референса"

    name = data.get("name")
    if not name:
        return None, "ComfyUI не вернул имя загруженного референса"
    return name, None


def generate_ai_background(
    prompt: str,
    output_path: str,
    width: int = 1920,
    height: int = 1080,
    seed: int | None = None,
    negative_prompt: str | None = None,
    reference_path: str | None = None,
    progress_callback=None,
    cancel_check=None,
) -> tuple[bool, str | None, int | None]:
    """Generate background via local ComfyUI. Returns (success, error, seed)."""
    settings = get_comfyui_settings()
    base_url = (settings.get("comfyui_url") or "").rstrip("/")
    model_name = (settings.get("comfyui_checkpoint") or "").strip()

    if not base_url:
        return False, "ComfyUI не настроен — укажите URL в Настройках", None

    neg = (negative_prompt or "").strip() or DEFAULT_NEGATIVE_PROMPT

    reference_comfy_name = None
    if reference_path and Path(reference_path).is_file():
        if progress_callback:
            progress_callback(8, "Загрузка референса в ComfyUI…")
        reference_comfy_name, upload_err = _upload_image(base_url, reference_path)
        if upload_err:
            return False, upload_err, None

    workflow, used_seed, gen_w, gen_h, model_label = _build_workflow(
        prompt, neg, width, height, model_name, seed, reference_comfy_name
    )
    mode_label = "img2img" if reference_comfy_name else "txt2img"
    log.info(
        "ComfyUI generate (%s): model=%s seed=%s size=%dx%d (gen %dx%d)",
        mode_label,
        model_label,
        used_seed,
        width,
        height,
        gen_w,
        gen_h,
    )

    if progress_callback:
        detail = f"Отправка в ComfyUI ({model_label}, {mode_label})..."
        progress_callback(5, detail)

    client_id = str(uuid.uuid4())

    try:
        resp = requests.post(
            f"{base_url}/prompt",
            json={"prompt": workflow, "client_id": client_id},
            timeout=120,
        )
    except requests.RequestException as e:
        return False, f"ComfyUI недоступен: {e}", None

    if resp.status_code != 200:
        err = _parse_comfyui_error(resp)
        log.error("ComfyUI prompt failed (%s): %s", resp.status_code, err)
        return False, err, None

    data = resp.json()
    if data.get("error"):
        return False, _parse_comfyui_error(resp), None

    prompt_id = data.get("prompt_id")
    if not prompt_id:
        return False, "ComfyUI не вернул prompt_id", None

    started = time.time()
    while time.time() - started < POLL_TIMEOUT_SEC:
        if cancel_check and cancel_check():
            raise RuntimeError("Отменено пользователем")

        try:
            hist_resp = requests.get(f"{base_url}/history/{prompt_id}", timeout=30)
        except requests.RequestException:
            time.sleep(POLL_INTERVAL_SEC)
            continue

        if hist_resp.status_code == 200:
            history = hist_resp.json()
            if prompt_id in history:
                entry = history[prompt_id]
                status = entry.get("status", {})
                if status.get("status_str") == "error":
                    messages = status.get("messages") or []
                    err = json.dumps(messages, ensure_ascii=False)[:500]
                    return False, err or "ComfyUI: ошибка генерации", None
                if _history_completed(entry):
                    image_meta = _extract_image_from_history(entry)
                    if image_meta:
                        ok, err = _download_image(
                            base_url,
                            image_meta,
                            output_path,
                            gen_w,
                            gen_h,
                            width,
                            height,
                            progress_callback,
                        )
                        return ok, err, used_seed if ok else None
                    return False, "ComfyUI завершил работу без изображения", None

        elapsed = int(time.time() - started)
        if progress_callback:
            pct = min(90, 10 + elapsed)
            progress_callback(pct, f"Генерация {model_label} ({mode_label})… {elapsed}с")
        time.sleep(POLL_INTERVAL_SEC)

    return False, "Таймаут генерации ComfyUI (15 мин)", None


def _download_image(
    base_url: str,
    image_meta: dict,
    output_path: str,
    gen_w: int,
    gen_h: int,
    target_w: int,
    target_h: int,
    progress_callback,
) -> tuple[bool, str | None]:
    filename = image_meta.get("filename")
    if not filename:
        return False, "ComfyUI не вернул имя файла"

    subfolder = image_meta.get("subfolder") or ""
    img_type = image_meta.get("type") or "output"
    params = {"filename": filename, "subfolder": subfolder, "type": img_type}

    if progress_callback:
        progress_callback(92, "Скачивание обложки...")

    try:
        img_resp = requests.get(f"{base_url}/view", params=params, timeout=120)
    except requests.RequestException as e:
        return False, f"Не удалось скачать изображение: {e}"

    if img_resp.status_code != 200:
        return False, f"Не удалось скачать изображение: HTTP {img_resp.status_code}"

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(img_resp.content)

    validation_err = _validate_png_file(output_path, gen_w, gen_h)
    if validation_err:
        log.error("ComfyUI output invalid: %s (%s)", validation_err, output_path)
        try:
            out.unlink(missing_ok=True)
        except OSError:
            pass
        return False, validation_err

    if (gen_w, gen_h) != (target_w, target_h):
        if progress_callback:
            progress_callback(97, f"Масштабирование до {target_w}×{target_h}...")
        try:
            _upscale_image(output_path, target_w, target_h)
        except OSError as e:
            return False, f"Не удалось масштабировать изображение: {e}"

    if progress_callback:
        progress_callback(100, "Обложка готова")
    return True, None
