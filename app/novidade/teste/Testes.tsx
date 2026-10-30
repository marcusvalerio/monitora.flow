"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { J, ler } from "../../ui/util";

type R = { estado: "ok" | "aviso" | "erro" | "rodando"; ms?: number; detalhe?: string };
const RIO = { lat: -22.91, lng: -43.2 };

/** Cada teste chama a API de verdade e resume a resposta em uma frase. */
function testes(p: { lat: number; lng: number }): { nome: string; o: string; url: string; ler: (j: J) => R }[] {
  const q = `lat=${p.lat.toFixed(2)}&lng=${p.lng.toFixed(2)}`;
  return [
    { nome: "Previsão do tempo", o: "Open-Meteo", url: `/tempo?${q}`, ler: (j) => ({ estado: "ok", detalhe: `${Math.round(j.calculado?.agora?.temperaturaC)}°, ${j.calculado?.agora?.descricao?.texto ?? "—"}` }) },
    { nome: "Previsão completa (Tempo 2.0)", o: "Open-Meteo + ar", url: `/tempo/completo?${q}`, ler: (j) => ({ estado: j.calculado?.ar ? "ok" : "aviso", detalhe: `${j.calculado?.horas?.length} h · UV ${j.calculado?.agora?.uv ?? "—"} · ar ${j.calculado?.ar?.usAqi ?? "sem dado"}` }) },
    { nome: "Chuva medida", o: "Alerta Rio", url: `/chuva?${q}&k=1`, ler: (j) => ({ estado: "ok", detalhe: `${j.observado?.[0]?.nome ?? "—"}: ${j.observado?.[0]?.mm?.h01 ?? "—"} mm/h` }) },
    { nome: "Estágio da cidade e calor", o: "COR.Rio", url: "/cidade", ler: (j) => ({ estado: j.observado?.estagio ? "ok" : "erro", detalhe: j.observado?.estagio ? `Estágio ${j.observado.estagio.nivel} · NC${j.observado.calor?.nivel ?? "?"}` : "sem resposta do COR" }) },
    { nome: "Ocorrências", o: "COR (api.dados.rio)", url: `/ocorrencias?${q}`, ler: (j) => j.disponivel ? { estado: "ok", detalhe: `${j.observado?.length ?? 0} a até 10 km` } : { estado: "aviso", detalhe: "API da Prefeitura fora do ar (esperado por enquanto)" } },
    { nome: "GPS ao vivo (Monitor)", o: "SMTR", url: "/monitor/dados", ler: (j) => ({ estado: j.errosFonte ? "aviso" : "ok", detalhe: `${j.observado?.total ?? 0} veículos${j.errosFonte ? " · " + j.errosFonte.join("; ") : ""}` }) },
    { nome: "Veículos de uma linha", o: "SMTR", url: "/linhas/371/veiculos", ler: (j) => ({ estado: j.observado?.length ? "ok" : "aviso", detalhe: `linha 371: ${j.observado?.length ?? 0} com GPS` }) },
    { nome: "Chegada estimada", o: "Monitora", url: `/chegada?linha=371&${q}`, ler: (j) => ({ estado: "ok", detalhe: j.calculado?.proxima ? `próximo em ${Math.round(j.calculado.proxima.etaMin)} min` : "nenhum se aproximando agora" }) },
    { nome: "Busca de endereços", o: "Open-Meteo + IPP", url: "/locais?q=tijuca", ler: (j) => ({ estado: j.locais?.length ? "ok" : "aviso", detalhe: `${j.locais?.length ?? 0} resultados` }) },
    { nome: "Banco de dados e avisos", o: "Neon + Web Push", url: "/saude", ler: (j) => ({ estado: j.banco?.ok && j.avisos?.configurado ? "ok" : j.banco?.ok ? "aviso" : "erro",
      detalhe: `${j.banco?.ok ? `banco ok (${j.banco.ms} ms)` : `banco: ${j.banco?.erro ?? "erro"}`} · avisos ${j.avisos?.configurado ? "ligados" : "sem chaves VAPID"}` }) },
  ];
}

export default function Testes() {
  const [res, setRes] = useState<Record<string, R>>({});
  const [lugar, setLugar] = useState<{ lat: number; lng: number; nome: string }>({ ...RIO, nome: "Centro do Rio" });
  useEffect(() => { const l = ler<J | null>("monitora:clima:local", null); if (l) setLugar({ lat: l.lat, lng: l.lng, nome: l.nome }); }, []);

  const rodar = useCallback(() => {
    const ts = testes(lugar);
    setRes(Object.fromEntries(ts.map((t) => [t.nome, { estado: "rodando" } as R])));
    ts.forEach(async (t) => {
      const ini = performance.now();
      let r: R;
      try {
        const resp = await fetch(t.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        const j = await resp.json().catch(() => ({}));
        r = resp.ok ? t.ler(j) : { estado: "erro", detalhe: `HTTP ${resp.status}${j.erro ? ` · ${j.erro}` : ""}` };
      } catch (e) { r = { estado: "erro", detalhe: (e as Error).name === "TimeoutError" ? "sem resposta em 30 s" : "falha de rede" }; }
      r.ms = Math.round(performance.now() - ini);
      setRes((x) => ({ ...x, [t.nome]: r }));
    });
  }, [lugar]);
  useEffect(() => { rodar(); }, [rodar]);

  const lista = testes(lugar);
  const n = (e: R["estado"]) => lista.filter((t) => res[t.nome]?.estado === e).length;
  return (
    <>
      <div className="teste-resumo nv-sec">
        <span><b className="ok">{n("ok")}</b> ok</span><span><b className="aviso">{n("aviso")}</b> atenção</span><span><b className="erro">{n("erro")}</b> erro</span>
        <button className="btn btn-ghost" onClick={rodar}><RefreshCw aria-hidden /> Testar de novo</button>
      </div>
      <p className="t-cap" style={{ margin: "8px 0 0" }}>Local do teste: {lugar.nome}</p>
      <ul className="teste-lista">
        {lista.map((t) => {
          const r = res[t.nome] ?? { estado: "rodando" };
          const I = r.estado === "ok" ? CheckCircle2 : r.estado === "aviso" ? AlertCircle : r.estado === "erro" ? XCircle : Loader2;
          return (
            <li key={t.nome} className={`t-${r.estado}`}>
              <I aria-hidden className={r.estado === "rodando" ? "gira" : ""} />
              <span className="tl-main"><b>{t.nome}</b><small>{t.o}{r.detalhe ? ` · ${r.detalhe}` : ""}</small></span>
              <span className={`tl-ms${(r.ms ?? 0) > 3000 ? " lento" : ""}`}>{r.ms != null ? `${(r.ms / 1000).toFixed(1).replace(".", ",")} s` : ""}</span>
            </li>
          );
        })}
      </ul>
      <h2 className="rc-tit" style={{ marginTop: 28 }}>Telas para testar</h2>
      <ul className="teste-links">
        {[["/", "Home “Seu dia”"], ["/novidade", "Tempo 2.0 (prévia)"], ["/alertas", "Ocorrências"], ["/mobilidade", "Mobilidade + aviso de chegada"], ["/clima", "Clima"], ["/monitor", "Monitor"]].map(([h, r]) => (
          <li key={h}><Link href={h}>{r}<span>{h}</span></Link></li>
        ))}
      </ul>
    </>
  );
}
