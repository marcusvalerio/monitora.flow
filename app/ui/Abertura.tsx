"use client";
/**
 * Abertura: o olho abre, pisca uma vez e o nome entra (1,6 s; prancha docs/reformulacao/Abertura.dc.html).
 * Toca uma vez por sessão, por cima do app e sem bloquear: a tela já carrega por baixo e o véu não recebe toque.
 * Com "reduzir movimento": olho já aberto, some logo (decidido também em JS — nenhuma animação roda).
 */
import { useEffect, useState } from "react";
import { MarcaMonitora } from "./Geometria";
import { reduzMovimento } from "./motion";

const K = "monitora:abertura";

export default function Abertura() {
  const [fase, setFase] = useState<"nao" | "toca" | "sai">("nao");
  useEffect(() => {
    let visto = false;
    try { visto = sessionStorage.getItem(K) === "1"; sessionStorage.setItem(K, "1"); } catch {}
    if (visto || new URLSearchParams(location.search).has("sem-abertura")) return;
    const parado = reduzMovimento();
    setFase("toca");
    const t1 = setTimeout(() => setFase("sai"), parado ? 500 : 1600);
    const t2 = setTimeout(() => setFase("nao"), parado ? 800 : 1950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (fase === "nao") return null;
  return (
    <div className={`abertura${fase === "sai" ? " sai" : ""}`} aria-hidden>
      <MarcaMonitora size={112} sobre="azul" className="abre" />
      <span className="abertura-nome">Monitora</span>
    </div>
  );
}
