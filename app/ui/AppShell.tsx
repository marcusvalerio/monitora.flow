"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloudSun, BusFront, TriangleAlert, Menu, Activity, Sparkles, Info, Code2, X } from "lucide-react";
import { MarcaMonitora } from "./Geometria";

const ITENS = [
  { href: "/clima", rotulo: "Clima", Icone: CloudSun },
  { href: "/mobilidade", rotulo: "Mobilidade", Icone: BusFront },
  { href: "/alertas", rotulo: "Ocorrências", Icone: TriangleAlert },
];
/** O que sai da barra e vai para o menu ☰ (o menu fica "ativo" quando a tela atual é uma destas). */
const MENU = [
  { href: "/monitor", rotulo: "Monitor da cidade", nota: "Frota, chuva e qualidade dos dados agora", Icone: Activity },
  { href: "/novidade", rotulo: "Novidades", nota: "O que está em avaliação", Icone: Sparkles },
  { href: "/mais", rotulo: "Sobre os dados", nota: "Fontes, metodologia e privacidade", Icone: Info },
  { href: "/docs", rotulo: "API", nota: "Endpoints para desenvolvedores", Icone: Code2 },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  const ativo = (h: string) => p === h || p.startsWith(`${h}/`);
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [p]);
  const noMenu = MENU.some((x) => ativo(x.href));
  const iAtivo = noMenu ? ITENS.length : ITENS.findIndex((x) => ativo(x.href));
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  // Material: a luz do vidro segue o ponteiro (uma escrita por frame, só no elemento sob o ponteiro).
  useEffect(() => {
    let raf = 0, ev: PointerEvent | null = null;
    const aplicar = () => {
      raf = 0;
      const el = (ev?.target as Element | null)?.closest?.(".glass, .map-search, .map-fab, .nav, .sheet") as HTMLElement | null;
      if (!el || !ev) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((ev.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((ev.clientY - r.top) / r.height) * 100}%`);
    };
    const mover = (e: PointerEvent) => { ev = e; if (!raf) raf = requestAnimationFrame(aplicar); };
    document.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerdown", mover, { passive: true });
    return () => { document.removeEventListener("pointermove", mover); document.removeEventListener("pointerdown", mover); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="shell">
      <header className="topnav" aria-label="Navegação principal">
        <Link href="/" className="marca"><MarcaMonitora size={22} /> Monitora</Link>
        {[...ITENS, ...MENU.slice(0, 1)].map(({ href, rotulo }) => (
          <Link key={href} href={href} className="item" aria-current={ativo(href) ? "page" : undefined}>{rotulo === "Monitor da cidade" ? "Monitor" : rotulo}</Link>
        ))}
        <Link href="/mais" className="item" aria-current={ativo("/mais") ? "page" : undefined}>Mais</Link>
      </header>
      {/* continuidade espacial: cada tela entra com a mesma transição (chave = rota) */}
      <div className="rota-entra" key={p}>{children}</div>
      <nav className="nav" aria-label="Navegação principal" style={{ ["--n" as string]: ITENS.length + 1, ["--i" as string]: Math.max(0, iAtivo) }}>
        {/* indicador único que desliza entre as abas: uma peça do material, não um botão dentro da barra */}
        <span className={`nav-ind${iAtivo >= 0 ? "" : " oculto"}`} aria-hidden />
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}>
            <Icone aria-hidden strokeWidth={ativo(href) ? 2 : 1.7} />
            {rotulo}
          </Link>
        ))}
        <button type="button" className="nav-menu" aria-expanded={menu} aria-current={noMenu ? "page" : undefined} onClick={() => setMenu((m) => !m)}>
          {menu ? <X aria-hidden /> : <Menu aria-hidden strokeWidth={noMenu ? 2 : 1.7} />}
          Menu
        </button>
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
