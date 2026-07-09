import { cn, statusColor, statusLabel } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-overlay border border-surface-border",
        statusColor(status)
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
