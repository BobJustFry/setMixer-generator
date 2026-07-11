WEIGHT_WAVEFORM = 10

WEIGHT_RENDER_PREP = 2

WEIGHT_RENDER_ENCODE = 88



STAGE_LABELS = {

    "waveform": "Построение waveform",

    "ai_cover": "Генерация AI-обложки",

    "render_prep": "Подготовка фона",

    "render_encode": "Кодирование видео",

}





def stage_label(stage: str | None) -> str:

    if not stage:

        return ""

    return STAGE_LABELS.get(stage, stage)





def overall_progress(stage: str, stage_progress: int) -> int:

    stage_progress = max(0, min(100, stage_progress))

    if stage == "waveform":

        return int(WEIGHT_WAVEFORM * stage_progress / 100)

    if stage == "render_prep":

        return WEIGHT_WAVEFORM + int(WEIGHT_RENDER_PREP * stage_progress / 100)

    if stage == "render_encode":

        base = WEIGHT_WAVEFORM + WEIGHT_RENDER_PREP

        return base + int(WEIGHT_RENDER_ENCODE * stage_progress / 100)

    return 0

