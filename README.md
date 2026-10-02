# monitora.flow — Meu trajeto

Coletor + banco + API + app (PWA) com dados abertos do Rio de Janeiro: **GPS dos BRTs e ônibus** (SMTR),
**chuva medida** (Alerta Rio), **previsão** (Open-Meteo) e **geocodificação** (IPP). A API também serve o [MOVA](https://github.com/marcusvalerio/MOVA).

> ⚠️ A velocidade é a dos **ônibus/BRTs**, um indicador indireto. **Não** é a velocidade dos carros nem a contagem de veículos da via.
> A chegada do ônibus é uma **estimativa experimental nossa**, não um horário oficial.

- Fontes testadas, licenças e o que ficou de fora: [`docs/FONTES.md`](docs/FONTES.md)
- Fórmulas, escolhas experimentais e limitações: [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md)
- Campos do banco e da API: [`docs/DICIONARIO.md`](docs/DICIONARIO.md) · OpenAPI em `GET /openapi`
- Parâmetros: [`src/lib/parametros.ts`](src/lib/parametros.ts) · Pontos monitorados: [`src/config/pontos.ts`](src/config/pontos.ts)

## Arquitetura
```
Neon Function Trigger (cron */10, UTC)
   └─► função "disparador" (Neon Functions) ─► POST /api/coletar (Vercel)
                                                 │ GPS BRT + SPPO: valida (zod), descarta placa, filtra
                                                 ▼
                                Postgres Neon (projeto monitora-flow, us-east-1)
                                ├─ posicoes   observado, 60 min
                                ├─ agregados  calculado, ponto × fonte × 5 min, 183 dias
                                └─ coletas    log
                                                 ▲
App "Meu trajeto" (/) e MOVA ──► /agora /historico /habitual /linhas/{l}/veiculos /chegada
                                 /chuva /tempo /geocodificar /ocorrencias /pontos /openapi
                                 (chuva, tempo e geocodificação são repassados ao vivo, com cache)
```

## App "Meu trajeto" (`/`)
PWA instalável, mobile-first, claro/escuro. Trajetos favoritos ficam **só no aparelho** (localStorage), sem cadastro.
Blocos: 🚌 chegada da linha · 🚗 velocidade dos ônibus no local e comparação com o habitual · 🌧️ chuva medida e previsão · ⚠️ ocorrências (sem fonte aberta ainda) · 🗺️ mapa MapLibre/OpenStreetMap com os ônibus da linha e os pluviômetros.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # DATABASE_URL e CRON_SECRET
npm run db:migrar            # cria as tabelas
npm run coletar              # uma coleta manual
npm run dev                  # http://localhost:3000
npm test                     # testes com fixtures reais
```

## Implantação atual
- **Banco:** Neon, projeto `monitora-flow` (us-east-1). Esquema em `db/schema.sql`.
- **Web/API:** Vercel, com `DATABASE_URL` e `CRON_SECRET` nas variáveis do projeto.
- **Agendador:** Neon Function `disparador` (`functions/disparador.ts`) + Function Trigger cron `*/10 * * * *`.
  Variáveis da função: `COLETOR_URL`, `CRON_SECRET`. Para redistribuir: `npx esbuild functions/disparador.ts --bundle --platform=node --format=esm --outfile=dist/index.mjs` e `neon functions deploy disparador --src dist/index.mjs --no-bundle`.
