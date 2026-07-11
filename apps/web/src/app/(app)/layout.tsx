import { Sidebar } from "@/components/Sidebar";
import { TaskProvider } from "@/components/TaskProvider";
import { BackgroundTasksPanel } from "@/components/BackgroundTasksPanel";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TaskProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 pb-32 overflow-auto">{children}</main>
        <BackgroundTasksPanel />
      </div>
    </TaskProvider>
  );
}
