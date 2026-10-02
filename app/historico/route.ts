import { sql } from "../../src/lib/db";
import { pontoPorId } from "../../src/config/pontos";
import { ok, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";
const MAX_DIAS = 31;

function data(v: string | null, nome: string, padrao: Date) {
  if (!v) return padrao;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErroParametro(`parâmetro '${nome}' inválido (use ISO 8601)`);
  return d;
}

/** GET /historico?ponto=&de=&ate=&fonte=brt|sppo — série de buckets de 5 min. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const ponto = pontoPorId(q.get("ponto") ?? "");
    if (!ponto) throw new ErroParametro("ponto desconhecido ou ausente (veja /pontos)");
    const ate = data(q.get("ate"), "ate", new Date());
    const de = data(q.get("de"), "de", new Date(ate.getTime() - 86_400_000));
    if (de >= ate) throw new ErroParametro("'de' deve ser anterior a 'ate'");
    if (ate.getTime() - de.getTime() > MAX_DIAS * 86_400_000) throw new ErroParametro(`intervalo máximo: ${MAX_DIAS} dias`);
    const fonte = q.get("fonte");
    if (fonte && fonte !== "brt" && fonte !== "sppo") throw new ErroParametro("fonte deve ser 'brt' ou 'sppo'");

    const rows = await sql()`
      select fonte, bucket, n_veiculos, n_leituras, n_leituras_movimento, velocidade_media,
             velocidade_mediana, proporcao_parados, linhas, sentidos
      from agregados
      where ponto = ${ponto.id} and bucket >= ${de} and bucket < ${ate}
        ${fonte ? sql()`and fonte = ${fonte}` : sql()``}
      order by bucket, fonte`;

    return ok({
      ponto, de, ate, bucketMin: 5,
      nota: "Buckets sem nenhuma leitura não aparecem na série (sem dado). Nada é interpolado.",
      calculado: rows.map((r) => ({
        fonte: r.fonte, inicio: r.bucket, nVeiculos: r.n_veiculos, nLeituras: r.n_leituras,
        nLeiturasMovimento: r.n_leituras_movimento, velocidadeMedia: r.velocidade_media,
        velocidadeMediana: r.velocidade_mediana, proporcaoParados: r.proporcao_parados,
        linhas: r.linhas, sentidos: r.sentidos,
      })),
    });
  });
}
