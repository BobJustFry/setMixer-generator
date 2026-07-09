import numpy as np
import librosa


def get_duration(filepath: str) -> float:
    duration = librosa.get_duration(path=filepath)
    return float(duration)


def detect_segments(
    filepath: str,
    min_segment_sec: float = 60,
    max_segments: int = 30,
) -> list[dict]:
    """Detect track change points in a DJ mix using multi-signal analysis."""
    y, sr = librosa.load(filepath, sr=22050, mono=True)
    duration = len(y) / sr

    if duration < min_segment_sec * 2:
        return [{"startSec": 0, "endSec": duration, "confidence": 1.0, "label": "Track 1"}]

    hop = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=hop, backtrack=True
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop)

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    chroma_diff = np.sum(np.abs(np.diff(chroma, axis=1)), axis=0)
    chroma_peaks = _find_peaks(chroma_diff, sr / hop, min_distance_sec=30)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)
    mfcc_diff = np.sum(np.abs(np.diff(mfcc, axis=1)), axis=0)
    mfcc_peaks = _find_peaks(mfcc_diff, sr / hop, min_distance_sec=30)

    all_peaks = np.concatenate([onset_times, chroma_peaks, mfcc_peaks])
    all_peaks = all_peaks[(all_peaks > min_segment_sec) & (all_peaks < duration - min_segment_sec)]

    if len(all_peaks) == 0:
        n_segments = min(max_segments, max(1, int(duration / 300)))
        boundaries = np.linspace(0, duration, n_segments + 1)
    else:
        boundaries = _cluster_peaks(all_peaks, min_segment_sec, duration, max_segments)

    segments = []
    for i in range(len(boundaries) - 1):
        start = float(boundaries[i])
        end = float(boundaries[i + 1])
        if end - start < min_segment_sec * 0.5:
            continue
        segments.append({
            "startSec": start,
            "endSec": end,
            "confidence": 0.6,
            "label": f"Track {len(segments) + 1}",
        })

    if not segments:
        segments = [{"startSec": 0, "endSec": duration, "confidence": 1.0, "label": "Track 1"}]

    return segments


def _find_peaks(signal: np.ndarray, frame_rate: float, min_distance_sec: float = 30) -> np.ndarray:
    if len(signal) == 0:
        return np.array([])
    threshold = np.percentile(signal, 85)
    peaks = []
    min_frames = int(min_distance_sec * frame_rate)
    for i in range(1, len(signal) - 1):
        if signal[i] > threshold and signal[i] > signal[i - 1] and signal[i] > signal[i + 1]:
            if not peaks or (i - peaks[-1]) >= min_frames:
                peaks.append(i)
    return np.array(peaks) / frame_rate


def _cluster_peaks(
    peaks: np.ndarray,
    min_segment_sec: float,
    duration: float,
    max_segments: int,
) -> np.ndarray:
    peaks = np.sort(peaks)
    merged = [0.0]

    for peak in peaks:
        if peak - merged[-1] >= min_segment_sec:
            merged.append(float(peak))

    merged.append(duration)

    while len(merged) - 1 > max_segments:
        min_gap_idx = 1
        min_gap = merged[1] - merged[0]
        for i in range(2, len(merged)):
            gap = merged[i] - merged[i - 1]
            if gap < min_gap:
                min_gap = gap
                min_gap_idx = i
        merged.pop(min_gap_idx)

    return np.array(merged)
