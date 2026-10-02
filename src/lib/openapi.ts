import { AVISO, AVISO_CHEGADA } from "./parametros";

const num = { type: "number" };
const q = (name: string, description: string, required = false, schema: object = { type: "string" }) => ({ name, in: "query", required, description, schema });
const lat = q("lat", "Latitude (WGS84)", true, num);
const lng = q("lng", "Longitude (WGS84)", true, num);
const ponto = q("ponto", "id de um ponto configurado (ver /pontos)");
const resp = (d: string) => ({ "200": { description: d, content: { "application/json": { schema: { type: "object" } } } }, "400": { description: "parâmetro inválido" } });

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "monitora.flow",
    version: "0.2.0",
    description: `API aberta (sem autenticação) com dados de GPS de BRT/ônibus, chuva e previsão no Rio de Janeiro.\n\n${AVISO}\n\nToda resposta separa \`observado\`, \`calculado\` e \`interpretado\`. Sem dado → null. Metodologia: docs/METODOLOGIA.md. Dicionário: docs/DICIONARIO.md.`,
  },
  paths: {
    "/agora": { get: { summary: "Velocidade e veículos agora numa coordenada ou ponto", parameters: [q("lat", "Latitude", false, num), q("lng", "Longitude", false, num), ponto, q("raio", "Raio em metros (padrão 400, máx. 2000)", false, num), q("janela", "Janela em minutos (padrão 15, máx. 60)", false, num)], responses: resp("Resumo por fonte (brt, sppo, total) e, se houver ponto de referência, comparação com o habitual") } },
    "/now": { get: { summary: "Alias de /agora", deprecated: true, responses: resp("igual a /agora") } },
    "/historico": { get: { summary: "Série de 5 min de um ponto", parameters: [{ ...ponto, required: true }, q("de", "ISO 8601 (padrão: 24 h atrás)"), q("ate", "ISO 8601 (padrão: agora)"), q("fonte", "brt | sppo")], responses: resp("Buckets com dado; buckets sem leitura não aparecem") } },
    "/habitual": { get: { summary: "Distribuição habitual (mediana, p25, p75, nº de dias)", parameters: [{ ...ponto, required: true }, q("diaSemana", "0=domingo … 6=sábado (padrão: hoje)", false, { type: "integer" }), q("hora", "0–23, horário de Brasília (padrão: agora)", false, { type: "integer" }), q("dias", "Últimos N dias (padrão 28)", false, { type: "integer" })], responses: resp("Por fonte") } },
    "/linhas/{linha}/veiculos": { get: { summary: "Última posição dos veículos de uma linha (sem placa)", parameters: [{ name: "linha", in: "path", required: true, schema: { type: "string" }, description: "Ex.: 22 (BRT) ou 917 (SPPO)" }], responses: resp("Posições dos últimos 10 min") } },
    "/chegada": { get: { summary: "Estimativa EXPERIMENTAL de chegada", description: AVISO_CHEGADA, parameters: [q("linha", "Linha", true), lat, lng], responses: resp("Até 5 veículos vindo, ordenados por ETA") } },
    "/chuva": { get: { summary: "Chuva medida (pluviômetros Alerta Rio)", parameters: [q("lat", "Latitude", false, num), q("lng", "Longitude", false, num), q("k", "Nº de estações mais próximas (padrão 3)", false, { type: "integer" })], responses: resp("mm acumulados em 5/10/15 min e 1/4/24/96 h") } },
    "/tempo": { get: { summary: "Previsão (Open-Meteo, FONTE EXTERNA)", parameters: [lat, lng], responses: resp("Agora + próximas 6 h") } },
    "/monitor/dados": { get: { summary: "Retrato da operação: frota observada, estados geográficos do BRT, qualidade dos dados, chuva", responses: resp("observado, chuva, ocorrencias, pontos") } },
    "/linhas": { get: { summary: "Linhas com veículo transmitindo GPS agora (?q=, ?fonte=brt|sppo)", responses: resp("linhas") } },
    "/linhas/{linha}/trajeto": { get: { summary: "Trajeto oficial da linha de BRT (GTFS SMTR)", responses: resp("trajetos") } },
    "/ocorrencias": { get: { summary: "Ocorrências do COR — ainda sem fonte aberta", responses: resp("disponivel=false") } },
    "/geocodificar": { get: { summary: "Endereço → coordenada (geocodificador oficial IPP)", parameters: [q("q", "Endereço", true)], responses: resp("Candidatos com nota") } },
    "/paradas": { get: { summary: "Busca de paradas e estações de ônibus/BRT (camada aberta da Prefeitura)", parameters: [q("q", "Nome (sem acento/caixa)"), q("lat", "Latitude", false, num), q("lng", "Longitude", false, num), q("raio", "Raio em m sem 'q' (padrão 500)", false, num), q("limite", "Máx. de resultados (padrão 20)", false, { type: "integer" })], responses: resp("Paradas, ordenadas por relevância ou distância") } },
    "/paradas/{id}/linhas": { get: { summary: "Linhas com GPS perto da parada na última hora (EXPERIMENTAL)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: resp("Linhas e nº de veículos") } },
    "/pontos": { get: { summary: "Pontos configurados e parâmetros", responses: resp("Lista") } },
  },
};
