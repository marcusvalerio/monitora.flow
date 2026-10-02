# monitora.flow

Coletor + banco + API do **GPS dos BRTs e ônibus municipais do Rio** (SMTR), para o [MOVA](https://github.com/marcusvalerio/MOVA).

> ⚠️ É a **velocidade dos ônibus/BRTs**, um indicador indireto. **Não** é velocidade dos carros nem contagem de veículos da via.

- Fontes, campos e o que foi verificado: [`docs/FONTES.md`](docs/FONTES.md)
- Fórmulas, escolhas experimentais e limitações: [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md)
- Parâmetros (raio, janelas, filtros): [`src/lib/parametros.ts`](src/lib/parametros.ts)
- Pontos de interesse: [`src/config/pontos.ts`](src/config/pontos.ts)

## Arquitetura
```
GitHub Actions (*/5 min) ──► /api/coletar (Vercel) ──► dados.mobilidade.rio/gps/{brt,sppo}
                                   │  valida (zod), descarta placa, filtra
                                   ▼
                     Postgres (Neon/Supabase)
                     ├─ posicoes   (observado, 60 min)
                     ├─ agregados  (calculado, ponto × fonte × 5 min, 183 dias)
                     └─ coletas    (log)
                                   ▲
MOVA ──► /now  /historico  /habitual  /pontos
```

## API
| Endpoint | Descrição |
|---|---|
| `GET /now?lat=&lng=&raio=&janela=` | situação nas últimas 15 min em qualquer coordenada |
| `GET /now?ponto=<id>` | idem para um ponto configurado + comparação com o habitual (`interpretado`) |
| `GET /historico?ponto=&de=&ate=&fonte=` | série de buckets de 5 min (ISO 8601, máx. 31 dias; padrão: últimas 24 h) |
| `GET /habitual?ponto=&diaSemana=0..6&hora=0..23&dias=28` | mediana, p25, p75 e nº de dias, por fonte |
| `GET /pontos` | pontos e parâmetros em uso |

Toda resposta traz `fonte`, `aviso` e separa `observado` / `calculado` / `interpretado`. Sem dado → `null`.

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrar            # cria as tabelas
npm run coletar              # uma coleta manual
npm run dev                  # http://localhost:3000/now?ponto=americas-2000
npm test                     # testes com fixtures reais
```

## Implantar
1. Crie um banco Postgres gratuito (Neon ou Supabase) e rode `npm run db:migrar` com a `DATABASE_URL` dele.
2. Importe o repositório na Vercel; defina `DATABASE_URL` e `CRON_SECRET`.
3. No GitHub, em *Settings → Secrets → Actions*, crie `COLETOR_URL` (ex.: `https://monitora-flow.vercel.app`) e `CRON_SECRET`.
4. O workflow `coletar` passa a rodar a cada 5 min (o plano Hobby da Vercel só tem cron diário).

Volume esperado: ~170 mil linhas em `posicoes` (janela móvel de 1 h) e até 8 pontos × 2 fontes × 288 buckets/dia × 183 dias ≈ 840 mil linhas em `agregados` (~100–150 MB), dentro do plano gratuito.
