import subprocess
from typing import Callable


def _parse_out_time_sec(line: str) -> float | None:
    if not line.startswith("out_time="):
        return None
    raw = line.split("=", 1)[1].strip()
    if raw == "N/A":
        return None
    if ":" in raw:
        parts = raw.split(":")
        try:
            if len(parts) == 3:
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + float(s)
            if len(parts) == 2:
                m, s = parts
                return int(m) * 60 + float(s)
        except ValueError:
            return None
    try:
        return float(raw) / 1_000_000
    except ValueError:
        return None


def _parse_out_time_us(line: str) -> int | None:
    if line.startswith("out_time_us="):
        try:
            return int(line.split("=", 1)[1].strip())
        except ValueError:
            return None
    if line.startswith("out_time_ms="):
        # FFmpeg reports microseconds in out_time_ms (misleading name)
        try:
            return int(line.split("=", 1)[1].strip())
        except ValueError:
            return None
    sec = _parse_out_time_sec(line)
    if sec is not None:
        return int(sec * 1_000_000)
    return None


def format_time(sec: float) -> str:
    sec = max(0, int(sec))
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def run_ffmpeg_with_progress(
    cmd: list[str],
    duration_sec: float,
    on_tick: Callable[[int, str], None],
    cancel_check: Callable[[], bool] | None = None,
    detail_prefix: str = "",
) -> None:
    """Run ffmpeg, invoke on_tick(stage_pct 0-100, detail) from decode/encode progress."""
    full_cmd = [*cmd, "-progress", "pipe:1", "-nostats"]
    proc = subprocess.Popen(
        full_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )

    stderr_lines: list[str] = []

    last_pct = -1
    duration_us = max(duration_sec * 1_000_000, 1)

    try:
        while True:
            if cancel_check and cancel_check():
                proc.terminate()
                proc.wait(timeout=10)
                raise RuntimeError("Отменено пользователем")

            line = proc.stdout.readline() if proc.stdout else ""
            if not line and proc.poll() is not None:
                break

            us = _parse_out_time_us(line.strip())
            if us is None:
                continue

            frac = min(us / duration_us, 1.0)
            pct = min(100, int(frac * 100))
            cur_sec = us / 1_000_000
            detail = f"{detail_prefix}{format_time(cur_sec)} / {format_time(duration_sec)}"
            on_tick(pct, detail)
            if pct > last_pct:
                last_pct = pct

        if proc.stderr:
            stderr_lines = proc.stderr.read().splitlines()

        proc.wait()
        if proc.returncode != 0:
            tail = "\n".join(stderr_lines[-8:]).strip()
            msg = "FFmpeg завершился с ошибкой"
            if tail:
                msg = f"{msg}: {tail[-400:]}"
            raise RuntimeError(msg)
    finally:
        if proc.poll() is None:
            proc.terminate()
