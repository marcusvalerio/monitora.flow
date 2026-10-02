import type { Ponto } from "../lib/agregar";

/**
 * Pontos de interesse agregados continuamente (histórico de 6 meses).
 * Coordenadas impressas nos relatórios de radares da CET-Rio usados no MOVA.
 * Para incluir um ponto, acrescente aqui: os agregados começam a partir da próxima coleta.
 * `raioM` é opcional (padrão PARAMETROS.RAIO_PADRAO_M).
 */
export const PONTOS: Ponto[] = [
  { id: "americas-2000", nome: "Av. das Américas, próximo ao nº 2000 (Barra)", lat: -23.000556, lng: -43.334167 },
  { id: "americas-2603", nome: "Av. das Américas, próximo ao nº 2603", lat: -23.000833, lng: -43.334722 },
  { id: "abelardo-bueno-980", nome: "Av. Embaixador Abelardo Bueno, nº 980", lat: -22.973056, lng: -43.3875 },
  { id: "jardim-botanico-746", nome: "Rua Jardim Botânico, nº 746", lat: -22.966357, lng: -43.219413 },
  { id: "jardim-botanico-garzon", nome: "Rua Jardim Botânico × R. Gal. Garzon", lat: -22.966806, lng: -43.219588 },
  { id: "linha-vermelha-km5", nome: "Linha Vermelha, km 5,5", lat: -22.855182, lng: -43.238784 },
  { id: "tunel-santa-barbara", nome: "Túnel Santa Bárbara (saída Catumbi)", lat: -22.925728, lng: -43.189408 },
  { id: "dom-helder-2238", nome: "Av. Dom Helder Câmara, nº 2238", lat: -22.881111, lng: -43.257222 },
];

export const pontoPorId = (id: string) => PONTOS.find((p) => p.id === id);
