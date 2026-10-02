# Dicionário de dados

Unidades: velocidade em km/h, distância em metros, horários em ISO 8601 UTC (sufixo `Z`), chuva em mm.
Na API, `null` = **sem dado** (nunca zero por omissão).

## Banco (PostgreSQL / Neon)

### `posicoes` — OBSERVADO, retenção 60 min
| Coluna | Tipo | Descrição |
|---|---|---|
| `fonte` | text | `brt` ou `sppo` |
| `veiculo` | text | código do veículo na frota (BRT `codigo`, SPPO `id_veiculo`). **Não é placa** |
| `ts` | timestamptz | instante da posição (GPS) |
| `lat`, `lng` | double | WGS84 |
| `velocidade` | real | km/h, como veio da fonte |
| `linha` | text | BRT `linha` / SPPO `servico` |
| `sentido` | text | como veio da fonte (`ida`/`volta`, `I`/`V`, vazio) |
| `recebido_em` | timestamptz | quando gravamos |
Chave: (`fonte`, `veiculo`, `ts`).

### `agregados` — CALCULADO, retenção 183 dias
| Coluna | Descrição |
|---|---|
| `ponto` | id do ponto (`src/config/pontos.ts`) |
| `fonte` | `brt` / `sppo` |
| `bucket` | início da janela de 5 min (UTC) |
| `n_veiculos` | veículos distintos |
| `n_leituras` | leituras no raio |
| `n_leituras_movimento` | leituras com velocidade > 0 |
| `velocidade_media`, `velocidade_mediana` | das leituras em movimento; null se nenhuma |
| `proporcao_parados` | (n_leituras − n_leituras_movimento) / n_leituras |
| `linhas`, `sentidos` | listas distintas |
Chave: (`ponto`, `fonte`, `bucket`). Fórmulas: `docs/METODOLOGIA.md`.

### `coletas` — registro de cada execução
`inicio`, `fim`, `sppo_de`, `sppo_ate` (null se o SPPO falhou), `n_brt`, `n_sppo`, `descartadas` (contagem por motivo), `erros`.

## API
Toda resposta: `fonte` (nome + URLs), `aviso` (nos endpoints de velocidade) e blocos `observado` / `calculado` / `interpretado`.
Especificação completa: `GET /openapi` (OpenAPI 3.1).

### `/agora`
| Campo | Camada | Descrição |
|---|---|---|
| `consulta` | — | `lat`, `lng`, `raioM`, `janelaMin`, `ponto` |
| `atualizadoEm` | — | fim da última coleta |
| `leituraMaisRecente` | observado | horário da leitura de GPS mais nova no raio |
| `nVeiculos`, `velocidadeMedia` | calculado | atalhos de `calculado.total` |
| `calculado.{brt,sppo,total}` | calculado | `nVeiculos`, `nLeituras`, `nLeiturasMovimento`, `velocidadeMedia`, `velocidadeMediana`, `proporcaoParados`, `linhas`, `sentidos` |
| `interpretado` | interpretado | null, ou `pontoReferencia`, `diaSemana`, `hora` e por fonte: `velocidadeMediaAgora`, `habitual {mediana,p25,p75,nDias}`, `situacao` |

`situacao` ∈ `abaixo_da_faixa_habitual`, `dentro_da_faixa_habitual`, `acima_da_faixa_habitual`, `sem_dado`, `historico_insuficiente`.

### `/historico`
`calculado[]`: `fonte`, `inicio`, mais as colunas de `agregados` em camelCase.

### `/habitual`
`calculado.{brt,sppo}`: `nDias`, `mediana`, `p25`, `p75`, `dias[]` (`data`, `velocidadeMedia`, `nLeiturasMovimento`), `diasConsultados`, `diasMinimosParaComparar`, `incluiHoje` (sempre false).

### `/linhas/{linha}/veiculos`
`observado[]`: `fonte`, `veiculo`, `sentido`, `lat`, `lng`, `velocidadeKmh`, `em`, `idadeS`.

### `/chegada`
`avisoChegada`, `observado.veiculosNaLinha`, `calculado.chegadas[]` / `calculado.proxima`: `fonte`, `veiculo`, `linha`, `sentido`, `lat`, `lng`, `distanciaM` (linha reta), `velocidadeAproximacaoKmh`, `etaMin`, `ultimaLeitura`.

### `/chuva`
`atualizadoEm` (geração do XML), `observado[]`: `id`, `nome`, `bacia`, `lat`, `lng`, `medidoEm`, `distanciaM`, `mm {m05,m10,m15,h01,h04,h24,h96,mes}`.

### `/tempo`
`calculado.agora {em, temperaturaC, precipitacaoMm, codigoWmo}`, `calculado.proximasHoras[] {inicio, temperaturaC, probabilidadeChuvaPct, precipitacaoMm}`.

### `/geocodificar`
`candidatos[] {endereco, nota, lat, lng}`.

### `/ocorrencias`
`disponivel: false`, `motivo`.
