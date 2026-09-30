-- ============================================================
-- NOUS Excellence — Schema Postgres (Supabase)
-- ------------------------------------------------------------
-- Como aplicar:
--   Opção A) Painel Supabase > SQL Editor > cole este arquivo > Run.
--   Opção B) Adicione SUPABASE_DB_URL no .env e rode: npm run db:push:supabase
--
-- Todas as instruções são idempotentes (create ... if not exists),
-- então pode rodar de novo sem quebrar nada.
-- ============================================================

-- ---------- Usuários / acesso ----------
create table if not exists public.users (
  id            bigint generated always as identity primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('rt','cozinha','gestor')),
  created_at    timestamptz not null default now()
);

-- ---------- Configurações gerais (chave/valor) ----------
create table if not exists public.settings (
  key   text primary key,
  value text
);

-- ---------- Cardápio mensal ----------
create table if not exists public.menus (
  id        bigint generated always as identity primary key,
  date      date not null unique,
  published boolean not null default false
);

create table if not exists public.menu_items (
  id       bigint generated always as identity primary key,
  menu_id  bigint not null references public.menus(id) on delete cascade,
  name     text not null,
  position integer not null default 0
);

-- ---------- Fichas técnicas ----------
create table if not exists public.sheets (
  id          bigint generated always as identity primary key,
  prep        text not null,
  cat         text,
  ingredients text not null,
  yield       text not null,
  cost        numeric(12,2) not null default 0,
  method      text not null,
  rev         text,
  obs         text
);

-- ---------- Produção do dia (por data + preparação) ----------
create table if not exists public.production (
  id   bigint generated always as identity primary key,
  date date not null,
  prep text not null,
  qty  numeric(6,2) not null default 0,
  unique (date, prep)
);

-- ---------- Documentos ----------
create table if not exists public.docs (
  id          bigint generated always as identity primary key,
  type        text not null,
  expiry      date,
  filename    text,
  stored_name text,
  mime        text,
  size        bigint,
  data        bytea,            -- conteudo do arquivo (serverless-friendly)
  created_at  timestamptz not null default now()
);

-- Para instalacoes que criaram a tabela docs antes da coluna data:
alter table public.docs add column if not exists data bytea;

-- ---------- Funcionários ----------
create table if not exists public.employees (
  id            bigint generated always as identity primary key,
  name          text not null,
  job           text not null,
  admission     date,
  course        boolean not null default false,
  course_expiry date,
  health        boolean not null default false,
  health_expiry date
);

-- ---------- Qualidade: temperaturas ----------
create table if not exists public.temps (
  id     bigint generated always as identity primary key,
  dt     text not null,
  type   text not null,
  place  text not null,
  value  numeric(6,2) not null,
  status text not null
);

-- ---------- Qualidade: amostras ----------
create table if not exists public.samples (
  id   bigint generated always as identity primary key,
  date text not null,
  prep text not null,
  time text not null
);

-- ---------- Custos fixos/operacionais (linha única id=1) ----------
create table if not exists public.fixed_costs (
  id        integer primary key check (id = 1),
  labor     numeric(12,2) not null default 0,
  rent      numeric(12,2) not null default 0,
  utilities numeric(12,2) not null default 0,
  taxes     numeric(12,2) not null default 0,
  other     numeric(12,2) not null default 0,
  days      integer not null default 26
);

-- ---------- Dados gerenciais diários ----------
create table if not exists public.daily (
  id            bigint generated always as identity primary key,
  date          date not null unique,
  clients       integer not null default 0,
  price         numeric(12,2) not null default 0,
  other_revenue numeric(12,2) not null default 0,
  food          numeric(12,2)
);

-- ---------- Índices auxiliares ----------
create index if not exists idx_menu_items_menu on public.menu_items(menu_id);
create index if not exists idx_production_date on public.production(date);
create index if not exists idx_daily_date      on public.daily(date);

-- ---------- Garante a linha única de custos fixos ----------
insert into public.fixed_costs (id, labor, rent, utilities, taxes, other, days)
values (1, 0, 0, 0, 0, 0, 26)
on conflict (id) do nothing;

-- ============================================================
-- SEGURANÇA (Row Level Security)
-- ------------------------------------------------------------
-- Habilita RLS em todas as tabelas. Sem políticas, a chave
-- publishable/anon NÃO consegue ler nem escrever nada — o que é
-- o correto para este app, cujo backend deve acessar o banco com
-- a SERVICE_ROLE key (que ignora RLS) ou pela connection string.
--
-- Se você for acessar direto do frontend com a chave publishable,
-- será necessário criar políticas específicas por tabela.
-- ============================================================
alter table public.users       enable row level security;
alter table public.settings    enable row level security;
alter table public.menus       enable row level security;
alter table public.menu_items  enable row level security;
alter table public.sheets      enable row level security;
alter table public.production  enable row level security;
alter table public.docs        enable row level security;
alter table public.employees   enable row level security;
alter table public.temps       enable row level security;
alter table public.samples     enable row level security;
alter table public.fixed_costs enable row level security;
alter table public.daily       enable row level security;
