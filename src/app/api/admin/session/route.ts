import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth/session";

export async function GET() {
  return NextResponse.json({ authenticated: await isAdminRequest() });
}

