import { NextResponse } from "next/server";
import { AVISO } from "./parametros";

export const FONTE = {
  nome: "GPS da frota de BRT e ônibus municipais (SPPO) — SMTR / Prefeitura do Rio",
  urls: ["https://dados.mobilidade.rio/gps/brt", "https://dados.mobilidade.rio/gps/sppo"],
  documentacao: "docs/FONTES.md",
};

export function ok(corpo: Record<string, unknown>) {
  return NextResponse.json({ fonte: FONTE, aviso: AVISO, ...corpo }, {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" },
  });
}

export function erro(status: number, mensagem: string) {
  return NextResponse.json({ erro: mensagem, aviso: AVISO }, { status, headers: { "access-control-allow-origin": "*" } });
}

export function numero(v: string | null, nome: string, opts: { min?: number; max?: number; padrao?: number; inteiro?: boolean } = {}): number {
  if (v === null || v === "") {
    if (opts.padrao !== undefined) return opts.padrao;
    throw new ErroParametro(`parâmetro '${nome}' é obrigatório`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || (opts.inteiro && !Number.isInteger(n))) throw new ErroParametro(`parâmetro '${nome}' inválido`);
  if ((opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max))
    throw new ErroParametro(`parâmetro '${nome}' fora do intervalo [${opts.min}, ${opts.max}]`);
  return n;
}

export class ErroParametro extends Error {}

export function tratar(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e) => (e instanceof ErroParametro ? erro(400, e.message) : (console.error(e), erro(500, "erro interno"))));
}
