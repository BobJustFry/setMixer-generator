import os


def worker_count() -> int:
    """Half of logical CPUs, at least 1."""
    cpus = os.cpu_count() or 2
    return max(1, cpus // 2)


def configure_cpu_threads() -> int:
    """Limit BLAS / numpy thread pools before heavy imports."""
    n = str(worker_count())
    for var in (
        "OMP_NUM_THREADS",
        "OPENBLAS_NUM_THREADS",
        "MKL_NUM_THREADS",
        "NUMEXPR_NUM_THREADS",
    ):
        os.environ.setdefault(var, n)
    return int(n)


def normalize_database_url(url: str | None = None) -> str:
    """psycopg2 rejects Prisma's ?schema= query param."""
    raw = url or os.environ["DATABASE_URL"]
    if "?" not in raw:
        return raw
    base, query = raw.split("?", 1)
    params = [p for p in query.split("&") if not p.startswith("schema=")]
    return f"{base}?{'&'.join(params)}" if params else base
