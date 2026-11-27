"use client";
/**
 * Atenção: cara de boletim (docs/REFORMULACAO.md). Estágio da cidade, chuva medida por região, ocorrências abertas
 * (alagamentos por rua, interdições, outras) e calor — cada linha com número grande, fonte e horário ao lado. Só fontes oficiais; nada inventado.
 * Movimento: item novo entra com fundo destacado que some em 2 s; estágio ≥ 3 pisca uma vez. Nada em loop.
 */
import { useCallback, useEffect, useState } from "react";
import { Ban, CircleCheck, CloudRain, ShieldAlert, Thermometer, TriangleAlert, Volume2, VolumeX, Waves } from "lucide-react";
import AvisarChuva from "./AvisarChuva";
import { ErrorState, Skel } from "../ui/estados";
import { J, get, horaLocal, ler } from "../ui/util";
import { intensidadeChuva } from "../../src/lib/chuva";

const LOCAL_PADRAO = { nome: "Centro", lat: -22.9068, lng: -43.1729 };
const K_VISTOS = "monitora:atencao:vistos";
const hora = (s?: string | null) => (s ? horaLocal(s).slice(0, 5) : null);
const mm = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const K_VOZ = "monitora:atencao:voz";
const GRUPOS = [
  { cat: "alagamento", rot: "Alagamentos", vazio: "Nenhum alagamento aberto" },
  { cat: "interdicao", rot: "Interdições", vazio: "Nenhuma interdição aberta" },
  { cat: "outra", rot: "Outras ocorrências", vazio: null },
] as const;
const km = (m: number) => `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

/** Alerta em áudio (opcional, desligado por padrão): lê em voz alta o que é novo. Usa a voz do próprio aparelho. */
function falar(texto: string) {
  try {
    if (!("speechSynthesis" in window) || !texto) return;
    const u = new SpeechSynthesisUtterance(texto); u.lang = "pt-BR"; u.rate = 1.02;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  } catch {}
}

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

  const ocorrs: J[] = Array.isArray(d?.ocorr?.observado) ? d!.ocorr.observado : [];
  const novos = useNovos(d ? ocorrs.map((o) => String(o.id)) : null);
  const [voz, setVoz] = useState(false);
  const temVoz = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => { setVoz(ler<boolean>(K_VOZ, false)); }, []);
  const resumoFalado = useCallback((so?: Set<string>) => {
    if (!d) return "";
    const partes: string[] = [];
    const e = d.cidade?.observado?.estagio;
    if (e && (!so || e.nivel >= 3)) partes.push(`Cidade em estágio ${e.nivel} de 5.`);
    for (const o of ocorrs) if (o.categoria !== "outra" && (!so || so.has(String(o.id)))) partes.push(`${o.categoria === "alagamento" ? "Alagamento" : "Interdição"}${o.rua ? ` na ${o.rua}` : ""}${o.bairro ? `, ${o.bairro}` : ""}.`);
    return partes.slice(0, 6).join(" ");
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  // lê só o que chegou de novo (nunca repete o que já foi lido)
  useEffect(() => { if (voz && novos.size) falar(resumoFalado(novos)); }, [novos]); // eslint-disable-line react-hooks/exhaustive-deps
  const alternarVoz = () => {
    const v = !voz; setVoz(v);
    try { localStorage.setItem(K_VOZ, JSON.stringify(v)); } catch {}
    if (v) falar(resumoFalado() || "Leitura de alertas ligada. Nada de alagamento ou interdição agora."); else window.speechSynthesis?.cancel();
  };

  return (
    <main className="page atencao">
      <header className="aba-cab">
        <h1 className="t-titulo">Atenção</h1>
        <p className="aba-sub">{d ? `Atualizado às ${hora(new Date(d.em).toISOString())} · fontes oficiais` : "Atualizando…"}</p>
      </header>
      {!d ? <div className="boletim">{[0, 1, 2, 3].map((i) => <Skel key={i} h={78} />)}</div> : (
        <div className="boletim cascata">
          <Resumo d={d} ocorrs={ocorrs} />
          <Estagio c={d.cidade} />
          <Chuva ch={d.chuva} />
          {d.ocorr?.erro || d.ocorr?.disponivel === false ? (
            <section className="bl"><h2 className="bl-rot">Alagamentos e interdições</h2><p className="bl-nota">A API de ocorrências do COR não respondeu agora. Nada é mostrado no lugar.</p></section>
          ) : GRUPOS.map((g) => {
            const lista = ocorrs.filter((o) => (o.categoria ?? "outra") === g.cat);
            if (!lista.length && !g.vazio) return null;
            return (
              <section key={g.cat} className="bl" aria-labelledby={`bl-${g.cat}`}>
                <h2 className="bl-rot" id={`bl-${g.cat}`}>{g.cat === "alagamento" ? <Waves aria-hidden /> : g.cat === "interdicao" ? <Ban aria-hidden /> : <TriangleAlert aria-hidden />} {g.rot} · até 30 km de {local?.nome ?? "você"}</h2>
                {!lista.length ? <p className="bl-val bl-ok">{g.vazio}</p> : (
                  <ul className="bl-lista">
                    {lista.slice(0, 8).map((o) => (
                      <li key={o.id} className={novos.has(String(o.id)) ? "novo" : undefined}>
                        <b className={g.cat !== "outra" ? "bl-alerta" : undefined}>{o.rua ?? o.titulo}</b>
                        {o.rua && <span className="bl-txt-c">{o.titulo}</span>}
                        <span className="bl-fonte">{[o.bairro, o.distanciaM != null ? km(o.distanciaM) : null, "COR", hora(o.inicio)].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <Calor c={d.cidade} />
          {local && <AvisarChuva local={local as { nome: string; lat: number; lng: number }} />}
          {temVoz && (
            <button type="button" className="bl-voz" aria-pressed={voz} onClick={alternarVoz}>
              {voz ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
              <span><b>Ler alertas em voz alta</b><small>{voz ? "Ligado: lê alagamentos, interdições e estágio 3 ou mais quando aparecem." : "Desligado. Usa a voz do próprio aparelho."}</small></span>
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function Estagio({ c }: { c: J }) {
  const e = c?.observado?.estagio;
  return (
    <section className="bl" aria-labelledby="bl-es">
      <h2 className="bl-rot" id="bl-es"><ShieldAlert aria-hidden /> Estágio da cidade</h2>
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
      <h2 className="bl-rot" id="bl-ch"><CloudRain aria-hidden /> Chuva medida na última hora · por região</h2>
      {chovendo.length === 0 ? (
        <><p className="bl-val bl-ok">Sem chuva</p><p className="bl-fonte">{es.length} pluviômetros · Alerta Rio · {hora(ch.atualizadoEm) ?? "—"}</p></>
      ) : (
        <ul className="bl-lista">
          {chovendo.slice(0, 5).map((e) => {
            const int = intensidadeChuva(e.mm.h01);
            const escala = Math.max(25, chovendo[0].mm.h01); // barra cheia = chuva forte (25 mm/h) ou o maior valor
            return (
              <li key={e.id}>
                <span className="bl-par"><span>{e.nome}</span><b className={`num${int === "forte" || int === "muito forte" ? " bl-alerta" : ""}`}>{mm(e.mm.h01)} mm/h</b></span>
                <span className="bl-barra" aria-hidden><i className={int === "forte" || int === "muito forte" ? "forte" : undefined} style={{ transform: `scaleX(${Math.min(1, e.mm.h01 / escala)})` }} /></span>
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
      <h2 className="bl-rot" id="bl-ca"><Thermometer aria-hidden /> Calor</h2>
      {c?.erro || !k ? <p className="bl-nota">O COR não informou o nível de calor agora.</p> : (
        <><p className={`bl-val num${k.nivel >= 3 ? " bl-alerta" : ""}`}>NC {k.nivel}</p><p className="bl-fonte">COR{k.atualizadoEm ? ` · ${hora(k.atualizadoEm)}` : ""}</p></>
      )}
    </section>
  );
}

/** Resumo do agora: uma frase e o placar (estágio, chuva, alagamentos, interdições, calor). Cor só quando importa. */
function Resumo({ d, ocorrs }: { d: J; ocorrs: J[] }) {
  const e = d.cidade?.observado?.estagio, k = d.cidade?.observado?.calor;
  const es: J[] = Array.isArray(d.chuva?.observado) ? d.chuva.observado : [];
  const chovendo = es.filter((x) => (x.mm?.h01 ?? 0) > 0).sort((a, b) => b.mm.h01 - a.mm.h01);
  const maior = chovendo[0], intMaior = maior ? intensidadeChuva(maior.mm.h01) : null;
  const ocOk = !(d.ocorr?.erro || d.ocorr?.disponivel === false);
  const alag = ocorrs.filter((o) => o.categoria === "alagamento").length, inter = ocorrs.filter((o) => o.categoria === "interdicao").length;
  const nivel = (e?.nivel ?? 1) >= 3 || intMaior === "muito forte" ? "alerta"
    : (e?.nivel ?? 1) >= 2 || intMaior === "forte" || intMaior === "moderada" || alag > 0 || (k?.nivel ?? 1) >= 3 ? "atencao" : "calmo";
  const titulo = (e?.nivel ?? 1) >= 2 ? `Cidade em estágio ${e.nivel}`
    : maior && intMaior !== "fraca" ? `Chuva ${intMaior} em ${maior.nome}`
    : alag > 0 ? `${alag} ${alag === 1 ? "alagamento aberto" : "alagamentos abertos"}`
    : chovendo.length ? "Chuva fraca em alguns pontos" : "Cidade sem alertas agora";
  const Ic = nivel === "calmo" ? CircleCheck : nivel === "alerta" ? ShieldAlert : TriangleAlert;
  return (
    <section className={`bl-resumo nv-${nivel}`} aria-label="Resumo agora">
      <div className="bl-resumo-cab"><Ic aria-hidden /><b>{titulo}</b></div>
      <ul className="bl-placar">
        <li><span>Estágio</span><b className="num">{e ? `${e.nivel}/5` : "—"}</b></li>
        <li><span>Chovendo</span><b className="num">{es.length ? `${chovendo.length}/${es.length}` : "—"}</b></li>
        <li><span>Alagam.</span><b className="num">{ocOk ? alag : "—"}</b></li>
        <li><span>Interd.</span><b className="num">{ocOk ? inter : "—"}</b></li>
        <li><span>Calor</span><b className="num">{k ? `NC ${k.nivel}` : "—"}</b></li>
      </ul>
    </section>
  );
}
