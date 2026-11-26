"use client";
import { useEffect, useRef } from "react";
import { reduzMovimento } from "./motion";

/* ---------- grade: a "água" de cada fileira sobe até a chance de chuva quando a fileira entra na tela (uma vez) ---------- */
export function useEnche() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const raiz = ref.current; if (!raiz) return;
    const rolos = Array.from(raiz.querySelectorAll<HTMLElement>(".gh-rolo:not(.cheio)"));
    if (reduzMovimento() || !("IntersectionObserver" in window)) { rolos.forEach((e) => e.classList.add("cheio")); return; }
    rolos.forEach((e) => e.classList.add("vazio"));
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("cheio"); io.unobserve(e.target); } }), { threshold: 0.4 });
    rolos.forEach((e) => io.observe(e));
    return () => io.disconnect();
  });
  return ref;
}
