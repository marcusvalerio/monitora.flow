import { NextResponse } from "next/server";
import { coletar } from "../../../src/lib/coletor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Disparado pelo agendador (GitHub Actions). Exige `Authorization: Bearer $CRON_SECRET`. */
async function handler(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`)
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await coletar());
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
export { handler as GET, handler as POST };
