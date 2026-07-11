import os

import hashlib

import psycopg2

import psycopg2.extras

from cryptography.hazmat.primitives.ciphers.aead import AESGCM



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





def get_app_settings() -> dict:

    with _get_db() as conn:

        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            cur.execute('SELECT * FROM "AppSettings" WHERE id = %s', ("default",))

            row = cur.fetchone()

    if not row:

        return {

            "encryption_key": os.environ.get("ENCRYPTION_KEY", "default-32-byte-key-change-me!!!!"),

            "youtube_client_id": os.environ.get("YOUTUBE_CLIENT_ID", ""),

            "youtube_client_secret": os.environ.get("YOUTUBE_CLIENT_SECRET", ""),

            "comfyui_url": os.environ.get("COMFYUI_URL", "http://host.docker.internal:8000"),

            "comfyui_checkpoint": os.environ.get("COMFYUI_CHECKPOINT", ""),

            "app_url": os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

        }



    key = row["encryptionKey"]

    return {

        "encryption_key": key,

        "youtube_client_id": row.get("youtubeClientId") or "",

        "youtube_client_secret": (

            _decrypt(row["youtubeClientSecret"], key) if row.get("youtubeClientSecret") else ""

        ),

        "comfyui_url": row.get("comfyuiUrl") or "http://host.docker.internal:8000",

        "comfyui_checkpoint": row.get("comfyuiCheckpoint") or "",

        "app_url": row.get("appUrl") or "http://localhost:3000",

    }





def get_comfyui_settings() -> dict:

    s = get_app_settings()

    return {

        "comfyui_url": s.get("comfyui_url", ""),

        "comfyui_checkpoint": s.get("comfyui_checkpoint", ""),

    }





def get_youtube_oauth() -> tuple[str, str, str]:

    s = get_app_settings()

    return s["youtube_client_id"], s["youtube_client_secret"], s["encryption_key"]


