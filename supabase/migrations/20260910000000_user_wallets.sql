-- ShTrader wallet linkage: Supabase user <-> EVM wallets (Privy embedded + MetaMask).
-- Supabase Auth remains the primary app identity. Privy is a non-custodial
-- signer only. No private keys, seeds, or secrets are stored here — only
-- public addresses plus provider metadata.
-- HIGH-RISK note: run `supabase db push` (or apply via dashboard) to apply.
-- Read-only review: this file only creates a table + RLS; no existing tables touched.

create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null,
  source text not null check (source in ('embedded', 'injected')),
  chain_id integer,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, address)
);

create index if not exists idx_user_wallets_user_id on public.user_wallets (user_id);
create index if not exists idx_user_wallets_address on public.user_wallets (address);

alter table public.user_wallets enable row level security;

-- Owner-only access: a user can read/insert/update/delete only their own rows.
drop policy if exists "user_wallets_select_own" on public.user_wallets;
create policy "user_wallets_select_own" on public.user_wallets
  for select using (auth.uid() = user_id);

drop policy if exists "user_wallets_insert_own" on public.user_wallets;
create policy "user_wallets_insert_own" on public.user_wallets
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_wallets_update_own" on public.user_wallets;
create policy "user_wallets_update_own" on public.user_wallets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_wallets_delete_own" on public.user_wallets;
create policy "user_wallets_delete_own" on public.user_wallets
  for delete using (auth.uid() = user_id);
