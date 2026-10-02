import { NextResponse } from "next/server";
import { OPENAPI } from "../../src/lib/openapi";

export function GET() {
  return NextResponse.json(OPENAPI, { headers: { "access-control-allow-origin": "*" } });
}
