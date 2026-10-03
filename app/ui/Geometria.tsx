/**
 * Linguagem geométrica do Monitora: círculos, arcos e interseções em módulos.
 * Marca: dois círculos que se cruzam (lugar + movimento) e um arco de trajeto; o ponto de sinal (Lime) é o "agora".
 * Órbita: arcos concêntricos para carregamento — gira devagar (interação), para com reduced-motion.
 */
/** Marca do Monitora: mostrador de 24 h em gomos (o "relógio do céu"), um M de traço único (trajeto) e o ponto "agora". */
export function MarcaMonitora({ size = 22, sinal = true }: { size?: number; sinal?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.6" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" strokeDasharray="3.4 1.6" transform="rotate(-90 12 12)" />
      <circle cx="12" cy="12" r="9.6" stroke="currentColor" strokeWidth="2" strokeDasharray="3.4 1.6 3.4 1.6 3.4 1.6 3.4 60" transform="rotate(-90 12 12)" />
      <path d="M8.2 15.6V8.6L12 13l3.8-4.4v7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {sinal && <circle cx="12" cy="2.4" r="1.6" fill="var(--accent)" />}
    </svg>
  );
}

export function Orbita({ size = 44, rotulo = "Carregando" }: { size?: number; rotulo?: string }) {
  return (
    <span className="orbita" role="status" aria-label={rotulo} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" fill="none" aria-hidden>
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeOpacity=".12" strokeWidth="2" />
        <path className="o1" d="M24 4a20 20 0 0 1 20 20" stroke="var(--live)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="12" stroke="currentColor" strokeOpacity=".12" strokeWidth="2" />
        <path className="o2" d="M36 24a12 12 0 0 1-12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2.6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1" />
      </svg>
    </span>
  );
}

/** Ornamento de estados vazios: arcos concêntricos discretos atrás do ícone. */
export function Arcos() {
  return (
    <svg className="arcos" viewBox="0 0 120 120" fill="none" aria-hidden>
      {[56, 44, 32].map((r, i) => <circle key={r} cx="60" cy="60" r={r} stroke="currentColor" strokeOpacity={0.06 + i * 0.03} strokeWidth="1.5" strokeDasharray={i === 1 ? "2 6" : undefined} />)}
    </svg>
  );
}
