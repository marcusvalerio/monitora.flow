/**
 * Linguagem geométrica do Monitora: círculos, arcos e interseções em módulos.
 * Marca: o olho "C · Pálpebra". Carregando: o olho pisca devagar.
 */
/**
 * Marca do Monitora — símbolo "C · Pálpebra" (docs/REFORMULACAO.md, prancha docs/reformulacao/Simbolo2.dc.html).
 * Um olho aberto em três peças sobre viewBox 120: o arco de cima (pálpebra), o meio-disco de baixo (base) e a pupila,
 * sobreposta às duas com multiply (onde se cruzam, a cor escurece). Em ≤ 32 px usa a versão de fresta maior.
 * Cores: no papel = lilás / ultramarino / tinta; no azul = branco / lilás / tinta.
 */
export const OLHO = {
  normal: { cima: "M14 62 A46 46 0 0 1 106 62 L90 62 A30 30 0 0 0 30 62 Z", base: "M30 66 A30 30 0 0 0 90 66 Z", pupila: { cx: 60, cy: 64, r: 15 }, oCima: "60px 62px", oBase: "60px 66px" },
  pequeno: { cima: "M8 60 A52 52 0 0 1 112 60 L92 60 A32 32 0 0 0 28 60 Z", base: "M28 68 A32 32 0 0 0 92 68 Z", pupila: { cx: 60, cy: 66, r: 16 }, oCima: "60px 60px", oBase: "60px 68px" },
} as const;
export const CORES_OLHO = {
  papel: { cima: "var(--lilac)", base: "var(--ultramarine)", pupila: "var(--tinta)" },
  azul: { cima: "#FFFFFF", base: "var(--lilac)", pupila: "var(--tinta)" },
} as const;

/** Símbolo solto (sem fundo). `fundo` desenha o ícone do app (quadrado azul arredondado). `classe` liga as animações (abertura, piscadas). */
export function MarcaMonitora({ size = 22, sobre = "papel", fundo = false, className }: { size?: number; sobre?: "papel" | "azul"; fundo?: boolean; className?: string }) {
  const g = size <= 32 ? OLHO.pequeno : OLHO.normal;
  const c = CORES_OLHO[fundo ? "azul" : sobre];
  return (
    <svg className={`olho${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden style={{ isolation: "isolate", ["--o-cima" as string]: g.oCima, ["--o-base" as string]: g.oBase, ["--o-pup" as string]: `${g.pupila.cx}px ${g.pupila.cy}px` }}>
      {fundo && <rect width="120" height="120" rx="27" fill="var(--ultramarine)" />}
      <path className="cima" d={g.cima} fill={c.cima} />
      <path className="baixo" d={g.base} fill={c.base} />
      <circle className="pupila" {...g.pupila} fill={c.pupila} style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}

/** Carregando = o olho pisca devagar (substitui a antiga órbita). Com "reduzir movimento" fica parado. */
export function OlhoCarregando({ size = 44, rotulo = "Carregando" }: { size?: number; rotulo?: string }) {
  return <span className="olho-carregando" role="status" aria-label={rotulo}><MarcaMonitora size={size} className="pisca-lento" /></span>;
}

/** Ornamento de estados vazios: arcos concêntricos discretos atrás do ícone. */
export function Arcos() {
  return (
    <svg className="arcos" viewBox="0 0 120 120" fill="none" aria-hidden>
      {[56, 44, 32].map((r, i) => <circle key={r} cx="60" cy="60" r={r} stroke="currentColor" strokeOpacity={0.06 + i * 0.03} strokeWidth="1.5" strokeDasharray={i === 1 ? "2 6" : undefined} />)}
    </svg>
  );
}
