"use client";

import { Loader2 } from "lucide-react";
import { stageLabel } from "@/lib/utils";

export interface ProgressState {
  progress: number;
  stage?: string | null;
  stageProgress?: number;
  stageDetail?: string | null;
  status?: string;
}

interface JobProgressDisplayProps {
  state: ProgressState;
  compact?: boolean;
}

export function JobProgressDisplay({ state, compact }: JobProgressDisplayProps) {
  const isDone = state.status === "completed" || state.status === "ready";
  const overall = isDone ? (state.progress ?? 0) : Math.min(state.progress ?? 0, 99);
  const stagePct = state.stageProgress ?? 0;
  const stageName = stageLabel(state.stage);
  const detail = state.stageDetail || stageName || "Выполняется...";
  const isPending = state.status === "pending";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-warm-400 ${compact ? "text-xs" : "text-sm"}`}>
            {isPending ? "Ожидание worker..." : "Общий прогресс"}
          </span>
          <span className={`text-accent font-mono shrink-0 ${compact ? "text-xs" : "text-sm"}`}>
            {overall}%
          </span>
        </div>
        <div className={`bg-surface-overlay rounded-full overflow-hidden ${compact ? "h-1" : "h-1.5"}`}>
          <div
            className="h-full bg-accent/80 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(overall, isPending ? 2 : 0)}%` }}
          />
        </div>
      </div>

      {!isPending && state.stage && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-warm-300 truncate ${compact ? "text-xs" : "text-sm"}`}>
              {stageName}
            </span>
            <span className={`text-warm-500 font-mono shrink-0 ${compact ? "text-xs" : "text-sm"}`}>
              {stagePct}%
            </span>
          </div>
          <div className={`bg-surface-border/60 rounded-full overflow-hidden ${compact ? "h-1" : "h-1"}`}>
            <div
              className="h-full bg-warm-400/70 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${stagePct}%` }}
            />
          </div>
          <p className={`text-warm-500 mt-1 truncate ${compact ? "text-xs" : "text-xs"}`}>
            {detail}
          </p>
        </div>
      )}

      {!compact && !isPending && (
        <p className="text-xs text-warm-600">
          Длинные миксы кодируются долго — не отменяйте задачу.
        </p>
      )}
    </div>
  );
}

export function JobProgressSpinner({ state }: { state: ProgressState }) {
  return (
    <div className="flex items-start gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <JobProgressDisplay state={state} />
      </div>
    </div>
  );
}
