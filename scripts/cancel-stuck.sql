UPDATE "BackgroundTask"
SET status = 'cancelled',
    "errorMessage" = 'Cancelled by user',
    "updatedAt" = NOW()
WHERE status IN ('pending', 'running');

UPDATE "VideoJob"
SET status = 'failed',
    "errorMessage" = 'Cancelled by user',
    "cancelRequested" = true,
    "updatedAt" = NOW()
WHERE status IN ('pending', 'analyzing', 'rendering');
