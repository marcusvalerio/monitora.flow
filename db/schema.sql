-- monitora.flow — esquema PostgreSQL (Neon/Supabase). Idempotente: pode rodar várias vezes.
-- Nenhuma tabela tem placa. O código do veículo só existe em `posicoes` (retenção curta)
-- para deduplicar e contar veículos distintos.

-- OBSERVADO: posições recebidas, retenção curta (PARAMETROS.RETENCAO_BRUTO_MIN).
create table if not exists posicoes (
  fonte        text        not null check (fonte in ('brt', 'sppo')),
  veiculo      text        not null,
  ts           timestamptz not null,           -- instante da posição (GPS)
  lat          double precision not null,
  lng          double precision not null,
  velocidade   real        not null,           -- km/h, como veio da fonte
  linha        text,
  sentido      text,
  recebido_em  timestamptz not null default now(),
  primary key (fonte, veiculo, ts)
);
create index if not exists posicoes_ts on posicoes (ts);
create index if not exists posicoes_lat_lng on posicoes (lat, lng);

-- CALCULADO: agregados por ponto, fonte e bucket de 5 min. Retenção ~6 meses.
create table if not exists agregados (
  ponto                 text        not null,
  fonte                 text        not null check (fonte in ('brt', 'sppo')),
  bucket                timestamptz not null,  -- início do bucket (UTC)
  n_veiculos            integer     not null,
  n_leituras            integer     not null,
  n_leituras_movimento  integer     not null,
  velocidade_media      real,                  -- null = sem leitura em movimento
  velocidade_mediana    real,
  proporcao_parados     real,
  linhas                text[]      not null default '{}',
  sentidos              text[]      not null default '{}',
  atualizado_em         timestamptz not null default now(),
  primary key (ponto, fonte, bucket)
);
create index if not exists agregados_bucket on agregados (bucket);

-- Registro de cada execução do coletor (auditoria e "atualizadoEm").
create table if not exists coletas (
  id           bigserial primary key,
  inicio       timestamptz not null,
  fim          timestamptz not null default now(),
  sppo_de      timestamptz,
  sppo_ate     timestamptz,
  n_brt        integer not null default 0,
  n_sppo       integer not null default 0,
  descartadas  jsonb   not null default '{}',
  erros        jsonb   not null default '[]'
);
create index if not exists coletas_fim on coletas (fim);
