SELECT j.id, j.status, j.progress, m.filename
FROM "VideoJob" j
JOIN "Mix" m ON j."mixId" = m.id
ORDER BY j."createdAt" DESC
LIMIT 5;

SELECT id, type, status, progress, title, "videoJobId"
FROM "BackgroundTask"
WHERE status IN ('pending', 'running')
ORDER BY "createdAt" DESC;
