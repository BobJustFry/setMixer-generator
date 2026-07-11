FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup --no-create-home appuser

COPY . .

USER appuser

CMD ["python", "main.py"]
