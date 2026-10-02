"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CloudSun, BusFront, Ellipsis, Radar, Activity } from "lucide-react";

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
  return (
    <div className="shell">
      <header className="topnav" aria-label="Navegação principal">
        <Link href="/" className="marca"><Radar size={20} aria-hidden /> Monitora</Link>
        {ITENS.map(({ href, rotulo }) => (
          <Link key={href} href={href} className="item" aria-current={ativo(href) ? "page" : undefined}>{rotulo}</Link>
        ))}
      </header>
      {children}
      <nav className="nav" aria-label="Navegação principal">
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}>
            <Icone aria-hidden strokeWidth={ativo(href) ? 2.2 : 1.8} />
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}
