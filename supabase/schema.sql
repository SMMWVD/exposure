create extension if not exists pgcrypto;

create table if not exists public.performances (
  id text primary key,
  date date not null,
  start time not null,
  "end" time not null,
  title text not null,
  student text not null,
  location text not null,
  capacity integer not null check (capacity > 0),
  description text default '',
  manage_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  performance_id text not null references public.performances(id) on delete cascade,
  name text not null,
  email text default '',
  created_at timestamptz not null default now()
);

create index if not exists performances_date_start_idx on public.performances (date, start);
create index if not exists signups_performance_id_idx on public.signups (performance_id);

alter table public.performances enable row level security;
alter table public.signups enable row level security;

-- The Node server uses the Supabase service role key, which bypasses RLS.
-- Keep anon/client access disabled so visitors cannot write directly to the database.
