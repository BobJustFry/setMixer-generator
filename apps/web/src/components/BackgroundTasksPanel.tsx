"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { useTasks, type BackgroundTask } from "./TaskProvider";
import { cn, statusLabel } from "@/lib/utils";
import { JobProgressDisplay } from "./JobProgressDisplay";

function scanFileLabel(task: BackgroundTask): string | null {
  const match = task.title.match(/\((\d+)\s*файл/i);
  if (!match) return null;
  const total = Number(match[1]);
  const done = Math.min(total, Math.max(0, Math.round((task.progress / 90) * total)));
  return `${done}/${total}`;
}

function taskTypeLabel(type: string): string {
  const map: Record<string, string> = {
    scan_mixes: "Сканирование",
    analyze: "Анализ",
    render: "Рендер",
    youtube_upload: "YouTube",
  };
  return map[type] || type;
}

function TaskRow({
  task,
  onCancel,
  onDelete,
}: {
  task: BackgroundTask;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = ["pending", "running"].includes(task.status);
  const canCancel = isActive && !task.cancelRequested;
  const canDelete = !isActive;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-overlay/50 border border-surface-border/50 animate-fade-in">
      <div className="shrink-0 w-5">
        {task.status === "running" || task.status === "pending" ? (
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
        ) : task.status === "completed" ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : task.status === "cancelled" ? (
          <Ban className="w-4 h-4 text-warm-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-warm-500">{taskTypeLabel(task.type)}</span>
          {task.cancelRequested && isActive && (
            <span className="text-xs text-amber-400">отмена...</span>
          )}
        </div>
        <p className="text-sm text-warm-100 truncate">{task.title}</p>
        {isActive && task.status === "pending" && (
          <p className="text-xs text-warm-500 mt-0.5 truncate">Ожидание worker...</p>
        )}
        {isActive && task.status === "running" && (
          <div className="mt-2">
            <JobProgressDisplay
              compact
              state={{
                progress: task.progress,
                stage: task.stage,
                stageProgress: task.stageProgress,
                stageDetail: task.stageDetail,
                status: task.status,
              }}
            />
          </div>
        )}
        {!isActive && task.errorMessage && (
          <p className="text-xs text-red-400 mt-1 truncate">{task.errorMessage}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isActive && (
          <span className="text-xs text-accent font-mono w-14 text-right shrink-0">
            {scanFileLabel(task) ?? `${task.progress}%`}
          </span>
        )}
        {!isActive && (
          <span className="text-xs text-warm-500">{statusLabel(task.status)}</span>
        )}
        {task.videoJobId && (
          <Link
            href={`/jobs/${task.videoJobId}`}
            className="text-xs text-warm-400 hover:text-accent"
          >
            →
          </Link>
        )}
        {canCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="p-1 rounded hover:bg-red-500/20 text-warm-500 hover:text-red-400 transition-colors"
            title="Прервать"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded hover:bg-red-500/20 text-warm-500 hover:text-red-400 transition-colors"
            title="Удалить из списка"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function BackgroundTasksPanel() {
  const { active, recent, cancelTask, deleteTask, clearFinished, hasActive } = useTasks();
  const [expanded, setExpanded] = useState(true);
  const [clearing, setClearing] = useState(false);

  const displayTasks = [
    ...active,
    ...recent.filter((r) => !active.some((a) => a.id === r.id)),
  ].slice(0, 6);

  const hasFinished = displayTasks.some(
    (t) => !["pending", "running"].includes(t.status)
  );

  async function handleClear() {
    setClearing(true);
    await clearFinished();
    setClearing(false);
  }

  if (displayTasks.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-56 right-0 z-40 border-t border-surface-border bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.3)] transition-all duration-300",
        hasActive && "border-accent/20"
      )}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between text-xs text-warm-400 hover:text-warm-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            {hasActive && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
            Фоновые задачи
            {hasActive && (
              <span className="text-accent">({active.length} активных)</span>
            )}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {hasFinished && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="ml-3 text-xs text-warm-500 hover:text-warm-200 transition-colors disabled:opacity-50"
            title="Удалить завершённые и отменённые"
          >
            {clearing ? "..." : "Очистить"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
          {displayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onCancel={cancelTask}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
