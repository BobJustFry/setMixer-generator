import os
import json
import logging
from datetime import datetime, timezone

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

    body: dict = {
        "snippet": {
            "title": upload["title"],
            "description": upload["description"],
            "tags": upload["tags"] or [],
            "categoryId": upload["categoryId"] or "10",
        },
        "status": {
            "privacyStatus": upload["privacyStatus"] or "private",
            "selfDeclaredMadeForKids": False,
        },
    }

    if upload.get("publishAt"):
        pub = upload["publishAt"]
        if isinstance(pub, datetime):
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            body["status"]["publishAt"] = pub.strftime("%Y-%m-%dT%H:%M:%S.000Z")

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
