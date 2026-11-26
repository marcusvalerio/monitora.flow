"use client";
/**
 * "Avisar quando chover forte aqui": assina o Web Push e pede ao servidor para olhar os pluviômetros perto do ponto
 * por 90 min. Avisa uma vez. Só a assinatura e o ponto arredondado (~1 km) vão para o servidor (src/lib/avisosChuva.ts).
 * No iPhone só funciona com o app instalado na Tela de Início (iOS 16.4+).
 */
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { J, get, gravar, ler } from "../ui/util";

const K = "monitora:atencao:aviso-chuva";
const VALIDADE_MS = 90 * 60_000;
type Estado = "carregando" | "indisponivel" | "instalar" | "pronto" | "ativando" | "ativo" | "negado" | "erro";

function chave(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export default function AvisarChuva({ local }: { local: { nome: string; lat: number; lng: number } }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [pub, setPub] = useState<string | null>(null);
  const [ate, setAte] = useState<number | null>(null);

  useEffect(() => {
    const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalado = matchMedia("(display-mode: standalone)").matches || (navigator as J).standalone === true;
    if (!suporta) { setEstado(ios && !instalado ? "instalar" : "indisponivel"); return; }
    get("/avisos").then((r) => {
      if (!r.disponivel || !r.chavePublica) { setEstado("indisponivel"); return; }
      setPub(r.chavePublica);
      const a = ler<J | null>(K, null);
      const vivo = a && Date.now() - a.em < VALIDADE_MS;
      if (vivo) setAte(a.em + VALIDADE_MS);
      setEstado(vivo ? "ativo" : Notification.permission === "denied" ? "negado" : "pronto");
    });
  }, []);

  const ativar = async () => {
    if (!pub) return;
    setEstado("ativando");
    try {
      if ((await Notification.requestPermission()) !== "granted") { setEstado("negado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const ass = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(pub) }));
      const r = await fetch("/avisos/chuva", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assinatura: ass.toJSON(), lat: local.lat, lng: local.lng, lugar: local.nome.slice(0, 80) }) });
      if (!r.ok) throw new Error(String(r.status));
      const { id } = await r.json();
      const em = Date.now();
      gravar(K, { id, em }); setAte(em + VALIDADE_MS); setEstado("ativo");
    } catch { setEstado("erro"); }
  };
  const parar = async () => {
    const a = ler<J | null>(K, null);
    if (a?.id) await fetch(`/avisos/chuva?id=${a.id}`, { method: "DELETE" }).catch(() => null);
    gravar(K, null); setAte(null); setEstado("pronto");
  };

  const nota = "Olhamos os pluviômetros do Alerta Rio a até 5 km por 90 min e avisamos uma vez se passar de 25 mm/h (chuva forte). Guardamos só a assinatura de notificação e o ponto arredondado; tudo é apagado ao avisar ou expirar.";
  if (estado === "carregando") return <div className="bl-acao"><button type="button" className="btn btn-primary" disabled><Bell aria-hidden /> Avisar quando chover forte aqui</button></div>;
  if (estado === "indisponivel") return <div className="bl-acao"><p className="bl-nota">Avisos de chuva indisponíveis neste navegador ou no servidor agora.</p></div>;
  if (estado === "instalar") return <div className="bl-acao"><p className="bl-nota">Para receber o aviso no iPhone, toque em Compartilhar → <b>Adicionar à Tela de Início</b> e abra o Monitora por lá.</p></div>;
  if (estado === "negado") return <div className="bl-acao"><p className="bl-nota">Notificações bloqueadas. Libere nos ajustes do navegador ou do celular para receber o aviso de chuva.</p></div>;
  return (
    <div className="bl-acao">
      {estado === "ativo" ? (
        <>
          <button type="button" className="btn btn-ghost" onClick={parar}><BellOff aria-hidden /> Parar aviso de chuva</button>
          <p className="bl-nota" role="status">Avisando se chover forte perto de {local.nome}{ate ? ` até ${new Date(ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}.</p>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-primary" onClick={ativar} disabled={estado === "ativando"}>
            <Bell aria-hidden /> {estado === "ativando" ? "Ativando…" : estado === "erro" ? "Tentar ativar de novo" : "Avisar quando chover forte aqui"}
          </button>
          <p className="bl-nota">{estado === "erro" ? "Não foi possível ativar agora. " : ""}{nota}</p>
        </>
      )}
    </div>
  );
}
