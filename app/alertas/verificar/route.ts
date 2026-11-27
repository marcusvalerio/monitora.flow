import { configurado } from "../../../src/lib/avisos";
import { verificarAlertas } from "../../../src/lib/inscricoes";
import { erro, ok, tratar } from "../../../src/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /alertas/verificar — chamado a cada 10 min pelo GitHub Actions (.github/workflows/alertas.yml). Só toca no banco se houver alerta. */
export function POST(req: Request) {
  return tratar(async () => {
    if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return erro(401, "não autorizado");
    if (!configurado()) return erro(503, "notificações não configuradas");
    return ok(await verificarAlertas(), null, 0);
  });
}
