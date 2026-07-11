import psycopg2
import psycopg2.extras


def update_task(task_id: str | None, **fields):
    if not task_id or not fields:
        return
    sets = ", ".join(f'"{k}" = %s' for k in fields)
    vals = list(fields.values()) + [task_id]
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f'UPDATE "BackgroundTask" SET {sets}, "updatedAt" = NOW() WHERE id = %s',
                vals,
            )
        conn.commit()


def start_task(task_id: str | None):
    if task_id:
        update_task(
            task_id,
            status="running",
            progress=0,
            stage="waveform",
            stageProgress=0,
            stageDetail="Запуск...",
        )


def complete_task(task_id: str | None, progress: int = 100):
    if task_id:
        update_task(
            task_id,
            status="completed",
            progress=progress,
            stageProgress=100,
            stageDetail="Готово",
            errorMessage=None,
        )


def fail_task(task_id: str | None, error: str):
    if task_id:
        update_task(task_id, status="failed", errorMessage=error[:500])


def cancel_task(task_id: str | None, error: str = "Отменено пользователем"):
    if task_id:
        update_task(task_id, status="cancelled", errorMessage=error)


def is_cancelled(task_id: str | None = None, video_job_id: str | None = None) -> bool:
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if task_id:
                cur.execute(
                    'SELECT "cancelRequested", status FROM "BackgroundTask" WHERE id = %s',
                    (task_id,),
                )
                row = cur.fetchone()
                if row and (row["cancelRequested"] or row["status"] == "cancelled"):
                    return True
            if video_job_id:
                cur.execute(
                    'SELECT "cancelRequested" FROM "VideoJob" WHERE id = %s',
                    (video_job_id,),
                )
                row = cur.fetchone()
                if row and row["cancelRequested"]:
                    return True
    return False


def _conn():
    import os
    from worker.parallel import normalize_database_url

    return psycopg2.connect(normalize_database_url(os.environ.get("DATABASE_URL")))
