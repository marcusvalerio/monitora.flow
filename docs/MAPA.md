# Mapa — arquitetura cartográfica

```
DATA (GPS SMTR, GTFS)  →  DOMAIN (src/lib/brt.ts, onibus.ts, catalogo.ts)  →  GEOMETRY (src/lib/trajeto.ts, matching.ts)
→  MAP (app/map/engine.ts, estilo.ts, transporte.ts)  →  UI (app/mobilidade, app/monitor)  →  MOTION (app/ui/motion.ts)  →  IDENTITY (globals.css)
```

## Motor (`app/map/engine.ts`)
`criarMapa()` cria todo mapa do Monitora com o mesmo estilo, sem rotação/inclinação (marcadores e setas dependem do norte para cima)
e liga a água viva. Camadas, de baixo para cima:
1. **MapBaseLayer** — `app/map/estilo.ts`: estilo próprio (claro/escuro) no esquema OpenMapTiles. Sem POIs nem ícones.
   Hierarquia: água (identidade azul-teal) → verde/relevo → vias secundárias → vias principais → rótulos de bairro (caixa alta espaçada, a partir do z11,5)
   → nomes de grandes vias (só z ≥ 14).
2. **Água viva** — `aguaViva()` em `app/ui/motion.ts` (textura sobre `water`).
3. **MapTransportLayer** — `app/map/transporte.ts`: `route-base` (borda), `route-active` (teal), `route-direction` (setas na ordem do shape = sentido da viagem),
   `route-highlight` (shape do veículo selecionado, Lime), estações (terminal com mais peso), diagnóstico.
4. **MapInteractionLayer** — marcadores DOM de veículo (animados), estação selecionada, "você".
MapWeatherLayer / MapIncidentLayer: reservadas; entram quando houver fonte (ocorrências do COR estão sem API aberta).

## Tiles e política de uso
Tiles vetoriais e fontes do **OpenFreeMap** (`tiles.openfreemap.org`, dados © OpenStreetMap, sem chave, atribuição no canto do mapa).
Não usamos os servidores de tiles do OpenStreetMap.org. Para tráfego maior ou independência total: gerar um **PMTiles** só da região do Rio
(Protomaps/planetiler) e servir de um bucket/CDN — o estilo já está no esquema OpenMapTiles, então troca-se apenas a `url` da fonte `base`.

## Coordenadas
Domínio e API usam `lat`/`lng` nomeados; GeoJSON e MapLibre sempre `[lng, lat]`. Testado em `tests/fase1.test.ts`
(catálogos, parsers e pontos do Monitor). Rotação do marcador = rumo do GPS (0 = norte, horário), sem deslocamento — o mapa não gira.

## Diagnóstico
`/mobilidade?debug=1` (ou desenvolvimento): ao tocar num veículo, painel com vehicle/route/trip/shape, associação, rumo do GPS e do trecho,
Δ rumo, distância, estado e motivo; no mapa, GPS real (vermelho), projeção no shape (teal), distância (tracejado) e shape usado (Lime).
API: `/linhas/{linha}/veiculos?diag=1`.
