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
create index if not exists posicoes_linha_ts on posicoes (linha, ts);

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

-- Avisos de "ônibus chegando" (notificação no celular). Sem dado pessoal além da assinatura de push
-- do navegador (endpoint opaco). Expira sozinho em 90 min; linhas antigas são apagadas pelo vigia.
create table if not exists avisos (
  id          text        primary key,
  assinatura  jsonb       not null,             -- PushSubscription do navegador
  linha       text        not null,
  lat         double precision not null,
  lng         double precision not null,
  ponto_nome  text        not null,
  sentido     text,
  etapa       smallint    not null default 0,   -- 0 criado, 1 acompanhando, 2 ≤ 5 min, 3 chegando (fim)
  ultimo_eta  real,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '90 minutes',
  ativo       boolean     not null default true
);
create index if not exists avisos_ativos on avisos (ativo, expira_em);
-- Um único vigia por vez confere os avisos (lease de ~5 min).
create table if not exists avisos_vigia (id smallint primary key default 1, ate timestamptz not null default 'epoch');
insert into avisos_vigia (id) values (1) on conflict do nothing;
