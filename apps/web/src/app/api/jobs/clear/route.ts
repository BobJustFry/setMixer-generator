import { NextResponse } from "next/server";
import { clearFinishedVideoJobs } from "@/lib/job-cleanup";

export async function POST() {
  const deleted = await clearFinishedVideoJobs();
  return NextResponse.json({ deleted });
}
