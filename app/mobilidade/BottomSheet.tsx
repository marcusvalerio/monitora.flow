"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Bottom sheet com 3 alturas (resumo, meio, cheio). Arrasta pela alça/cabeçalho; solta e encaixa na altura
 * mais próxima considerando a velocidade do gesto. Informa a altura visível (para o mapa não ficar escondido).
 * No desktop (≥ 960px) vira painel lateral fixo (CSS).
 */
export default function BottomSheet({ resumo, children, nivel, setNivel, onAltura, cabecalho }: {
  resumo: number; children: React.ReactNode; nivel: 0 | 1 | 2; setNivel: (n: 0 | 1 | 2) => void;
  onAltura: (px: number) => void; cabecalho?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0); // altura do contêiner
  const [arrasto, setArrasto] = useState<number | null>(null);
  const ini = useRef<{ y: number; t: number; base: number } | null>(null);

  useEffect(() => {
    const p = ref.current?.parentElement; if (!p) return;
    const ro = new ResizeObserver(() => setH(p.clientHeight)); ro.observe(p); setH(p.clientHeight);
    return () => ro.disconnect();
  }, []);

  const desktop = typeof window !== "undefined" && window.matchMedia?.("(min-width: 960px)").matches;
  // a navegação flutua sobre o painel no celular: a altura recolhida reserva o espaço dela (o essencial fica sempre visível)
  const [reserva, setReserva] = useState(0);
  useEffect(() => {
    const nav = document.querySelector(".nav") as HTMLElement | null;
    const medir = () => setReserva(!nav || desktop ? 0 : Math.round(window.innerHeight - nav.getBoundingClientRect().top + 8));
    medir(); window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [desktop]);
  const alturas = [Math.min(resumo, h * 0.5) + reserva, Math.round(h * 0.5) + reserva, Math.round(h * 0.9)];
  const visivel = arrasto ?? alturas[nivel];
  const sheetH = Math.round(h * 0.92);
  const y = Math.max(0, sheetH - visivel);

  useEffect(() => { if (h) onAltura(desktop ? 0 : Math.min(visivel, alturas[1])); }, [visivel, h]); // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: React.PointerEvent) => {
    if (desktop) return;
    ini.current = { y: e.clientY, t: performance.now(), base: visivel };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!ini.current) return;
    const v = ini.current.base + (ini.current.y - e.clientY);
    setArrasto(Math.max(alturas[0] * 0.7, Math.min(sheetH, v)));
  };
  const up = (e: React.PointerEvent) => {
    if (!ini.current) return;
    const dy = ini.current.y - e.clientY, dt = Math.max(1, performance.now() - ini.current.t), vel = dy / dt; // px/ms (+ = subindo)
    const atual = ini.current.base + dy;
    ini.current = null; setArrasto(null);
    if (Math.abs(dy) < 6) { setNivel(nivel === 0 ? 1 : nivel); return; } // toque na alça abre
    let alvo = alturas.reduce((m, a, i) => (Math.abs(a - atual) < Math.abs(alturas[m] - atual) ? i : m), 0);
    if (vel > 0.5) alvo = Math.min(2, nivel + 1); else if (vel < -0.5) alvo = Math.max(0, nivel - 1);
    setNivel(alvo as 0 | 1 | 2);
  };

  return (
    <div ref={ref} className={`sheet${arrasto === null ? " anim" : ""}`} style={{ height: desktop ? undefined : sheetH, transform: desktop ? undefined : `translateY(${y}px)` }}
      role="region" aria-label="Painel de informações">
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: "none" }}>
        <button className="grip" style={{ width: "100%" }} aria-label={nivel === 2 ? "Recolher painel" : "Expandir painel"}
          onClick={(e) => { if (e.detail === 0) setNivel(nivel === 2 ? 0 : ((nivel + 1) as 1 | 2)); }}><i /></button>
        {cabecalho}
      </div>
      <div className="body">{children}</div>
    </div>
  );
}
