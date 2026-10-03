"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CloudSun, BusFront, Ellipsis, Activity } from "lucide-react";
import { MarcaMonitora } from "./Geometria";

const ITENS = [
  { href: "/clima", rotulo: "Clima", Icone: CloudSun },
  { href: "/mobilidade", rotulo: "Mobilidade", Icone: BusFront },
  { href: "/monitor", rotulo: "Monitor", Icone: Activity },
  { href: "/mais", rotulo: "Mais", Icone: Ellipsis },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  const ativo = (h: string) => p === h || p.startsWith(`${h}/`);
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
        {ITENS.map(({ href, rotulo }) => (
          <Link key={href} href={href} className="item" aria-current={ativo(href) ? "page" : undefined}>{rotulo}</Link>
        ))}
      </header>
      {/* continuidade espacial: cada tela entra com a mesma transição (chave = rota) */}
      <div className="rota-entra" key={p}>{children}</div>
      <nav className="nav" aria-label="Navegação principal" style={{ ["--n" as string]: ITENS.length, ["--i" as string]: Math.max(0, ITENS.findIndex((x) => ativo(x.href))) }}>
        {/* indicador único que desliza entre as abas: uma peça do material, não um botão dentro da barra */}
        <span className={`nav-ind${ITENS.some((x) => ativo(x.href)) ? "" : " oculto"}`} aria-hidden />
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}>
            <Icone aria-hidden strokeWidth={ativo(href) ? 2 : 1.7} />
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
