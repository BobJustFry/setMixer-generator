import os
import logging
import subprocess
import tempfile
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter

log = logging.getLogger("images")

REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
REPLICATE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5f1eb78e7727f2b71e9b3e3b9b3e3b9b3e3b9"


def generate_segment_thumbs(
    segments: list[dict],
    output_dir: str,
    default_prompt: str,
) -> list[str]:
    paths = []
    for i, seg in enumerate(segments):
        out_path = str(Path(output_dir) / f"segment_{i:03d}.png")
        prompt = seg.get("thumbPrompt") or default_prompt or "abstract music visual"
        try:
            if REPLICATE_API_TOKEN:
                _generate_ai_image(prompt, out_path)
            else:
                _generate_placeholder(prompt, out_path, i)
        except Exception as e:
            log.warning("AI image failed for segment %d: %s", i, e)
            _generate_placeholder(prompt, out_path, i)
        paths.append(out_path)
    return paths


def _generate_ai_image(prompt: str, output_path: str):
    headers = {
        "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
        "Content-Type": "application/json",
        "Prefer": "wait",
    }
    payload = {
        "version": "7762fd07cf82c948538e41f63f77d685ad9711d80b8e179b0a1a6a0739b5c48",
        "input": {
            "prompt": f"{prompt}, cinematic, 16:9 aspect ratio, high quality, no text",
            "width": 1920,
            "height": 1080,
            "num_outputs": 1,
        },
    }
    resp = requests.post(
        "https://api.replicate.com/v1/predictions",
        headers=headers,
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "succeeded":
        for _ in range(60):
            import time
            time.sleep(2)
            poll = requests.get(
                f"https://api.replicate.com/v1/predictions/{data['id']}",
                headers=headers,
                timeout=30,
            )
            poll.raise_for_status()
            data = poll.json()
            if data.get("status") == "succeeded":
                break
            if data.get("status") == "failed":
                raise RuntimeError(data.get("error", "AI generation failed"))

    image_url = data["output"][0] if isinstance(data["output"], list) else data["output"]
    img_data = requests.get(image_url, timeout=60).content
    with open(output_path, "wb") as f:
        f.write(img_data)


def _generate_placeholder(prompt: str, output_path: str, index: int):
    """Fallback gradient image when AI is not configured."""
    colors = [
        (30, 28, 35),
        (35, 30, 28),
        (28, 32, 35),
        (32, 28, 30),
        (28, 35, 32),
    ]
    bg = colors[index % len(colors)]
    accent = (196, 165, 116)

    img = Image.new("RGB", (1920, 1080), bg)
    draw = ImageDraw.Draw(img)

    for y in range(1080):
        ratio = y / 1080
        r = int(bg[0] + (accent[0] - bg[0]) * ratio * 0.3)
        g = int(bg[1] + (accent[1] - bg[1]) * ratio * 0.3)
        b = int(bg[2] + (accent[2] - bg[2]) * ratio * 0.3)
        draw.line([(0, y), (1920, y)], fill=(r, g, b))

    draw.ellipse([760, 340, 1160, 740], outline=accent, width=3)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    img.save(output_path, "PNG")
