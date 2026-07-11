"""Draw cover title text after ComfyUI — adaptive color, upper safe zone (above waveform)."""

from __future__ import annotations

import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat

log = logging.getLogger("renderer")

# Keep in sync with renderer.waveform_video layout constants.
WF_HEIGHT = 280
WF_BOTTOM_MARGIN = 48
MARGIN_X = 56
TEXT_PAD_ABOVE_WF = 48


def _text_safe_zone(width: int, height: int) -> tuple[int, int, int, int]:
    """Return (left, top, right, bottom) — region safe from waveform overlay."""
    scale = height / 1080
    wf_height = max(int(WF_HEIGHT * scale), 120)
    wf_bottom = max(int(WF_BOTTOM_MARGIN * scale), 24)
    wf_y = height - wf_height - wf_bottom
    pad = max(int(TEXT_PAD_ABOVE_WF * scale), 20)
    top = max(int(height * 0.05), 20)
    side = max(int(MARGIN_X * scale), 28)
    bottom = max(top + 40, wf_y - pad)
    return side, top, width - side, bottom


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    log.warning("Cover text: no TTF font found, using default bitmap font")
    return ImageFont.load_default()


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = [c / 255.0 for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast_ratio(l1: float, l2: float) -> float:
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def _pick_text_colors(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[tuple[int, ...], tuple[int, ...]]:
    """Choose fill + shadow colors from local background luminance."""
    region = img.crop(box).convert("RGB")
    stat = ImageStat.Stat(region)
    mean = tuple(int(v) for v in stat.mean[:3])
    bg_lum = _relative_luminance(mean)  # type: ignore[arg-type]

    light_fill = (255, 244, 232)
    light_shadow = (0, 0, 0, 190)
    dark_fill = (24, 22, 20)
    dark_shadow = (255, 255, 255, 170)

    light_contrast = _contrast_ratio(bg_lum, _relative_luminance(light_fill))
    dark_contrast = _contrast_ratio(bg_lum, _relative_luminance(dark_fill))

    if dark_contrast >= light_contrast:
        return dark_fill + (255,), dark_shadow
    return light_fill + (255,), light_shadow


def _wrap_paragraph(paragraph: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont, max_width: int) -> list[str]:
    words = paragraph.split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        bbox = font.getbbox(trial)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _wrap_lines(text: str, font: ImageFont.FreeTypeFont | ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.replace("\r", "").split("\n"):
        paragraph = paragraph.strip()
        if paragraph:
            lines.extend(_wrap_paragraph(paragraph, font, max_width))
    return lines


def _line_metrics(font: ImageFont.FreeTypeFont | ImageFont.ImageFont, line: str) -> tuple[int, int]:
    bbox = font.getbbox(line or "Ay")
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def apply_cover_text(image_path: str, text: str, width: int, height: int) -> None:
    """Burn title text into cover PNG — upper area only, contrast-aware colors."""
    text = text.strip()
    if not text:
        return

    left, top, right, bottom = _text_safe_zone(width, height)
    max_text_w = right - left
    if max_text_w < 80:
        log.warning("Cover text: safe zone too narrow, skipping")
        return

    font_size = max(28, min(88, width // 16))
    font = _load_font(font_size)

    lines = _wrap_lines(text, font, max_text_w)
    if not lines:
        return

    while len(lines) > 3 and font_size > 24:
        font_size -= 4
        font = _load_font(font_size)
        lines = _wrap_lines(text, font, max_text_w)

    line_heights = [_line_metrics(font, line)[1] for line in lines]
    line_widths = [_line_metrics(font, line)[0] for line in lines]
    line_gap = max(6, font_size // 8)
    block_h = sum(line_heights) + line_gap * (len(lines) - 1)

    safe_h = bottom - top
    if block_h > safe_h:
        font_size = max(22, font_size - 8)
        font = _load_font(font_size)
        lines = _wrap_lines(text, font, max_text_w)
        line_heights = [_line_metrics(font, line)[1] for line in lines]
        line_widths = [_line_metrics(font, line)[0] for line in lines]
        block_h = sum(line_heights) + line_gap * (len(lines) - 1)

    # Upper portion of safe zone — keeps text well above waveform.
    upper_anchor = top + int(safe_h * 0.38)
    y = max(top, min(upper_anchor - block_h // 2, bottom - block_h))

    with Image.open(image_path) as base:
        img = base.convert("RGBA")
        sample_box = (
            left,
            max(top, y - 8),
            right,
            min(height, y + block_h + 8),
        )
        fill, shadow = _pick_text_colors(img, sample_box)
        draw = ImageDraw.Draw(img)

        shadow_offset = max(2, font_size // 22)
        cursor_y = y
        for i, line in enumerate(lines):
            lw = line_widths[i]
            x = left + (max_text_w - lw) // 2
            draw.text((x + shadow_offset, cursor_y + shadow_offset), line, font=font, fill=shadow)
            draw.text((x, cursor_y), line, font=font, fill=fill)
            cursor_y += line_heights[i] + line_gap

        img.convert("RGB").save(image_path, format="PNG", optimize=True)

    log.info("Cover text applied (%d lines, font %dpx)", len(lines), font_size)
