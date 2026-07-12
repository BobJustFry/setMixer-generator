import { NextResponse } from "next/server";
import { isAppPasswordConfigured } from "@/lib/auth-password";

export async function GET() {
  return NextResponse.json({
    passwordConfigured: isAppPasswordConfigured(),
  });
}
