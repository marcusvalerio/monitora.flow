"use client";
/**
 * Atenção: cara de boletim (docs/REFORMULACAO.md). Estágio da cidade, chuva medida por região, ocorrências abertas
 * (alagamentos primeiro) e calor — cada linha com número grande, fonte e horário ao lado. Só fontes oficiais; nada inventado.
 * Movimento: item novo entra com fundo destacado que some em 2 s; estágio ≥ 3 pisca uma vez. Nada em loop.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { ErrorState, Skel } from "../ui/estados";
import { J, get, horaLocal, ler } from "../ui/util";
import { intensidadeChuva } from "../../src/lib/chuva";

const LOCAL_PADRAO = { nome: "Centro", lat: -22.9068, lng: -43.1729 };
const K_VISTOS = "monitora:atencao:vistos";
const hora = (s?: string | null) => (s ? horaLocal(s).slice(0, 5) : null);
const mm = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ALAGA = /alag|bols[aã]o|enchente|inunda/i;

/** Ids já vistos nesta sessão: o que não estava lá antes ganha o destaque de "novo" uma vez. */
function useNovos(ids: string[] | null) {
  const [novos, setNovos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!ids) return;
    let vistos: string[] | null = null;
    try { vistos = JSON.parse(sessionStorage.getItem(K_VISTOS) ?? "null"); } catch {}
    setNovos(vistos ? new Set(ids.filter((i) => !vistos!.includes(i))) : new Set());
    try { sessionStorage.setItem(K_VISTOS, JSON.stringify([...new Set([...(vistos ?? []), ...ids])].slice(-300))); } catch {}
  }, [ids?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return novos;
}

export default function AtencaoApp() {
  const [local, setLocal] = useState<J | null>(null);
  const [d, setD] = useState<{ cidade: J; chuva: J; ocorr: J; em: number } | null>(null);

  const carregar = useCallback(async (l: J) => {
    const [cidade, chuva, ocorr] = await Promise.all([
      get("/cidade", AbortSignal.timeout(12_000)),
      get("/chuva", AbortSignal.timeout(12_000)),
      get(`/ocorrencias?lat=${l.lat}&lng=${l.lng}&raio=30000`, AbortSignal.timeout(12_000)),
    ]);
    setD({ cidade, chuva, ocorr, em: Date.now() });
  }, []);

  useEffect(() => {
    const l = ler<J | null>("monitora:clima:local", null) ?? LOCAL_PADRAO;
    setLocal(l); carregar(l);
    const t = setInterval(() => { if (!document.hidden) carregar(l); }, 2 * 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const ocorrs: J[] = Array.isArray(d?.ocorr?.observado) ? [...d!.ocorr.observado].sort((a: J, b: J) => Number(ALAGA.test(b.titulo + b.tipo)) - Number(ALAGA.test(a.titulo + a.tipo))) : [];
  const novos = useNovos(d ? ocorrs.map((o) => String(o.id)) : null);

  return (
    <main className="page atencao">
      <header className="aba-cab">
        <h1 className="t-titulo">Atenção</h1>
        <p className="aba-sub">{d ? `Atualizado às ${hora(new Date(d.em).toISOString())} · fontes oficiais` : "Atualizando…"}</p>
      </header>
      {!d ? <div className="boletim">{[0, 1, 2, 3].map((i) => <Skel key={i} h={78} />)}</div> : (
        <div className="boletim cascata">
          <Estagio c={d.cidade} />
          <Chuva ch={d.chuva} />
          <section className="bl" aria-labelledby="bl-oc">
            <h2 className="bl-rot" id="bl-oc">Ocorrências abertas · até 30 km de {local?.nome ?? "você"}</h2>
            {d.ocorr?.erro || d.ocorr?.disponivel === false ? <p className="bl-nota">A API de ocorrências do COR não respondeu agora. Nada é mostrado no lugar.</p>
              : ocorrs.length === 0 ? <p className="bl-val bl-ok">Nenhuma ocorrência aberta</p> : (
                <ul className="bl-lista">
                  {ocorrs.slice(0, 8).map((o) => (
                    <li key={o.id} className={novos.has(String(o.id)) ? "novo" : undefined}>
                      <b className={ALAGA.test(o.titulo + o.tipo) ? "bl-alerta" : undefined}>{o.titulo}</b>
                      <span className="bl-fonte">{[o.bairro, o.distanciaM != null ? `${(o.distanciaM / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : null, "COR", hora(o.inicio)].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          <Calor c={d.cidade} />
          <div className="bl-acao">
            <button type="button" className="btn btn-primary" disabled aria-describedby="bl-push"><BellOff aria-hidden /> Avisar quando chover forte aqui</button>
            <p className="bl-nota" id="bl-push">Ainda não disponível. Hoje o app avisa só a chegada do ônibus, na aba <Link href="/mobilidade">Trajeto</Link>.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function Estagio({ c }: { c: J }) {
  const e = c?.observado?.estagio;
  return (
    <section className="bl" aria-labelledby="bl-es">
      <h2 className="bl-rot" id="bl-es">Estágio da cidade</h2>
      {c?.erro || !e ? <p className="bl-nota">O COR não informou o estágio agora.</p> : (
        <>
          <p className={`bl-val num${e.nivel >= 2 ? " bl-alerta" : ""}${e.nivel >= 3 ? " pisca-uma" : ""}`}>{e.nivel} de 5</p>
          {e.texto && <p className="bl-txt">{e.texto}</p>}
          <p className="bl-fonte">COR{e.desde ? ` · desde ${hora(e.desde)}` : ""}</p>
        </>
      )}
    </section>
  );
}

function Chuva({ ch }: { ch: J }) {
  if (ch?.erro || !Array.isArray(ch?.observado)) return (
    <section className="bl"><h2 className="bl-rot">Chuva medida</h2><p className="bl-nota">Os pluviômetros do Alerta Rio não responderam agora.</p></section>
  );
  const es: J[] = ch.observado;
  const chovendo = es.filter((e) => (e.mm?.h01 ?? 0) > 0).sort((a, b) => b.mm.h01 - a.mm.h01);
  return (
    <section className="bl" aria-labelledby="bl-ch">
      <h2 className="bl-rot" id="bl-ch">Chuva medida na última hora · por região</h2>
      {chovendo.length === 0 ? (
        <><p className="bl-val bl-ok">Sem chuva</p><p className="bl-fonte">{es.length} pluviômetros · Alerta Rio · {hora(ch.atualizadoEm) ?? "—"}</p></>
      ) : (
        <ul className="bl-lista">
          {chovendo.slice(0, 5).map((e) => {
            const int = intensidadeChuva(e.mm.h01);
            return (
              <li key={e.id}>
                <span className="bl-par"><span>{e.nome}</span><b className={`num${int === "forte" || int === "muito forte" ? " bl-alerta" : ""}`}>{mm(e.mm.h01)} mm/h</b></span>
                <span className="bl-fonte">{int} · Alerta Rio · {hora(e.medidoEm) ?? "—"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Calor({ c }: { c: J }) {
  const k = c?.observado?.calor;
  return (
    <section className="bl" aria-labelledby="bl-ca">
      <h2 className="bl-rot" id="bl-ca">Calor</h2>
      {c?.erro || !k ? <p className="bl-nota">O COR não informou o nível de calor agora.</p> : (
        <><p className={`bl-val num${k.nivel >= 3 ? " bl-alerta" : ""}`}>NC {k.nivel}</p><p className="bl-fonte">COR{k.atualizadoEm ? ` · ${hora(k.atualizadoEm)}` : ""}</p></>
      )}
    </section>
  );
}
