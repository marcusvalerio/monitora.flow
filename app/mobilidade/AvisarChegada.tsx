"use client";
/**
 * "Avisar quando chegar": assina o Web Push e pede ao servidor para acompanhar a linha.
 * No iPhone só funciona com o app instalado na Tela de Início (iOS 16.4+); fora disso explicamos como.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { J, get, gravar, ler } from "../ui/util";

const K = "monitora:mob:aviso";
type Estado = "carregando" | "indisponivel" | "instalar" | "pronto" | "ativando" | "ativo" | "negado" | "erro";

function chave(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export default function AvisarChegada({ linha, ponto, sentido, etaMin }: { linha: string; ponto: { nome: string; lat: number; lng: number }; sentido: string | null; etaMin: number | null }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [pub, setPub] = useState<string | null>(null);
  const atual = `${linha}|${ponto.lat}|${ponto.lng}`;

  useEffect(() => {
    const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalado = matchMedia("(display-mode: standalone)").matches || (navigator as J).standalone === true;
    if (!suporta) { setEstado(ios && !instalado ? "instalar" : "indisponivel"); return; }
    get("/avisos").then((r) => {
      if (!r.disponivel || !r.chavePublica) { setEstado("indisponivel"); return; }
      setPub(r.chavePublica);
      const a = ler<J | null>(K, null);
      setEstado(a && a.alvo === atual && Date.now() - a.em < 90 * 60_000 ? "ativo" : Notification.permission === "denied" ? "negado" : "pronto");
    });
  }, [atual]);

  const ativar = async () => {
    if (!pub) return;
    setEstado("ativando");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setEstado("negado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const ass = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(pub) }));
      const r = await fetch("/avisos", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assinatura: ass.toJSON(), linha, lat: ponto.lat, lng: ponto.lng, ponto: ponto.nome, sentido, etaMin }) });
      if (!r.ok) throw new Error(String(r.status));
      const { id } = await r.json();
      gravar(K, { id, alvo: atual, em: Date.now() });
      setEstado("ativo");
    } catch { setEstado("erro"); }
  };
  const parar = async () => {
    const a = ler<J | null>(K, null);
    if (a?.id) await fetch(`/avisos?id=${a.id}`, { method: "DELETE" }).catch(() => null);
    gravar(K, null); setEstado("pronto");
  };

  if (estado === "carregando" || estado === "indisponivel") return null;
  if (estado === "instalar") return <p className="t-cap aviso-chegada-nota">Para receber o aviso de chegada no iPhone, toque em Compartilhar → <b>Adicionar à Tela de Início</b> e abra o Monitora por lá.</p>;
  if (estado === "negado") return <p className="t-cap aviso-chegada-nota">Notificações bloqueadas. Libere em Ajustes → Notificações → Monitora.</p>;
  return estado === "ativo" ? (
    <button className="btn btn-ghost aviso-chegada" onClick={parar}><BellOff aria-hidden /> Parar aviso de chegada</button>
  ) : (
    <button className="btn btn-primary aviso-chegada" onClick={ativar} disabled={estado === "ativando"}>
      <Bell aria-hidden /> {estado === "ativando" ? "Ativando…" : estado === "erro" ? "Tentar ativar de novo" : "Avisar quando estiver chegando"}
    </button>
  );
}
