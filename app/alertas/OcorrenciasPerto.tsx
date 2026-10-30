"use client";
/** Prévia: ocorrências do COR a até 10 km da pessoa (GPS, ou o local salvo no Clima). */
import { useEffect, useState } from "react";
import { TriangleAlert, LocateFixed } from "lucide-react";
import { Skel } from "../ui/estados";
import { J, fmtDist, get, ha, ler, minhaPosicao } from "../ui/util";

export default function OcorrenciasPerto() {
  const [pos, setPos] = useState<{ lat: number; lng: number; nome: string } | null>(null);
  const [d, setD] = useState<J | null>(null);
  useEffect(() => { const l = ler<J | null>("monitora:clima:local", null); if (l) setPos({ lat: l.lat, lng: l.lng, nome: l.nome }); }, []);
  useEffect(() => {
    if (!pos) return;
    setD(null);
    const carregar = () => get(`/ocorrencias?lat=${pos.lat}&lng=${pos.lng}&raio=10000`).then(setD);
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 2 * 60_000);
    return () => clearInterval(t);
  }, [pos]);
  const usarGps = async () => { const p = await minhaPosicao(); if (!("erro" in p)) setPos({ ...p, nome: "sua localização" }); };

  return (
    <section aria-label="Ocorrências perto de você">
      <p className="t-body muted" style={{ margin: 0 }}>Acidentes, interdições e bolsões d'água a até 10 km de {pos?.nome ?? "você"}. Fonte: COR / Prefeitura do Rio.</p>
      <button className="btn btn-ghost nv-sec" onClick={usarGps}><LocateFixed aria-hidden /> Usar minha localização</button>
      {!pos ? <p className="t-cap nv-sec">Use sua localização (ou escolha um local na aba Clima) para ver o que acontece perto de você.</p> : !d ? <div className="nv-sec"><Skel h={60} r={14} /></div>
        : d.erro || !d.disponivel ? (
          <div className="notice nv-sec"><TriangleAlert className="sev-atencao" aria-hidden />
            <div><div className="t-head">Fonte do COR fora do ar agora</div>
              <div className="t-cap">A API pública de ocorrências da Prefeitura não está respondendo. Quando voltar, os avisos aparecem aqui sozinhos — nunca mostramos ocorrência inventada.</div></div></div>
        ) : !d.observado?.length ? (
          <p className="t-body muted nv-sec">Nenhuma ocorrência aberta num raio de 10 km.</p>
        ) : (
          <ul className="nv-avisos nv-sec">
            {d.observado.map((o: J) => (
              <li key={o.id}><TriangleAlert aria-hidden />
                <span><b>{o.titulo}</b>{o.bairro && ` · ${o.bairro}`}<br /><small className="t-cap">a {fmtDist(o.distanciaM / 1000)}{o.inicio && ` · ${ha(o.inicio)}`}{o.gravidade && ` · ${o.gravidade}`}</small></span></li>
            ))}
          </ul>
        )}
    </section>
  );
}
