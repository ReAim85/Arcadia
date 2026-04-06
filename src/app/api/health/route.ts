import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "agenthub",
    version: "0.0.1",
    timestamp: new Date().toISOString(),
  });
}
