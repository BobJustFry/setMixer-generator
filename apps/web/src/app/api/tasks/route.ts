import { NextResponse } from "next/server";
import { getActiveTasks, getRecentTasks } from "@/lib/tasks";

export async function GET() {
  const [active, recent] = await Promise.all([
    getActiveTasks(),
    getRecentTasks(8),
  ]);
  return NextResponse.json({ active, recent });
}
