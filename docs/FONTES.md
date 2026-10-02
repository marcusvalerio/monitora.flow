# Fontes de dados

Todas públicas, sem login. Verificadas em **02/10/2026** (~03h UTC). Nada de scraping nem contorno de autenticação.

## 1. BRT — posição ao vivo
- **URL:** `https://dados.mobilidade.rio/gps/brt` (resposta JSON com gzip)
- **Formato:** `{ "veiculos": [ ... ] }`, ~860 itens por chamada.
- **Achado em 02/10/2026:** o feed devolve a *última posição conhecida* de cada veículo, inclusive de veículos parados há dias ou anos (vimos `dataHora` de 2000 e de 2025). Numa chamada, só ~290 de 864 tinham posição dos últimos 5 min. Por isso descartamos leituras com mais de `BRT_IDADE_MAX_MIN` (5 min).

| Campo | Uso aqui |
|---|---|
| `codigo` | código do veículo na frota; guardado só na tabela bruta (retenção 60 min) para deduplicar e contar veículos distintos |
| `placa` | **descartada na ingestão, nunca persistida** (o schema zod não declara o campo) |
| `linha` | guardada (lista de linhas nos agregados) |
| `latitude`, `longitude` | graus decimais (WGS84, presumido) |
| `dataHora` | epoch em **milissegundos** (UTC) |
| `velocidade` | km/h (unidade não confirmada em documentação oficial — ver Limitações) |
| `sentido` | `ida`/`volta` |
| `trajeto`, `hodometro`, `direcao`, `ignicao`, `capacidade*`, `id_migracao_trajeto` | não usados, não guardados |

## 2. Ônibus municipais (SPPO) — janela de tempo
- **URL:** `https://dados.mobilidade.rio/gps/sppo?dataInicial=YYYY-MM-DD+HH:MM:SS&dataFinal=YYYY-MM-DD+HH:MM:SS`
- Os dois parâmetros são obrigatórios (sem eles: HTTP 500).
- **Fuso confirmado em 02/10/2026:** o servidor filtra por `datetime_servidor` em **UTC**. Pedindo `03:00:00`–`03:03:00`, todos os itens vieram com `datetime_servidor` entre `03:00:00Z` e `03:02:59Z`. Já `datetime` (instante do GPS) pode estar até ~20 min antes — as leituras chegam atrasadas.
- ~8.600 itens a cada 3 min.

| Campo | Uso aqui |
|---|---|
| `id_veiculo` | como `codigo` do BRT |
| `servico` | linha; `FORA DE OP` é descartado |
| `sentido` | guardado |
| `latitude`, `longitude` | podem vir como número ou string — convertidos |
| `velocidade` | km/h |
| `datetime` | instante da posição (UTC) — é o que usamos como `ts` |
| `direcao`, `route_id`, `trip_id`, `shape_id`, `datetime_envio`, `datetime_servidor` | não guardados |

## 3. Histórico oficial (opcional, para validação)
BigQuery público da Prefeitura, projeto `datario` (exige conta Google, cota gratuita):
- `datario.transporte_rodoviario_municipal.gps_onibus` (`velocidade_instantanea`, `velocidade_estimada_10_min`)
- `datario.transporte_rodoviario_municipal.gps_brt`

Documentação: https://github.com/prefeitura-rio/queries-datario (`models/transporte_rodoviario_municipal/schema.yml`).
Captura da SMTR (referência): https://github.com/prefeitura-rio/pipelines_rj_smtr e https://github.com/prefeitura-rio/queries-rj-smtr.

Ainda **não** integrado a este projeto.

## Onde foram encontradas
- Catálogo Data.Rio (https://datariov2-pcrj.hub.arcgis.com/): "Histórico de GPS dos ônibus (SPPO) / do BRT" e "API de Rastreamento e Localização da Frota de Ônibus Urbanos (Sistema RIO) [beta]" (PDF).
- Endpoints testados diretamente.
- Repositórios da organização https://github.com/prefeitura-rio.

## Fixtures de teste
`tests/fixtures/*.json` são recortes de respostas reais de 02/10/2026 03:19 UTC, com as placas trocadas por `TST0000…`.
Para atualizar: `npm run fixtures:capturar` (e ajustar `AGORA_FIXTURE` em `tests/fontes.test.ts`).
