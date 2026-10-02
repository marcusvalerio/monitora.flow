import { buscarChuvas, estacoesProximas } from "../../src/lib/chuva";
import { ok, numero, tratar } from "../../src/lib/api";

export const revalidate = 120;

/** GET /chuva?lat=&lng= — pluviômetros do Alerta Rio mais próximos (ou todos, sem coordenada). */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const { geradoEm, estacoes } = await buscarChuvas();
    const temCoord = q.get("lat") !== null;
    const lista = temCoord
      ? estacoesProximas(estacoes, numero(q.get("lat"), "lat", { min: -90, max: 90 }), numero(q.get("lng"), "lng", { min: -180, max: 180 }), numero(q.get("k"), "k", { min: 1, max: 40, padrao: 3, inteiro: true }))
      : estacoes;
    return ok({
      fonte: { nome: "Alerta Rio (COR / Prefeitura do Rio) — pluviômetros", url: "https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml" },
      nota: "Chuva acumulada (mm) medida no pluviômetro, não no seu ponto exato. mXX = últimos XX min, hXX = últimas XX h. Sem classificação de intensidade.",
      atualizadoEm: geradoEm,
      observado: lista,
    }, null, 120);
  });
}
