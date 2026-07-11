"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "ghost";
}

export function LoadingButton({
  loading,
  loadingText,
  variant = "primary",
  children,
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "secondary"
        ? "btn-secondary"
        : "btn-ghost";

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(variantClass, loading && "animate-pulse-subtle", className)}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading ? loadingText || children : children}
    </button>
  );
}

export function useAsyncAction() {
  const [loading, setLoading] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }

  return { loading, run };
}
