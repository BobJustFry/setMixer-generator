import { NextResponse } from "next/server";
import { clearFinishedTasks } from "@/lib/tasks";

export async function POST() {
  const deleted = await clearFinishedTasks();
  return NextResponse.json({ deleted });
}
