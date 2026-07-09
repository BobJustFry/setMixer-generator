import os
import json
import time
import logging
from pathlib import Path

import redis
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from analyzer.segments import analyze_audio
from renderer.video import render_video
from renderer.images import generate_segment_thumbs
from youtube.uploader import upload_to_youtube

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

QUEUE_KEY = "setmixer:job_queue"
DATA_DIR = os.environ.get("DATA_DIR", "/data")


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_redis():
    return redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))


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
                '''SELECT j.*, m.filepath, m."durationSec" as mix_duration
                   FROM "VideoJob" j JOIN "Mix" m ON j."mixId" = m.id
                   WHERE j.id = %s''',
                (job_id,),
            )
            return cur.fetchone()


def save_segments(job_id: str, segments: list[dict]):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "Segment" WHERE "videoJobId" = %s', (job_id,))
            for i, seg in enumerate(segments):
                cur.execute(
                    '''INSERT INTO "Segment"
                       (id, "videoJobId", "index", "startSec", "endSec", confidence, label, "thumbPrompt", source)
                       VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s)''',
                    (
                        job_id,
                        i,
                        seg["startSec"],
                        seg["endSec"],
                        seg.get("confidence", 0.5),
                        seg.get("label", f"Track {i + 1}"),
                        seg.get("thumbPrompt"),
                        "auto",
                    ),
                )
        conn.commit()


def get_segments(job_id: str) -> list[dict]:
    with get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                'SELECT * FROM "Segment" WHERE "videoJobId" = %s ORDER BY "index"',
                (job_id,),
            )
            return cur.fetchall()


def handle_scan_mixes():
    mixes_dir = Path(DATA_DIR) / "mixes"
    if not mixes_dir.exists():
        return
    for f in mixes_dir.iterdir():
        if f.suffix.lower() not in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}:
            continue
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute('SELECT id FROM "Mix" WHERE filepath = %s', (str(f),))
                row = cur.fetchone()
                if row:
                    try:
                        duration = analyze_audio.get_duration(str(f))
                        update_mix(row["id"], durationSec=duration, scanStatus="ready")
                    except Exception as e:
                        log.warning("Duration scan failed for %s: %s", f, e)


def handle_analyze(video_job_id: str):
    job = get_job(video_job_id)
    if not job:
        return
    update_job(video_job_id, status="analyzing", progress=5, errorMessage=None)
    try:
        duration = analyze_audio.get_duration(job["filepath"])
        update_mix(job["mixId"], durationSec=duration, scanStatus="ready")

        segments = analyze_audio.detect_segments(
            job["filepath"],
            min_segment_sec=60,
            max_segments=30,
        )
        style = job.get("stylePrompt") or "abstract cinematic music visual, muted colors"
        for seg in segments:
            seg["thumbPrompt"] = style

        save_segments(video_job_id, segments)
        update_job(video_job_id, status="ready_for_review", progress=100)
        log.info("Analysis done for job %s: %d segments", video_job_id, len(segments))
    except Exception as e:
        log.exception("Analysis failed")
        update_job(video_job_id, status="failed", errorMessage=str(e))


def handle_render(video_job_id: str):
    job = get_job(video_job_id)
    if not job:
        return
    segments = get_segments(video_job_id)
    if not segments:
        update_job(video_job_id, status="failed", errorMessage="No segments")
        return

    update_job(video_job_id, status="rendering", progress=10, errorMessage=None)
    try:
        thumbs_dir = Path(DATA_DIR) / "thumbs" / video_job_id
        thumbs_dir.mkdir(parents=True, exist_ok=True)

        update_job(video_job_id, progress=20)
        thumb_paths = generate_segment_thumbs(segments, str(thumbs_dir), job.get("stylePrompt", ""))

        for seg, thumb in zip(segments, thumb_paths):
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "Segment" SET "thumbPath" = %s WHERE id = %s',
                        (thumb, seg["id"]),
                    )
                conn.commit()

        update_job(video_job_id, progress=40)
        output_dir = Path(DATA_DIR) / "renders"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / f"{video_job_id}.mp4")

        duration, log_text = render_video(
            audio_path=job["filepath"],
            segments=segments,
            thumb_paths=thumb_paths,
            output_path=output_path,
            template=job.get("template", "kenburns_fade"),
            progress_callback=lambda p: update_job(video_job_id, progress=40 + int(p * 0.55)),
        )

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM "GeneratedVideo" WHERE "videoJobId" = %s', (video_job_id,))
                cur.execute(
                    '''INSERT INTO "GeneratedVideo"
                       (id, "videoJobId", "outputPath", "durationSec", "ffmpegLog")
                       VALUES (gen_random_uuid()::text, %s, %s, %s, %s)''',
                    (video_job_id, output_path, duration, log_text),
                )
            conn.commit()

        update_job(video_job_id, status="ready", progress=100)
        log.info("Render done: %s", output_path)
    except Exception as e:
        log.exception("Render failed")
        update_job(video_job_id, status="failed", errorMessage=str(e))


def handle_youtube_upload(video_job_id: str, upload_id: str | None):
    try:
        upload_to_youtube(video_job_id, upload_id)
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


def process_job(payload: dict):
    job_type = payload.get("type")
    log.info("Processing job: %s", job_type)

    if job_type == "scan_mixes":
        handle_scan_mixes()
    elif job_type == "analyze":
        handle_analyze(payload["videoJobId"])
    elif job_type == "render":
        handle_render(payload["videoJobId"])
    elif job_type == "youtube_upload":
        handle_youtube_upload(payload.get("videoJobId"), payload.get("uploadId"))
    else:
        log.warning("Unknown job type: %s", job_type)


def main():
    r = get_redis()
    log.info("Worker started, listening on queue: %s", QUEUE_KEY)

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

        except redis.ConnectionError:
            log.warning("Redis connection lost, retrying...")
            time.sleep(3)
        except Exception:
            log.exception("Worker loop error")
            time.sleep(1)


if __name__ == "__main__":
    main()
