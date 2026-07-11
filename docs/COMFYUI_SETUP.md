# ComfyUI — локальная генерация AI-обложек

Настройка в приложении: **Настройки** → **ComfyUI** → **(i)**.

## Быстрый старт

1. Запустите **ComfyUI Desktop** (у вас обычно `http://127.0.0.1:8000` в браузере).
2. Checkpoint SDXL: `sd_xl_base_1.0.safetensors` в `P:\ComfyUI\models\checkpoints\`
3. В SetMixer укажите:
   - **URL:** `http://host.docker.internal:8000` (не `127.0.0.1` — worker в Docker)
   - **Checkpoint:** `sd_xl_base_1.0.safetensors`
4. **Сохранить и проверить**

## Шаблон workflow

Встроен SDXL txt2img (1920×1080 или 1280×720). Worker подставляет prompt, размер и checkpoint автоматически.

## Сеть

Worker в Docker обращается к ComfyUI на хосте через `host.docker.internal:8000`. Проброс портов наружу не нужен.
