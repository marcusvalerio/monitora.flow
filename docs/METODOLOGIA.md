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
- A cada **10 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA): GitHub Actions (cron) → `/api/coletar` na Vercel.
  10 min e não 5 para caber na cota de computação do plano gratuito do Neon (cada coleta acorda o banco). Para 5 min, mude o cron em `.github/workflows/coletar.yml`.
- BRT: um retrato; ficam só leituras com idade ≤ **5 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA).
- SPPO: pede a janela `[fim da última coleta, agora]`, no máximo **20 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA).
- Como o BRT é um retrato a cada coleta, o BRT tem menos leituras que o SPPO (que manda o histórico da janela).
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

## `/agora` (alias: `/now`)
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

O dia de hoje **nunca** entra no habitual (só dias anteriores, contados no fuso do Rio).

## Interpretado (`/agora?ponto=` ou coordenada a até 150 m de um ponto configurado)
EXPERIMENTAL / ESCOLHA DO SISTEMA: compara a `velocidadeMedia` atual de cada fonte com o habitual do mesmo dia da semana e hora:
`abaixo_da_faixa_habitual` (< p25), `dentro_da_faixa_habitual`, `acima_da_faixa_habitual` (> p75), `sem_dado`
ou `historico_insuficiente` (menos de **3 dias** anteriores com dado — EXPERIMENTAL / ESCOLHA DO SISTEMA).
A associação coordenada → ponto usa até **150 m** (EXPERIMENTAL / ESCOLHA DO SISTEMA).
Isso diz só "diferente do costume", **não** "congestionado".

## Modo ao vivo (`/linhas/{linha}/veiculos` e `/chegada`)
Esses dois endpoints não dependem do intervalo da coleta: a cada pedido leem a fonte da SMTR na hora
(BRT: retrato atual; SPPO: últimos **3 min**; o app pede a cada 10 s), reaproveitando a leitura por até **8 s** por instância do servidor
(EXPERIMENTAL / ESCOLHA DO SISTEMA, para não sobrecarregar a fonte). As leituras ao vivo ficam só em memória por 10 min
(nunca no banco) e são somadas às posições gravadas. É isso que dá ao BRT a "leitura anterior" exigida pela estimativa de chegada.

## Estimativa de chegada (`/chegada`) — EXPERIMENTAL / ESCOLHA DO SISTEMA
Não é horário oficial. Para cada veículo da linha com leituras nos últimos **10 min**:

    p1, t1 = última leitura;  p0, t0 = leitura mais antiga com t1 − t0 ≥ 60 s
    d1 = dist(p1, destino);  d0 = dist(p0, destino)          (haversine, linha reta)
    va = (d0 − d1) / (t1 − t0)                              velocidade de aproximação observada (m/s)
    o veículo só conta como "vindo" se d0 − d1 ≥ 50 m e d1 ≤ 15 km
    ETA = max(0, d1 / va − (agora − t1))

Parâmetros 10 min, 60 s, 50 m e 15 km: EXPERIMENTAL / ESCOLHA DO SISTEMA.
Limitações: linha reta subestima o caminho pela rua; um veículo que contorna uma curva pode parecer "afastando";
paradas e trânsito mudam `va`; não sabe se o veículo vai mesmo passar pelo seu ponto (falta o trajeto GTFS — próximo passo).
Sem veículo vindo → `proxima: null` (sem dado).

## Linhas perto de uma parada (`/paradas/{id}/linhas`) — EXPERIMENTAL / ESCOLHA DO SISTEMA
Linhas com pelo menos uma posição de GPS a até **100 m** da parada nos últimos **60 min** (haversine), com nº de veículos distintos.
Não é a lista oficial de linhas da parada: pode incluir linhas que só passam pela rua sem parar e omitir linhas sem veículo na última hora.

## Direção do veículo no mapa — EXPERIMENTAL / ESCOLHA DO SISTEMA
Campo `direcao` do GPS da SMTR (graus, 0 = norte, sentido horário). A convenção foi **validada** comparando com o rumo
calculado entre leituras consecutivas: diferença mediana ~5–6° (SPPO e BRT). No BRT o campo às vezes vem vazio.
Ordem de escolha do `rumo` (`src/lib/veiculo.ts`):
1. `gps`: veículo em movimento (≥ **3 km/h**) com `direcao` válida;
2. `deslocamento`: rumo entre a leitura mais antiga dos últimos **5 min** e a atual, se andou ≥ **30 m**;
3. `anterior`: parado — mantém o último rumo em movimento (não gira parado);
4. sem nada disso → `rumo: null` e o marcador fica sem seta (não inventamos direção).
A animação gira pelo menor ângulo (359° → 1° gira 2°, não 358°). Parâmetros 3 km/h, 30 m e 5 min: EXPERIMENTAL / ESCOLHA DO SISTEMA.

## Estações e terminais de BRT (`/estacoes`)
Catálogo **oficial** (Data.Rio, camada "Estações BRT"), salvo em `src/data/estacoes-brt.json` por `npm run estacoes:atualizar`.
A busca de BRT procura só nesse catálogo (nunca endereços). Itens com prefixo "FUTURO" viram `status: "planejada"`.
Abreviações do nome ("Jd.", "Sta.") são expandidas só para exibição e busca.
`/estacoes/{id}`: linhas vistas a até **300 m** nos últimos **60 min** (EXPERIMENTAL / ESCOLHA DO SISTEMA) e próximos veículos pela mesma estimativa de `/chegada`.

## Trajeto da linha no mapa (`/linhas/{linha}/trajeto`) — só BRT
Trajetos **planejados** do GTFS oficial da SMTR (`https://dados.mobilidade.rio/gtfs/schedule`, BRT = `route_type 702`),
salvos em `src/data/trajetos-brt.json` por `npm run trajetos:atualizar` (pontos simplificados com tolerância de **4 m** — EXPERIMENTAL / ESCOLHA DO SISTEMA).
No mapa, o marcador do BRT é **encaixado** no trajeto quando o GPS está a até **60 m** dele (EXPERIMENTAL / ESCOLHA DO SISTEMA), e a animação
entre duas leituras anda pela via. Isso é só exibição: a posição observada (`lat`, `lng` da API) continua a do GPS. Longe do trajeto → mostra o GPS cru.
O destino do veículo escolhe o sentido (trip_headsign); sem destino, usa o trajeto mais próximo.
Veículo **parado** a mais de **300 m** do trajeto da linha é tratado como fora de operação (garagem/pátio) e sai da frota de `/linhas/{linha}/veiculos`
(contado em `foraDeOperacao.n`). EXPERIMENTAL / ESCOLHA DO SISTEMA: em 02/10/2026 vários BRT da linha 10, quase todos com ignição desligada, apareciam parados num mesmo ponto a ~2,7 km do corredor.

## Linhas de uma estação de BRT (`/estacoes/{id}`)
BRT com GPS a até **300 m** e ônibus (SPPO) a até **150 m** da estação nos últimos 60 min (EXPERIMENTAL / ESCOLHA DO SISTEMA). Não é a lista oficial.

## Chuva (`/chuva`)
Valores **medidos** pelos pluviômetros do Alerta Rio, repassados como vieram (mm acumulados em 5, 10, 15 min e 1, 4, 24, 96 h).
Escolhemos as `k` estações mais próximas (haversine, padrão 3). Não há interpolação para o seu ponto nem classificação de intensidade.

## Previsão (`/tempo`)
FONTE EXTERNA: Open-Meteo (modelo numérico). Repassamos condição atual (temperatura, sensação, umidade, vento), 24 h e 7 dias. Busca de locais do Clima: geocodificação Open-Meteo e endereços do IPP (`/locais`, `/local-reverso`).

## Limitações
- Velocidade de ônibus ≠ velocidade do tráfego geral; faixa exclusiva pode deixar o ônibus rápido com a via parada (e vice-versa).
- Velocidade instantânea do GPS, sem checagem cruzada com o deslocamento entre leituras.
- Unidade km/h presumida pelos valores; não achamos documento oficial confirmando isso para o feed ao vivo.
- Raio circular: mistura sentidos e vias vizinhas (ex.: os dois pontos da Av. das Américas estão a ~60 m um do outro e compartilham leituras).
- Poucos veículos em alguns pontos/horários → média instável. Sempre olhar `nVeiculos` e `nLeiturasMovimento`.
- Linha Vermelha: quase sem ônibus municipais no teste — tende a "sem dado".
- O agendador do GitHub Actions pode atrasar ou pular execuções; os buracos aparecem como buckets ausentes.
- O "habitual" só fica significativo depois de algumas semanas de coleta.
