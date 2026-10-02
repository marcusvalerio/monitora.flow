/**
 * Sistema de movimento do Monitora (espelha os tokens --dur-* e --spring de globals.css).
 * Regra: todo movimento tem função (feedback, continuidade espacial ou atmosfera) e nunca altera dado.
 *   micro 100–250 ms · interação 250–450 ms · transição espacial 400–700 ms · atmosfera 3–20 s
 */
import type { Map as MLMap } from "maplibre-gl";

export const DUR = { micro: 180, interacao: 340, espacial: 560, atmosfera: 9000 } as const;

export const reduzMovimento = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Curvas (t ∈ [0,1]). */
export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 4),
  inOut: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  /** deslocamento contínuo de veículo: começa e termina suave, quase linear no meio */
  viagem: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  /** mola criticamente amortecida (sem overshoot visível) */
  mola: (t: number) => 1 - (1 + 7 * t) * Math.exp(-7 * t),
};

/** Opções de câmera para transições espaciais do mapa (seleção de estação, linha, veículo). */
export const camera = (duracao: number = DUR.espacial) => ({ duration: reduzMovimento() ? 0 : duracao, easing: ease.inOut, essential: false });

/**
 * Duração da interpolação de um veículo entre duas leituras: acompanha o ritmo do GPS
 * (o veículo "anda" durante quase todo o intervalo, sem ficar parado e depois saltar), mas sempre CHEGA ao dado real
 * antes da próxima leitura. Saltos grandes (> 800 m) não são suavizados: provável erro de GPS, mostramos rápido.
 */
export function duracaoVeiculo(intervaloMs: number, distM: number, stale = false) {
  if (reduzMovimento() || stale) return 0;
  // intervalo incoerente (aba em segundo plano, fonte travou): animar inventaria um percurso → posiciona direto
  if (intervaloMs > 60_000) return 0;
  if (distM > 800) return DUR.interacao;
  return Math.max(DUR.espacial, Math.min(9000, intervaloMs * 0.85));
}

/**
 * Água viva: textura muito sutil sobre as áreas de água do estilo (OpenMapTiles: source-layer "water").
 * Duas ondas de baixa amplitude e períodos primos entre si (sem loop perceptível); ~8 atualizações/s; pausa sem foco.
 * É só material do "mundo" — não carrega dado. Desligada com prefers-reduced-motion (fica a textura estática).
 */
export function aguaViva(map: MLMap, tint: string) {
  const fonte = Object.entries(map.getStyle().sources ?? {}).find(([, s]) => (s as { type?: string }).type === "vector")?.[0];
  const camadaAgua = map.getStyle().layers?.find((l) => l.id === "water" || (l as { "source-layer"?: string })["source-layer"] === "water");
  if (!fonte || !camadaAgua || map.getLayer("agua-viva")) return () => {};
  if (!map.hasImage("onda")) map.addImage("onda", texturaOnda(tint));
  map.addLayer({
    id: "agua-viva", type: "fill", source: fonte, "source-layer": "water",
    paint: { "fill-pattern": "onda", "fill-opacity": 0.35 },
  }, map.getStyle().layers?.[map.getStyle().layers!.indexOf(camadaAgua) + 1]?.id);
  if (reduzMovimento()) return () => {};
  let raf = 0, ultimo = 0;
  const t0 = performance.now();
  const passo = (t: number) => {
    raf = requestAnimationFrame(passo);
    if (document.hidden || t - ultimo < 125 || !map.getLayer("agua-viva")) return;
    ultimo = t;
    const s = (t - t0) / 1000;
    // deriva muito lenta (2 ondas, 23 s e 37 s) + "respiração" de opacidade (17 s)
    const dx = Math.sin(s / 23 * 2 * Math.PI) * 2.2 + Math.sin(s / 37 * 2 * Math.PI) * 1.4;
    const dy = Math.cos(s / 29 * 2 * Math.PI) * 1.2;
    map.setPaintProperty("agua-viva", "fill-translate", [dx, dy]);
    map.setPaintProperty("agua-viva", "fill-opacity", 0.28 + 0.1 * (0.5 + 0.5 * Math.sin(s / 17 * 2 * Math.PI)));
  };
  raf = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(raf);
}

/** Textura de ondulação abstrata (64×64, ladrilhável): linhas finas e irregulares, quase imperceptíveis. */
function texturaOnda(tint: string) {
  const n = 64, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  g.strokeStyle = tint; g.lineWidth = 1; g.globalAlpha = 0.5;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    for (let x = 0; x <= n; x++) {
      const y = (k * n) / 4 + 6 + Math.sin((x / n) * 2 * Math.PI * (k % 2 ? 1 : 2) + k) * 2.2;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  const d = g.getImageData(0, 0, n, n);
  return { width: n, height: n, data: new Uint8Array(d.data.buffer) };
}
