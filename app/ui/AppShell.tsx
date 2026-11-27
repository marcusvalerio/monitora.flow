"use client";
/**
 * Casca do app: 4 abas (Agora, Tempo, Atenção, Trajeto — docs/REFORMULACAO.md) na barra de baixo (celular) ou no topo (desktop).
 * O menu (Monitor, Sobre os dados) fica num ícone no canto superior, fora da barra, ao lado do olho da marca.
 * O olho do canto dá uma piscada curta quando chega dado novo (evento "monitora:dado", disparado por LastUpdated).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { House, CloudSun, TriangleAlert, BusFront, Menu, Activity, Info, Settings, X } from "lucide-react";
import { MarcaMonitora } from "./Geometria";
import Abertura from "./Abertura";

const ITENS = [
  { href: "/", rotulo: "Agora", Icone: House },
  { href: "/clima", rotulo: "Tempo", Icone: CloudSun },
  { href: "/atencao", rotulo: "Atenção", Icone: TriangleAlert },
  { href: "/mobilidade", rotulo: "Trajeto", Icone: BusFront },
];
const MENU = [
  { href: "/ajustes", rotulo: "Ajustes", nota: "Notificações de chuva, alertas e ônibus", Icone: Settings },
  { href: "/monitor", rotulo: "Monitor da cidade", nota: "Frota, chuva e qualidade dos dados agora", Icone: Activity },
  { href: "/mais", rotulo: "Sobre os dados", nota: "Fontes, metodologia e privacidade", Icone: Info },
];

/** Olho do canto: pisca curto a cada dado novo (remonta o SVG para tocar a animação uma vez). */
function OlhoDoTopo({ size }: { size: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let ultimo = 0;
    const f = () => { const t = Date.now(); if (t - ultimo > 1500) { ultimo = t; setN((x) => x + 1); } };
    window.addEventListener("monitora:dado", f);
    return () => window.removeEventListener("monitora:dado", f);
  }, []);
  return <MarcaMonitora key={n} size={size} className={n ? "pisca-curta" : undefined} />;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  const ativo = (h: string) => p === h || (h !== "/" && p.startsWith(`${h}/`));
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [p]);
  const noMenu = MENU.some((x) => ativo(x.href));
  const iAtivo = ITENS.findIndex((x) => ativo(x.href));
  const [salto, setSalto] = useState(0);
  useEffect(() => setSalto((s) => s + 1), [iAtivo]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [menu]);

  const botaoMenu = (
    <button type="button" className="canto-menu" aria-expanded={menu} aria-haspopup="menu" aria-current={noMenu ? "page" : undefined}
      aria-label={menu ? "Fechar menu" : "Menu: Ajustes, Monitor da cidade e Sobre os dados"} onClick={() => setMenu((m) => !m)}>
      {menu ? <X aria-hidden /> : <Menu aria-hidden />}
    </button>
  );

  return (
    <div className="shell">
      <Abertura />
      <header className="topnav" aria-label="Navegação principal">
        <Link href="/" className="marca" aria-label="Monitora, aba Agora"><OlhoDoTopo size={30} /> Monitora</Link>
        <nav className="topnav-abas">
          {ITENS.map(({ href, rotulo }) => (
            <Link key={href} href={href} className="item" aria-current={ativo(href) ? "page" : undefined}>{rotulo}</Link>
          ))}
        </nav>
        {botaoMenu}
      </header>
      {/* celular: olho + menu no canto superior direito, fora da barra */}
      <div className="canto" role="group" aria-label="Marca e menu">
        <Link href="/" className="canto-olho" aria-label="Monitora, aba Agora"><OlhoDoTopo size={26} /></Link>
        {botaoMenu}
      </div>
      <div className="rota-entra" key={p}>{children}</div>
      <nav className="nav" aria-label="Abas" style={{ ["--n" as string]: ITENS.length, ["--i" as string]: Math.max(0, iAtivo) }}>
        <span className={`nav-ind${iAtivo >= 0 ? "" : " oculto"}`} aria-hidden />
        {ITENS.map(({ href, rotulo, Icone }, i) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}>
            <Icone aria-hidden strokeWidth={ativo(href) ? 2 : 1.7} key={i === iAtivo ? salto : undefined} className={i === iAtivo && salto > 1 ? "salta" : undefined} />
            {rotulo}
          </Link>
        ))}
      </nav>
      {menu && (
        <>
          <div className="nav-veu" onClick={() => setMenu(false)} aria-hidden />
          <div className="nav-pop" role="menu" aria-label="Menu">
            {MENU.map(({ href, rotulo, nota, Icone }) => (
              <Link key={href} href={href} role="menuitem" aria-current={ativo(href) ? "page" : undefined}>
                <Icone aria-hidden /><span><b>{rotulo}</b><small>{nota}</small></span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
