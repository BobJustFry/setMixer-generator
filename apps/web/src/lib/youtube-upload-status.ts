export interface YoutubeUploadRef {
  uploadStatus: string;
  youtubeVideoId: string | null;
}

/** Video can be selected for a new / retry YouTube upload. */
export function canScheduleYoutubeUpload(
  upload: YoutubeUploadRef | null | undefined,
  hasActiveYoutubeTask = false
): boolean {
  if (hasActiveYoutubeTask) return false;
  if (!upload) return true;
  if (upload.youtubeVideoId) return false;
  if (upload.uploadStatus === "uploading") return false;
  return true;
}

export function canRetryYoutubeUpload(
  upload: YoutubeUploadRef,
  hasActiveYoutubeTask = false
): boolean {
  if (upload.youtubeVideoId || hasActiveYoutubeTask) return false;
  if (upload.uploadStatus === "uploading") return false;
  return upload.uploadStatus === "failed" || upload.uploadStatus === "scheduled";
}
