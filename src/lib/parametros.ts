/**
 * Parâmetros do sistema. Tudo aqui é EXPERIMENTAL / ESCOLHA DO SISTEMA
 * (não vem dos documentos do professor) e está documentado em docs/METODOLOGIA.md.
 */
export const PARAMETROS = {
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — raio padrão em torno do ponto (m). */
  RAIO_PADRAO_M: 400,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — limite de raio aceito pela API (m). */
  RAIO_MAX_M: 2000,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — janela do /now (min). */
  JANELA_NOW_MIN: 15,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — tamanho do bucket dos agregados (min). */
  BUCKET_MIN: 5,
  /**
   * EXPERIMENTAL / ESCOLHA DO SISTEMA — leitura do BRT mais velha que isso é descartada.
   * O feed do BRT devolve a última posição de cada veículo, inclusive de dias/anos atrás.
   */
  BRT_IDADE_MAX_MIN: 5,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — maior janela pedida ao SPPO por coleta (min). */
  SPPO_JANELA_MAX_MIN: 10,
  /**
   * EXPERIMENTAL / ESCOLHA DO SISTEMA — velocidade (km/h) acima da qual a leitura conta
   * como "em movimento". Leituras com velocidade <= este valor contam como "parado"
   * (ex.: parado em estação/ponto) e entram só na proporção de parados.
   */
  VEL_MOVIMENTO_MIN_KMH: 0,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — leituras acima disso são descartadas como erro de GPS. */
  VEL_MAX_PLAUSIVEL_KMH: 120,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — retenção das posições brutas (min). */
  RETENCAO_BRUTO_MIN: 60,
  /** Retenção dos agregados (dias) — pedido do projeto (~6 meses). */
  RETENCAO_AGREGADO_DIAS: 183,
  /** EXPERIMENTAL / ESCOLHA DO SISTEMA — dias considerados no "habitual". */
  HABITUAL_DIAS_PADRAO: 28,
  /** Fuso usado para dia da semana / hora. Rio não tem horário de verão desde 2019. */
  FUSO: "America/Sao_Paulo",
} as const;

export const AVISO =
  "Velocidade de ônibus/BRT (GPS da frota, SMTR). Indicador indireto: os veículos param em " +
  "estações e pontos e muitos usam faixa exclusiva. NÃO é a velocidade dos carros nem a " +
  "contagem de veículos da via. Limites de congestionamento/saturação não são definidos aqui.";
