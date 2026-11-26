import { after } from "next/server";
import { configurado } from "../../../src/lib/avisos";
import { origemPublica, vigiar } from "../../../src/lib/vigia";
import { erro, ok, tratar } from "../../../src/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /avisos/vigiar — roda o vigia (src/lib/vigia.ts) em `after()`; responde na hora. */
export function POST(req: Request) {
  return tratar(async () => {
    if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return erro(401, "não autorizado");
    if (!configurado()) return erro(503, "avisos não configurados");
    after(() => vigiar(origemPublica(req)));
    return ok({ vigia: "iniciado" }, null, 0);
  });
}
