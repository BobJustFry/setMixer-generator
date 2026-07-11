"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface BackgroundTask {
  id: string;
  type: string;
  title: string;
  status: string;
  progress: number;
  videoJobId: string | null;
  mixBackgroundId: string | null;
  uploadId: string | null;
  cancelRequested: boolean;
  stage: string | null;
  stageProgress: number;
  stageDetail: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskContextValue {
  active: BackgroundTask[];
  recent: BackgroundTask[];
  refresh: () => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  hasActive: boolean;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<BackgroundTask[]>([]);
  const [recent, setRecent] = useState<BackgroundTask[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = await res.json();
      setActive(data.active || []);
      setRecent(data.recent || []);
    } catch {
      /* ignore */
    }
  }, []);

  const cancelTask = useCallback(
    async (id: string) => {
      await fetch(`/api/tasks/${id}/cancel`, { method: "POST" });
      await refresh();
    },
    [refresh]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  const clearFinished = useCallback(async () => {
    await fetch("/api/tasks/clear", { method: "POST" });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <TaskContext.Provider
      value={{
        active,
        recent,
        refresh,
        cancelTask,
        deleteTask,
        clearFinished,
        hasActive: active.length > 0,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks must be used within TaskProvider");
  return ctx;
}
