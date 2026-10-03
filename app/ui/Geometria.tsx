/**
 * Linguagem geométrica do Monitora: círculos, arcos e interseções em módulos.
 * Marca: "lente" — dois arcos que afinam nas pontas (pálpebra aberta: observar) e quatro colchetes que enquadram a cidade.
 * Órbita: arcos concêntricos para carregamento — gira devagar (interação), para com reduced-motion.
 */
/**
 * Marca do Monitora — "lente": dois arcos que afinam nas pontas formam uma pálpebra aberta (observar)
 * e quatro colchetes por fora enquadram a cidade. Simétrica nos dois eixos; viewBox 120; cor = currentColor.
 * Mesmos caminhos de public/icone.svg (lá em branco, escala 0,8, sobre #2C42C2).
 */
export const MARCA_CAMINHOS = [
  "M 98 46 C 80 24 40 24 22 46 L 22 54 C 40 36 80 36 98 54Z",
  "M 98 74 C 80 96 40 96 22 74 L 22 66 C 40 84 80 84 98 66Z",
  "M 76 4 L 91 29 L 79 29 L 70 14Z M 76 116 L 91 91 L 79 91 L 70 106Z M 44 4 L 29 29 L 41 29 L 50 14Z M 44 116 L 29 91 L 41 91 L 50 106Z",
] as const;

export function MarcaMonitora({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="currentColor" aria-hidden>
      {MARCA_CAMINHOS.map((d) => <path key={d} d={d} />)}
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
