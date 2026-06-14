-- Internetree shared state. All tables are RLS-locked with NO policies, so the anon key
-- cannot touch them directly — only the `tree` Edge Function (service role) reads/writes.
-- The Edge Function runs the SAME engine as the client and stamps its own server time.

-- The one canonical tree. Single row (id = 1). `version` drives optimistic concurrency.
create table if not exists public.tree (
  id      int primary key default 1,
  state   jsonb not null,
  version int not null default 0,
  constraint tree_singleton check (id = 1)
);
alter table public.tree enable row level security;

-- Fallen generations (the graveyard / timeline). Stores the full dead TreeState.
create table if not exists public.graveyard (
  generation int primary key,
  state      jsonb not null
);
alter table public.graveyard enable row level security;

-- Recent tends — powers the keeper count, the motes, and (with buckets) rate limiting.
create table if not exists public.tends (
  id     bigint generated always as identity primary key,
  device text   not null,
  at     bigint not null
);
create index if not exists tends_at_idx on public.tends (at);
alter table public.tends enable row level security;

-- Per-device "watering can" token bucket (server-owned rate limit).
create table if not exists public.buckets (
  device  text   primary key,
  tokens  real   not null,
  at      bigint not null
);
alter table public.buckets enable row level security;

-- No seed here: the Edge Function's readTree() plants generation 1 via the engine's
-- createTree() on first contact (SSOT — a SQL copy of TreeState would drift the
-- moment the engine's shape or defaults change).
