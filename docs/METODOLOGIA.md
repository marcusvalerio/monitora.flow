# Metodologia

Legenda: **EXPERIMENTAL / ESCOLHA DO SISTEMA** = decisão nossa, não vem dos documentos do professor.
**FONTE EXTERNA** = método de fora dos documentos do professor. Todos os parâmetros ficam em `src/lib/parametros.ts`.

## O que este dado é (e o que não é)
É a **velocidade instantânea informada pelo GPS dos ônibus e BRTs**. É um indicador indireto do trânsito:
os veículos param em estações e pontos, muitos andam em faixa exclusiva (BRS/BRT) e a frota que passa varia com a hora.
**Não** é velocidade dos carros, **não** é contagem de veículos da via e **não** classifica congestionamento.
Capacidade, saturação e limites de "congestionado" dependem do professor e **não** são definidos aqui.
Toda resposta da API traz esse aviso no campo `aviso`.

## Três camadas
| Camada | Onde | O que é |
|---|---|---|
| **Observado** | tabela `posicoes`, campo `observado` | posições recebidas, sem placa, retenção 60 min |
| **Calculado** | tabela `agregados`, campo `calculado` | contagens, média, mediana por ponto/janela |
| **Interpretado** | campo `interpretado` do `/now?ponto=` | comparação com o habitual |

## Coleta
- A cada 5 min (GitHub Actions → `/api/coletar`).
- BRT: um retrato; ficam só leituras com idade ≤ **5 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA).
- SPPO: pede a janela `[fim da última coleta, agora]`, no máximo **10 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA).
- Descartes (contados em `coletas.descartadas`):
  - item fora do formato (zod);
  - `servico = "FORA DE OP"`;
  - coordenada fora da caixa lat ∈ (−23,15; −22,70), lng ∈ (−43,85; −43,05) (EXPERIMENTAL / ESCOLHA DO SISTEMA);
  - velocidade < 0 ou > **120 km/h** (EXPERIMENTAL / ESCOLHA DO SISTEMA);
  - leitura repetida (mesmo veículo, fonte e instante).
- `placa` é removida já na validação e nunca é gravada.

## Distância e raio
Distância de **haversine** (FONTE EXTERNA), raio médio da Terra R = 6 371 008,8 m (IUGG):

    d = 2R · asin( √( sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2) ) )

Uma leitura pertence ao ponto se d ≤ raio. Raio padrão **400 m**, máximo 2 000 m (EXPERIMENTAL / ESCOLHA DO SISTEMA).
Não há filtro por sentido da via: o raio pega os dois sentidos e ruas próximas (ver Limitações).

## Agregados (por ponto, fonte e bucket de 5 min)
Bucket = `floor(ts / 5 min)` em UTC (EXPERIMENTAL / ESCOLHA DO SISTEMA). BRT e SPPO ficam **separados**.
Seja L as leituras do bucket dentro do raio e M = { i ∈ L : vᵢ > 0 km/h } as "em movimento"
(limiar 0 km/h — EXPERIMENTAL / ESCOLHA DO SISTEMA):

    nVeiculos          = nº de códigos de veículo distintos em L
    nLeituras          = |L|
    nLeiturasMovimento = |M|
    velocidadeMedia    = Σ_{i∈M} vᵢ / |M|              (null se |M| = 0)
    velocidadeMediana  = mediana{ vᵢ : i ∈ M }         (null se |M| = 0)
    proporcaoParados   = (|L| − |M|) / |L|             (null se |L| = 0)

Valores arredondados a 0,1 km/h (proporção a 0,001).
**Sem dado, sem valor:** bucket sem leitura não gera linha; não há interpolação nem preenchimento.

Como o SPPO entrega leituras atrasadas, a cada coleta todos os buckets ainda cobertos pela tabela bruta (últimos ~55 min)
são recalculados do zero. Depois disso o bucket fica congelado.

Retenção: agregados por **183 dias** (~6 meses, pedido do projeto); limpeza automática a cada coleta.

## `/now`
Leituras das últimas **15 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA; parâmetro `janela`, máx. 60) dentro do raio,
resumidas com as mesmas fórmulas acima, por fonte (`calculado.brt`, `calculado.sppo`) e somadas (`calculado.total`).
`nVeiculos` e `velocidadeMedia` no topo da resposta = `calculado.total`.
Funciona para **qualquer coordenada** (não precisa ser ponto configurado), mas só cobre os últimos 60 min.

## `/habitual`
Para um ponto, fonte, dia da semana `w` e hora `h` (fuso America/Sao_Paulo), nos últimos N dias (padrão **28** — EXPERIMENTAL / ESCOLHA DO SISTEMA):

1. Para cada data d com dia da semana `w`, junta os buckets cujo início cai na hora `h`.
2. Valor do dia: `V_d = Σ_b (velocidadeMedia_b · nLeiturasMovimento_b) / Σ_b nLeiturasMovimento_b`
   (igual à média de todas as leituras em movimento daquela hora).
3. Dias sem leitura em movimento ficam **de fora** (não contam como zero).
4. Retorna `mediana`, `p25`, `p75` dos `V_d` e `nDias`.

Percentil por interpolação linear entre ordens, "tipo 7" de Hyndman & Fan (FONTE EXTERNA; padrão do R e do NumPy):

    h = (n − 1) · p;   Q(p) = x₍⌊h⌋₎ + (h − ⌊h⌋) · (x₍⌈h⌉₎ − x₍⌊h⌋₎)

## Interpretado (`/now?ponto=`)
EXPERIMENTAL / ESCOLHA DO SISTEMA: compara a `velocidadeMedia` atual de cada fonte com o habitual do mesmo dia da semana e hora:
`abaixo_da_faixa_habitual` (< p25), `dentro_da_faixa_habitual`, `acima_da_faixa_habitual` (> p75) ou `sem_dado`.
Isso diz só "diferente do costume", **não** "congestionado".

## Limitações
- Velocidade de ônibus ≠ velocidade do tráfego geral; faixa exclusiva pode deixar o ônibus rápido com a via parada (e vice-versa).
- Velocidade instantânea do GPS, sem checagem cruzada com o deslocamento entre leituras.
- Unidade km/h presumida pelos valores; não achamos documento oficial confirmando isso para o feed ao vivo.
- Raio circular: mistura sentidos e vias vizinhas (ex.: os dois pontos da Av. das Américas estão a ~60 m um do outro e compartilham leituras).
- Poucos veículos em alguns pontos/horários → média instável. Sempre olhar `nVeiculos` e `nLeiturasMovimento`.
- Linha Vermelha: quase sem ônibus municipais no teste — tende a "sem dado".
- O agendador do GitHub Actions pode atrasar ou pular execuções; os buracos aparecem como buckets ausentes.
- O "habitual" só fica significativo depois de algumas semanas de coleta.
