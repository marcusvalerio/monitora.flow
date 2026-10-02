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

## 4. Chuva medida — Alerta Rio (TESTADO, funcionando)
- **URL:** `https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml` — XML público, atualizado a cada ~5 min (cabeçalho `Last-Modified`).
- Testado em 02/10/2026 03:31 UTC: HTTP 200, 33 estações. (O teste anterior do projeto, de outra rede, havia sido recusado; pode haver bloqueio por origem.)
- Campos: `estacao@id`, `@nome`, `@type` (`plv` pluviômetro, `met` meteorológica); `localizacao@latitude/@longitude/@bacia`;
  `chuvas@m05/m10/m15/h01/h04/h24/h96/mes` (mm acumulados) e `chuvas@hora`. **Horários em Brasília, sem fuso** — convertidos para UTC (−03:00).
- `websempre.rio.rj.gov.br/json/chuvas`: "Request Rejected" em 02/10/2026 — não usado.
- Não guardamos histórico de chuva ainda (repassamos o dado ao vivo, com cache de 2 min).

## 5. Previsão — Open-Meteo (FONTE EXTERNA, TESTADO)
- `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=…&hourly=…` — sem chave. Testado em 02/10/2026: HTTP 200.
- Licença dos dados: CC BY 4.0; o plano gratuito é para uso não comercial (https://open-meteo.com/en/terms). Atribuição exibida no app.
- INMET (`apitempo.inmet.gov.br`): sem resposta em 02/10/2026 — não usado.

## 6. Geocodificação — IPP / Prefeitura (TESTADO)
- `https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geocode/Geocode_Logradouros_WGS84/GeocodeServer/findAddressCandidates?SingleLine=…&f=json`
- Teste: "Avenida das Américas 2000" → −23,000264 / −43,335547, nota 100. Exposto em `/geocodificar` (cache de 1 dia).

## 7. Mapa — OpenStreetMap via OpenFreeMap (FONTE EXTERNA)
- Estilo `https://tiles.openfreemap.org/styles/liberty`, sem chave. Atribuição "© OpenStreetMap" obrigatória (exibida). Renderização com MapLibre GL JS.

## 8. Ocorrências do COR — SEM FONTE ABERTA AO VIVO
- `https://api.dados.rio/v2/adm_cor_comando/ocorrencias_abertas/`: HTTP 503 em 02/10/2026.
- Histórico: `datario.adm_cor_comando.ocorrencias` (BigQuery, exige conta Google) — não integrado. `/ocorrencias` responde `disponivel: false`.

## 9. Radares CET-Rio / CIVITAS / PIT — NÃO USADOS
Exigem autenticação. Ficam de fora até haver autorização formal (pedido via LAI em andamento). O desenho já separa fontes por `fonte`
(`brt`, `sppo`); uma fonte `radar` pode entrar como nova tabela de leituras + os mesmos agregados por ponto.

## 10. Trajetos e paradas (GTFS) — NÃO INTEGRADO AINDA
- Camadas abertas verificadas: `https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson` (HTTP 200, versão 2024-09-29).
- Próximo passo: usar trajetos (`itinerario.geojson` / GTFS) para a chegada seguir a rua e filtrar por sentido.

## Fixtures de teste
`tests/fixtures/brt.json` e `sppo.json` são recortes de respostas reais de 02/10/2026 03:19 UTC, com as placas trocadas por `TST0000…`.
`alertario-chuvas.xml` e `open-meteo.json` são respostas completas de 02/10/2026 (~03:31 UTC).
Para atualizar as do GPS: `npm run fixtures:capturar` (e ajustar `AGORA_FIXTURE` em `tests/fontes.test.ts`).
