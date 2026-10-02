import { sql } from "./db";
import { calcularHabitual } from "./habitual";
import { PARAMETROS } from "./parametros";
import type { Fonte } from "./fontes";

export async function habitualDoBanco(ponto: string, fonte: Fonte, diaSemana: number, hora: number, dias: number, agora = new Date()) {
  const desde = new Date(agora.getTime() - dias * 86_400_000);
  const rows = await sql()`
    select bucket, n_leituras_movimento, velocidade_media from agregados
    where ponto = ${ponto} and fonte = ${fonte} and bucket >= ${desde}
      and extract(dow  from bucket at time zone ${PARAMETROS.FUSO}) = ${diaSemana}
      and extract(hour from bucket at time zone ${PARAMETROS.FUSO}) = ${hora}`;
  const h = calcularHabitual(
    rows.map((r) => ({ bucket: new Date(r.bucket), nLeiturasMovimento: r.n_leituras_movimento, velocidadeMedia: r.velocidade_media })),
    diaSemana, hora,
  );
  return { ...h, diasConsultados: dias };
}

export async function ultimaColeta() {
  const [c] = await sql()`select fim, n_brt, n_sppo, erros from coletas order by fim desc limit 1`;
  return c ? { em: c.fim, leiturasBrt: c.n_brt, leiturasSppo: c.n_sppo, erros: c.erros } : null;
}
