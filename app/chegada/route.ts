import { lerPosicoesLinha } from "../../src/lib/coletor";
import { estimarChegadas } from "../../src/lib/chegada";
import { AVISO_CHEGADA, PARAMETROS } from "../../src/lib/parametros";
import { ok, numero, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /chegada?linha=&lat=&lng= — estimativa EXPERIMENTAL de chegada dos veículos da linha. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const linha = (q.get("linha") ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("parâmetro 'linha' obrigatório");
    const lat = numero(q.get("lat"), "lat", { min: -90, max: 90 });
    const lng = numero(q.get("lng"), "lng", { min: -180, max: 180 });
    const agora = new Date();
    const ls = await lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000));
    const chegadas = estimarChegadas(ls, lat, lng, agora);
    return ok({
      avisoChegada: AVISO_CHEGADA,
      metodo: "ETA = d1/va − (agora − t1); d1 = distância em linha reta da última posição; va = aproximação observada entre duas leituras ≥ 60 s. Ver docs/METODOLOGIA.md.",
      consulta: { linha, lat, lng }, consultadoEm: agora,
      observado: { veiculosNaLinha: new Set(ls.map((l) => `${l.fonte}|${l.veiculo}`)).size },
      calculado: { chegadas: chegadas.slice(0, 5), proxima: chegadas[0] ?? null },
    });
  });
}
