"use client";
/**
 * Ajustes → Notificações (decisão do dono, 27/11): um lugar só para autorizar e escolher o que chega fora do app.
 *   · Chuva forte perto de mim  · Alertas da cidade (estágio ≥ 3, avisos de perigo do INMET, calor NC ≥ 4)
 *   · Chegada do ônibus: continua sendo ligada por viagem, na aba Trajeto (dura até 90 min)
 * Guarda no servidor só a assinatura de push, o ponto arredondado (~1 km) e as escolhas (src/lib/inscricoes.ts).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BusFront, CloudRain, ShieldAlert } from "lucide-react";
import { J, get, gravar, ler } from "../ui/util";

const K = "monitora:ajustes:notificacoes";
const LOCAL_PADRAO = { nome: "Centro do Rio", lat: -22.9068, lng: -43.1729 };
type Suporte = "carregando" | "ok" | "instalar" | "indisponivel" | "negado";

function chave(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export default function Ajustes() {
  const [suporte, setSuporte] = useState<Suporte>("carregando");
  const [pub, setPub] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<{ chuva: boolean; cidade: boolean }>({ chuva: false, cidade: false });
  const [salvando, setSalvando] = useState<null | "chuva" | "cidade">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [local, setLocal] = useState<J>(LOCAL_PADRAO);

  useEffect(() => {
    setLocal(ler<J | null>("monitora:clima:local", null) ?? LOCAL_PADRAO);
    setPrefs(ler(K, { chuva: false, cidade: false }));
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const instalado = matchMedia("(display-mode: standalone)").matches || (navigator as J).standalone === true;
    if (!ok) { setSuporte(ios && !instalado ? "instalar" : "indisponivel"); return; }
    get("/avisos").then((r) => {
      if (!r.disponivel || !r.chavePublica) { setSuporte("indisponivel"); return; }
      setPub(r.chavePublica);
      setSuporte(Notification.permission === "denied" ? "negado" : "ok");
    });
  }, []);

  const alternar = async (qual: "chuva" | "cidade") => {
    if (!pub) return;
    const novo = { ...prefs, [qual]: !prefs[qual] };
    setSalvando(qual); setErro(null);
    try {
      if (novo[qual] && (await Notification.requestPermission()) !== "granted") { setSuporte("negado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const ass = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(pub) }));
      const r = await fetch("/inscricoes", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assinatura: ass.toJSON(), lat: local.lat, lng: local.lng, lugar: String(local.nome).slice(0, 80), ...novo }) });
      if (!r.ok) throw new Error(String(r.status));
      setPrefs(novo); gravar(K, novo);
    } catch { setErro("Não foi possível salvar agora. Tente de novo."); }
    finally { setSalvando(null); }
  };

  const desligado = suporte !== "ok";
  return (
    <main className="page ajustes">
      <header className="aba-cab"><h1 className="t-titulo">Ajustes</h1></header>
      <section className="aj-sec" aria-labelledby="aj-not">
        <h2 id="aj-not" className="aj-tit"><Bell aria-hidden /> Notificações</h2>
        {suporte === "instalar" && <p className="bl-nota">No iPhone, as notificações só funcionam com o app na Tela de Início: toque em Compartilhar → <b>Adicionar à Tela de Início</b> e abra o Monitora por lá.</p>}
        {suporte === "negado" && <p className="bl-nota">Notificações bloqueadas para o Monitora. Libere nos ajustes do celular (Notificações → Monitora) e volte aqui.</p>}
        {suporte === "indisponivel" && <p className="bl-nota">Notificações indisponíveis neste navegador ou no servidor agora.</p>}
        <ul className="aj-lista">
          <Opcao Icone={CloudRain} titulo="Chuva forte perto de mim" texto={`Quando um pluviômetro a até 5 km de ${local.nome} passar de 25 mm/h. No máximo uma por hora.`}
            ligado={prefs.chuva} ocupado={salvando === "chuva"} desligado={desligado} onClick={() => alternar("chuva")} />
          <Opcao Icone={ShieldAlert} titulo="Alertas da cidade" texto="Estágio 3 ou mais do COR, avisos de perigo do INMET e calor nível 4 ou mais."
            ligado={prefs.cidade} ocupado={salvando === "cidade"} desligado={desligado} onClick={() => alternar("cidade")} />
          <li className="aj-item">
            <BusFront aria-hidden />
            <span><b>Chegada do ônibus</b><small>Ligada em cada viagem, na aba <Link href="/mobilidade">Trajeto</Link>. Avisa ao ativar, a 5 min e chegando; dura até 90 min.</small></span>
          </li>
        </ul>
        {erro && <p className="bl-nota" role="alert">{erro}</p>}
        <p className="bl-nota aj-priv">O lugar usado é o da aba Tempo. Guardamos só a assinatura de notificação do aparelho, o ponto arredondado (cerca de 1 km) e estas escolhas — sem conta e sem IP. Desligar as duas apaga tudo. A verificação roda a cada 10 min.</p>
      </section>
    </main>
  );
}

function Opcao({ Icone, titulo, texto, ligado, ocupado, desligado, onClick }: { Icone: React.ElementType; titulo: string; texto: string; ligado: boolean; ocupado: boolean; desligado: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="aj-item" role="switch" aria-checked={ligado} disabled={desligado || ocupado} onClick={onClick}>
        <Icone aria-hidden />
        <span><b>{titulo}</b><small>{texto}</small></span>
        <i className={`aj-chave${ligado ? " on" : ""}`} aria-hidden />
      </button>
    </li>
  );
}
