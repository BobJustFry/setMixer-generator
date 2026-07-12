import os
import json
import logging
from datetime import datetime, timezone, timedelta

import psycopg2
import psycopg2.extras
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import hashlib

log = logging.getLogger("youtube")

from config.settings import get_youtube_oauth
from worker.parallel import normalize_database_url


def _get_db():
    return psycopg2.connect(normalize_database_url())


def _decrypt(encrypted: str, encryption_key: str) -> str:
    key = hashlib.sha256(encryption_key.encode()).digest()
    iv_hex, tag_hex, data = encrypted.split(":")
    iv = bytes.fromhex(iv_hex)
    tag = bytes.fromhex(tag_hex)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(iv, bytes.fromhex(data) + tag, None).decode()


def _get_youtube_service():
    client_id, client_secret, encryption_key = get_youtube_oauth()
    if not client_id or not client_secret:
        raise RuntimeError("YouTube OAuth не настроен в интерфейсе настроек")

    with _get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT "encryptedRefreshToken", "channelId", "channelTitle" FROM "YouTubeCredential" WHERE id = %s', ("default",))
            row = cur.fetchone()
    if not row:
        raise RuntimeError("YouTube not connected")

    channel_id = row.get("channelId")
    channel_title = row.get("channelTitle")
    if channel_id:
        log.info("Upload target channel: %s (%s)", channel_title or channel_id, channel_id)

    creds = Credentials(
        token=None,
        refresh_token=_decrypt(row["encryptedRefreshToken"], encryption_key),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
    )
    return build("youtube", "v3", credentials=creds)


MIN_PUBLISH_LEAD = timedelta(minutes=15)


def _normalize_publish_at(pub) -> datetime:
    if isinstance(pub, str):
        pub = datetime.fromisoformat(pub.replace("Z", "+00:00"))
    if not isinstance(pub, datetime):
        raise RuntimeError("Некорректная дата публикации")
    if pub.tzinfo is None:
        pub = pub.replace(tzinfo=timezone.utc)
    return pub.astimezone(timezone.utc)


def _format_publish_at(pub) -> str:
    pub_utc = _normalize_publish_at(pub)
    now = datetime.now(timezone.utc)
    if pub_utc < now + MIN_PUBLISH_LEAD:
        mins = int(MIN_PUBLISH_LEAD.total_seconds() // 60)
        raise RuntimeError(
            f"Дата публикации слишком ранняя ({pub_utc.strftime('%Y-%m-%d %H:%M UTC')}). "
            f"YouTube требует минимум {mins} минут от текущего момента — выберите более позднее время."
        )
    return pub_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def upload_to_youtube(video_job_id: str, upload_id: str | None, progress_callback=None, cancel_check=None):
    with _get_db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                '''SELECT u.*, g."outputPath"
                   FROM "YouTubeUpload" u
                   JOIN "GeneratedVideo" g ON g."videoJobId" = u."videoJobId"
                   WHERE u."videoJobId" = %s''',
                (video_job_id,),
            )
            upload = cur.fetchone()

    if not upload:
        raise RuntimeError("Upload record not found")

    upload_id = upload_id or upload["id"]
    video_path = upload["outputPath"]

    with _get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "YouTubeUpload" SET "uploadStatus" = %s, "updatedAt" = NOW() WHERE id = %s',
                ("uploading", upload_id),
            )
        conn.commit()

    youtube = _get_youtube_service()

    has_schedule = bool(upload.get("publishAt"))
    privacy = "private" if has_schedule else (upload["privacyStatus"] or "private")

    body: dict = {
        "snippet": {
            "title": upload["title"],
            "description": upload["description"],
            "tags": upload["tags"] or [],
            "categoryId": upload["categoryId"] or "10",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    if has_schedule:
        body["status"]["publishAt"] = _format_publish_at(upload["publishAt"])
        log.info("Scheduled publish at %s (privacy=private)", body["status"]["publishAt"])

    media = MediaFileUpload(video_path, mimetype="video/mp4", resumable=True, chunksize=10 * 1024 * 1024)

    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        if cancel_check and cancel_check():
            raise RuntimeError("Отменено пользователем")
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            log.info("Upload progress: %d%%", pct)
            if progress_callback:
                progress_callback(pct)

    youtube_id = response["id"]
    final_status = "scheduled" if upload.get("publishAt") else "published"

    playlist_id = upload.get("playlistId")
    if playlist_id:
        try:
            youtube.playlistItems().insert(
                part="snippet",
                body={
                    "snippet": {
                        "playlistId": playlist_id,
                        "resourceId": {
                            "kind": "youtube#video",
                            "videoId": youtube_id,
                        },
                    }
                },
            ).execute()
            log.info("Added to playlist %s: %s", playlist_id, youtube_id)
        except Exception as e:
            log.exception("Failed to add video to playlist")
            raise RuntimeError(
                f"Видео загружено ({youtube_id}), но не добавлено в плейлист: {e}"
            ) from e

    with _get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE "YouTubeUpload"
                   SET "uploadStatus" = %s, "youtubeVideoId" = %s,
                       "uploadedAt" = NOW(), "errorMessage" = NULL, "updatedAt" = NOW()
                   WHERE id = %s''',
                (final_status, youtube_id, upload_id),
            )
        conn.commit()

    log.info("Uploaded to YouTube: %s", youtube_id)
