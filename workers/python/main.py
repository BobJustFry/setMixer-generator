import os
import json
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import redis
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from worker.parallel import configure_cpu_threads, worker_count, normalize_database_url
from worker.progress import overall_progress

configure_cpu_threads()

from analyzer import waveform as audio_waveform
from renderer.images import generate_ai_background
from renderer.cover_text import apply_cover_text
from renderer.waveform_video import render_waveform_video, parse_encode_settings
from youtube.uploader import upload_to_youtube
from worker.tasks import (
    update_task,
    start_task,
    complete_task,
    fail_task,
    cancel_task,
    is_cancelled,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

QUEUE_KEY = "setmixer:job_queue"
DATA_DIR = os.environ.get("DATA_DIR", "/data")


def get_db():
    return psycopg2.connect(normalize_database_url())


def get_redis():
    return redis.from_url(
        os.environ.get("REDIS_URL", "redis://localhost:6379"),
        socket_timeout=None,
        socket_connect_timeout=10,
        retry_on_timeout=True,
        health_check_interval=30,
    )


def update_job(job_id: str, **fields):
    if not fields:
        return
    sets = ", ".join(f'"{k}" = %s' for k in fields)
    vals = list(fields.values()) + [job_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE "VideoJob" SET {sets}, "updatedAt" = NOW() WHERE id = %s', vals)
        conn.commit()


def update_mix(mix_id: str, **fields):
    if not fields:
        return
    sets = ", ".join(f'"{k}" = %s' for k in fields)
    vals = list(fields.values()) + [mix_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE "Mix" SET {sets}, "updatedAt" = NOW() WHERE id = %s', vals)
        conn.commit()


def get_job(job_id: str) -> dict | None:
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                '''SELECT j.*, m.filepath, m."durationSec" as mix_duration,
                          m."waveformPath" as mix_waveform,
                          b."imagePath" as background_path,
                          b."fitMode" as background_fit_mode
                   FROM "VideoJob" j
                   JOIN "Mix" m ON j."mixId" = m.id
                   LEFT JOIN "MixBackground" b ON j."backgroundId" = b.id
                   WHERE j.id = %s''',
                (job_id,),
            )
            return cur.fetchone()


def get_mix_background(bg_id: str) -> dict | None:
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT * FROM "MixBackground" WHERE id = %s', (bg_id,))
            return cur.fetchone()


def update_mix_background(bg_id: str, **fields):
    if not fields:
        return
    sets = ", ".join(f'"{k}" = %s' for k in fields)
    vals = list(fields.values()) + [bg_id]
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE "MixBackground" SET {sets} WHERE id = %s', vals)
        conn.commit()


def _check_cancel(task_id: str | None, video_job_id: str | None = None) -> bool:
    if is_cancelled(task_id, video_job_id):
        if video_job_id:
            update_job(video_job_id, status="failed", errorMessage="Отменено пользователем")
        cancel_task(task_id)
        return True
    return False


def _scan_one_file(f: Path, task_id: str | None) -> str:
    """Scan duration for one file. Returns: skipped | ok | missing | error."""
    if is_cancelled(task_id):
        return "cancelled"

    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                'SELECT id, "durationSec" FROM "Mix" WHERE filepath = %s',
                (str(f),),
            )
            row = cur.fetchone()

    if not row:
        return "missing"
    if row.get("durationSec"):
        return "skipped"

    try:
        duration = audio_waveform.get_duration(str(f))
        update_mix(row["id"], durationSec=duration, scanStatus="ready")
        return "ok"
    except Exception as e:
        log.warning("Duration scan failed for %s: %s", f, e)
        return "error"


def handle_scan_mixes(task_id: str | None):
    if _check_cancel(task_id):
        return

    start_task(task_id)
    mixes_dir = Path(DATA_DIR) / "mixes"
    if not mixes_dir.exists():
        complete_task(task_id)
        return

    files = [
        f for f in mixes_dir.iterdir()
        if f.suffix.lower() in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
    ]
    total = max(len(files), 1)
    threads = worker_count()
    done = 0
    done_lock = threading.Lock()
    log.info("Scanning %d files with %d threads", len(files), threads)
    update_task(task_id, progress=2)

    with ThreadPoolExecutor(max_workers=threads) as pool:
        futures = {pool.submit(_scan_one_file, f, task_id): f for f in files}
        for future in as_completed(futures):
            if _check_cancel(task_id):
                pool.shutdown(wait=False, cancel_futures=True)
                return

            result = future.result()
            fpath = futures[future]
            with done_lock:
                done += 1
                pct = int((done / total) * 90)
                update_task(task_id, progress=max(pct, 3))
                if done % 5 == 0 or done == total:
                    log.info("Scan progress %d/%d (%s -> %s)", done, total, fpath.name, result)

    if not is_cancelled(task_id):
        complete_task(task_id)


def _make_sync_stage(task_id: str | None, video_job_id: str):
    last = {"t": 0.0, "key": ""}

    def sync_stage(stage: str, stage_progress: int, stage_detail: str):
        key = f"{stage}|{stage_progress}|{stage_detail}"
        now = time.time()
        if key == last["key"] and now - last["t"] < 0.35:
            return
        last["key"] = key
        last["t"] = now
        overall = overall_progress(stage, stage_progress)
        fields = {
            "progress": overall,
            "stage": stage,
            "stageProgress": stage_progress,
            "stageDetail": stage_detail[:500],
        }
        update_task(task_id, **fields)
        update_job(video_job_id, **fields)

    return sync_stage


def handle_analyze(video_job_id: str, task_id: str | None):
    job = get_job(video_job_id)
    if not job:
        fail_task(task_id, "Задача не найдена")
        return
    if _check_cancel(task_id, video_job_id):
        return

    sync_stage = _make_sync_stage(task_id, video_job_id)

    start_task(task_id)
    if _check_cancel(task_id, video_job_id):
        return

    update_job(
        video_job_id,
        status="analyzing",
        progress=0,
        errorMessage=None,
        stage="waveform",
        stageProgress=0,
        stageDetail="Подготовка...",
    )
    try:
        mix_id = job["mixId"]
        waveforms_dir = Path(DATA_DIR) / "waveforms"
        waveforms_dir.mkdir(parents=True, exist_ok=True)
        waveform_path = str(waveforms_dir / f"{mix_id}.png")
        Path(waveform_path).unlink(missing_ok=True)

        def on_wave_progress(pct: int, detail: str):
            sync_stage("waveform", pct, detail)

        log.info("Generating Denon 3-band waveform for mix %s", mix_id)
        duration = audio_waveform.generate_waveform(
            job["filepath"],
            waveform_path,
            progress_callback=on_wave_progress,
            cancel_check=lambda: is_cancelled(task_id, video_job_id),
        )
        update_mix(mix_id, durationSec=duration, scanStatus="ready", waveformPath=waveform_path)

        if _check_cancel(task_id, video_job_id):
            return

        _render_waveform_job(
            job,
            video_job_id,
            task_id,
            waveform_path,
            duration,
            sync_stage,
        )
    except InterruptedError:
        _check_cancel(task_id, video_job_id)
    except Exception as e:
        log.exception("Video creation failed")
        if is_cancelled(task_id, video_job_id):
            _check_cancel(task_id, video_job_id)
            return
        update_job(video_job_id, status="failed", errorMessage=str(e))
        fail_task(task_id, str(e))


def _render_waveform_job(
    job: dict,
    video_job_id: str,
    task_id: str | None,
    waveform_path: str,
    duration: float,
    sync_stage,
):
    if _check_cancel(task_id, video_job_id):
        return

    template = job.get("template") or "waveform_dark"
    encode = parse_encode_settings(job.get("encodeSettings"))
    prebuilt_bg = None

    if template == "waveform_image":
        prebuilt_bg = job.get("background_path")
        if not prebuilt_bg:
            update_job(video_job_id, status="failed", errorMessage="Файл обложки не найден")
            fail_task(task_id, "Обложка не найдена")
            return

    update_job(
        video_job_id,
        status="rendering",
        cancelRequested=False,
        stage="render_prep",
        stageProgress=0,
        stageDetail="Подготовка фона...",
    )
    if task_id:
        update_task(task_id, status="running")

    output_dir = Path(DATA_DIR) / "renders"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{video_job_id}.mp4")

    def on_prep(pct: int, detail: str):
        sync_stage("render_prep", pct, detail)

    def on_encode(pct: int, detail: str):
        sync_stage("render_encode", pct, detail)

    out_duration, log_text = render_waveform_video(
        audio_path=job["filepath"],
        waveform_path=waveform_path,
        output_path=output_path,
        duration=duration,
        template=template if template != "waveform_image" else "waveform_dark",
        encode_settings=encode,
        prebuilt_bg_path=prebuilt_bg,
        bg_fit_mode=job.get("background_fit_mode") or "cover",
        on_prep_progress=on_prep,
        on_encode_progress=on_encode,
        cancel_check=lambda: is_cancelled(task_id, video_job_id),
    )

    if is_cancelled(task_id, video_job_id):
        _check_cancel(task_id, video_job_id)
        return

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "GeneratedVideo" WHERE "videoJobId" = %s', (video_job_id,))
            cur.execute(
                '''INSERT INTO "GeneratedVideo"
                   (id, "videoJobId", "outputPath", "durationSec", "ffmpegLog")
                   VALUES (gen_random_uuid()::text, %s, %s, %s, %s)''',
                (video_job_id, output_path, out_duration, log_text),
            )
        conn.commit()

    update_job(video_job_id, status="ready", progress=100, stageProgress=100, stageDetail="Готово")
    complete_task(task_id)
    log.info("Video ready: %s", output_path)


def handle_render(video_job_id: str, task_id: str | None):
    job = get_job(video_job_id)
    if not job:
        fail_task(task_id, "Задача не найдена")
        return

    waveform_path = job.get("mix_waveform")
    duration = job.get("mix_duration")
    if not waveform_path or not duration:
        update_job(video_job_id, status="failed", errorMessage="Нет waveform — запустите анализ заново")
        fail_task(task_id, "Нет waveform")
        return

    if _check_cancel(task_id, video_job_id):
        return

    start_task(task_id)
    sync_stage = _make_sync_stage(task_id, video_job_id)

    try:
        _render_waveform_job(
            job,
            video_job_id,
            task_id,
            waveform_path,
            duration,
            sync_stage,
        )
    except Exception as e:
        if "отмен" in str(e).lower() or is_cancelled(task_id, video_job_id):
            _check_cancel(task_id, video_job_id)
            return
        log.exception("Render failed")
        update_job(video_job_id, status="failed", errorMessage=str(e))
        fail_task(task_id, str(e))


def handle_generate_background(mix_background_id: str, task_id: str | None):
    bg = get_mix_background(mix_background_id)
    if not bg:
        fail_task(task_id, "Обложка не найдена")
        return
    if _check_cancel(task_id):
        return

    if task_id:
        update_task(
            task_id,
            status="running",
            progress=0,
            stage="ai_cover",
            stageProgress=0,
            stageDetail="Запуск генерации...",
        )

    backgrounds_dir = Path(DATA_DIR) / "backgrounds"
    backgrounds_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(backgrounds_dir / f"{mix_background_id}.png")
    prompt = (bg.get("prompt") or "").strip() or (
        "dark vinyl record aesthetic, warm amber club lighting, abstract bokeh, no text"
    )

    def on_progress(pct: int, detail: str):
        update_task(
            task_id,
            progress=pct,
            stage="ai_cover",
            stageProgress=pct,
            stageDetail=detail[:500],
        )

    try:
        requested_seed = bg.get("seed")
        if requested_seed is not None:
            requested_seed = int(requested_seed)

        ok, err_msg, used_seed = generate_ai_background(
            prompt,
            output_path,
            int(bg.get("width") or 1920),
            int(bg.get("height") or 1080),
            seed=requested_seed,
            negative_prompt=bg.get("negativePrompt"),
            reference_path=bg.get("referenceImagePath"),
            progress_callback=on_progress,
            cancel_check=lambda: is_cancelled(task_id),
        )
        if is_cancelled(task_id):
            cancel_task(task_id)
            update_mix_background(mix_background_id, status="failed", errorMessage="Отменено")
            return
        if not ok:
            error = err_msg or "ComfyUI не вернул изображение"
            update_mix_background(mix_background_id, status="failed", errorMessage=error[:500])
            fail_task(task_id, error[:500])
            return

        cover_text = (bg.get("coverText") or "").strip()
        if cover_text:
            on_progress(92, "Нанесение надписи на обложку…")
            try:
                apply_cover_text(
                    output_path,
                    cover_text,
                    int(bg.get("width") or 1920),
                    int(bg.get("height") or 1080),
                )
            except Exception as e:
                log.exception("Cover text overlay failed")
                update_mix_background(
                    mix_background_id,
                    status="failed",
                    errorMessage=f"Надпись на обложке: {e}"[:500],
                )
                fail_task(task_id, str(e)[:500])
                return

        update_mix_background(
            mix_background_id,
            status="ready",
            imagePath=output_path,
            errorMessage=None,
            seed=used_seed,
        )
        complete_task(task_id)
        log.info("Background ready: %s", output_path)
    except Exception as e:
        log.exception("Background generation failed")
        update_mix_background(mix_background_id, status="failed", errorMessage=str(e)[:500])
        if is_cancelled(task_id):
            cancel_task(task_id)
        else:
            fail_task(task_id, str(e))


def handle_youtube_upload(video_job_id: str, upload_id: str | None, task_id: str | None):
    if _check_cancel(task_id, video_job_id):
        return
    start_task(task_id)
    try:
        def on_progress(pct):
            update_task(task_id, progress=pct)

        upload_to_youtube(video_job_id, upload_id, progress_callback=on_progress, cancel_check=lambda: is_cancelled(task_id, video_job_id))
        if is_cancelled(task_id, video_job_id):
            _check_cancel(task_id, video_job_id)
            return
        complete_task(task_id)
    except Exception as e:
        log.exception("YouTube upload failed")
        if upload_id:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "YouTubeUpload" SET "uploadStatus" = %s, "errorMessage" = %s, "updatedAt" = NOW() WHERE id = %s',
                        ("failed", str(e), upload_id),
                    )
                conn.commit()
        if is_cancelled(task_id, video_job_id):
            cancel_task(task_id)
        else:
            fail_task(task_id, str(e))


def process_job(payload: dict):
    job_type = payload.get("type")
    task_id = payload.get("taskId")
    video_job_id = payload.get("videoJobId")
    log.info("Processing job: %s (task=%s)", job_type, task_id)

    if is_cancelled(task_id, video_job_id):
        log.info("Skipping cancelled job: %s", task_id)
        if video_job_id:
            update_job(
                video_job_id,
                status="failed",
                errorMessage="Отменено пользователем",
            )
        cancel_task(task_id)
        return

    if job_type == "scan_mixes":
        handle_scan_mixes(task_id)
    elif job_type == "analyze":
        handle_analyze(payload["videoJobId"], task_id)
    elif job_type == "render":
        handle_render(payload["videoJobId"], task_id)
    elif job_type == "generate_background":
        handle_generate_background(payload["mixBackgroundId"], task_id)
    elif job_type == "youtube_upload":
        handle_youtube_upload(payload.get("videoJobId"), payload.get("uploadId"), task_id)
    else:
        log.warning("Unknown job type: %s", job_type)
        fail_task(task_id, f"Unknown job type: {job_type}")


def main():
    r = get_redis()
    threads = worker_count()
    log.info("Worker started, listening on queue: %s (%d CPU threads)", QUEUE_KEY, threads)

    while True:
        try:
            result = r.brpop(QUEUE_KEY, timeout=5)
            if not result:
                continue

            raw = result[1].decode() if isinstance(result[1], bytes) else result[1]
            payload = json.loads(raw)

            try:
                process_job(payload)
            except Exception:
                log.exception("Job failed")
                fail_task(payload.get("taskId"), "Внутренняя ошибка worker")

        except redis.ConnectionError:
            log.warning("Redis connection lost, retrying...")
            time.sleep(3)
            r = get_redis()
        except redis.TimeoutError:
            log.warning("Redis socket timeout, reconnecting...")
            time.sleep(1)
            r = get_redis()
        except Exception:
            log.exception("Worker loop error")
            time.sleep(1)


if __name__ == "__main__":
    main()
