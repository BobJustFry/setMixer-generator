UPDATE "AppSettings"
SET "comfyuiCheckpoint" = 'flux1-dev-fp8.safetensors',
    "comfyuiConnected" = false,
    "comfyuiLastError" = null
WHERE id = 'default';
