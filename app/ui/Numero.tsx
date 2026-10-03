"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Número que troca com transição vertical (3 → 2: o antigo sobe e some, o novo entra de baixo).
 * Só anima quando o valor muda de verdade; com reduced-motion troca direto. A leitura para leitor de tela é o valor final.
 */
export function NumeroRolante({ valor, className }: { valor: number | string; className?: string }) {
  const [atual, setAtual] = useState(valor);
  const [anterior, setAnterior] = useState<number | string | null>(null);
  const [sentido, setSentido] = useState<"sobe" | "desce">("sobe");
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; setAtual(valor); return; }
    if (valor === atual) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduzir) { setAtual(valor); return; }
    setSentido(Number(valor) < Number(atual) ? "sobe" : "desce");
    setAnterior(atual); setAtual(valor);
    const t = setTimeout(() => setAnterior(null), 420);
    return () => clearTimeout(t);
  }, [valor]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={`rolante ${sentido}${className ? ` ${className}` : ""}`} aria-label={String(valor)}>
      {anterior !== null && <span className="sai" aria-hidden key={`a${anterior}`}>{anterior}</span>}
      <span className={anterior !== null ? "entra" : ""} aria-hidden key={`n${atual}`}>{atual}</span>
    </span>
  );
}
