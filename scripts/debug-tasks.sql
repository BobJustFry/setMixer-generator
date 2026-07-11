SELECT id, type, status, progress, title, "updatedAt"
FROM "BackgroundTask"
ORDER BY "createdAt" DESC
LIMIT 5;

SELECT COUNT(*) AS total,
       COUNT("durationSec") AS with_duration
FROM "Mix";

SELECT filepath, "durationSec", "scanStatus"
FROM "Mix"
LIMIT 3;
