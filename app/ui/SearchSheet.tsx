"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, Search, X } from "lucide-react";

/**
 * Folha de busca em tela cheia (mobile) / janela (desktop). Foco no campo ao abrir, Esc fecha,
 * resultados roláveis acima do teclado virtual (a folha usa a altura dinâmica da viewport).
 */
export default function SearchSheet({ titulo, placeholder, q, setQ, onClose, children }: {
  titulo: string; placeholder: string; q: string; setQ: (v: string) => void; onClose: () => void; children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div className="searchsheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <button className="btn-icon btn" onClick={onClose} aria-label="Voltar"><ArrowLeft /></button>
          <label className="searchfield">
            <Search aria-hidden />
            <span className="sr">{titulo}</span>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
              autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
            {q && <button onClick={() => { setQ(""); input.current?.focus(); }} aria-label="Limpar busca"><X size={18} /></button>}
          </label>
        </header>
        <div className="t-label" style={{ padding: "0 20px 4px" }}>{titulo}</div>
        <div className="results">{children}</div>
      </div>
    </>
  );
}
