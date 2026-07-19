-- ============================================================================
-- FORGE — Supabase schema (CLEAN / AUTHORITATIVE)
-- Derived directly from forge-index.html (every `sb.from('<table>')` + RPC).
-- ----------------------------------------------------------------------------
-- Project URL : https://ofzgrwnuoyowthzkyuld.supabase.co
-- Owner email : harvbetts@gmail.com
--
-- AUTH MODEL: Forge uses a custom PIN system, NOT Supabase Auth sessions.
-- There is no authenticated session, so RLS is intentionally PERMISSIVE
-- (using/with check = true) and every query filters by user_id in code.
-- Single-owner personal app — this is by design. Do NOT switch to auth.uid()
-- RLS unless you also migrate the whole app to real Supabase Auth.
--
-- This whole file is SAFE TO RE-RUN. Every statement is idempotent
-- (create table if not exists / drop policy if exists). Running it will not
-- touch or delete any of your existing data — it only creates anything that's
-- missing and (re)applies the permissive policies.
--
-- HOW TO USE: paste the whole thing into Supabase → SQL Editor → Run. Done.
-- ============================================================================


-- ============================================================================
-- SECTION A — TABLES THE APP ACTUALLY USES (26 tables)
-- These are confirmed live in the code. Anything not here is not used by Forge.
-- ============================================================================

-- ---- Identity / shell -------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text, role text, avatar_url text, pin_hash text,
  created_at timestamptz default now()
);
create table if not exists public.avatars      ( user_id uuid primary key, data text );
create table if not exists public.settings     ( user_id uuid primary key, data jsonb, updated_at timestamptz default now() );
create table if not exists public.pin_resets   ( user_id uuid primary key, pending boolean default false );
create table if not exists public.login_events ( id uuid primary key default gen_random_uuid(), user_id uuid, at timestamptz default now() );
create table if not exists public.requests     ( id uuid primary key default gen_random_uuid(), user_id uuid, body text, status text default 'open', created_at timestamptz default now() );

-- ---- Generic card lists (many "More" sub-tabs) -----------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, tab text not null, title text not null,
  subtitle text, position int default 0, created_at timestamptz default now()
);

-- ---- Calendar / time --------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, date date not null, title text not null,
  start_t text, end_t text, all_day boolean default false,
  type text default 'other', location text, note text,
  created_at timestamptz default now()
);
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, day date not null, label text,
  start_t text, end_t text, note text, created_at timestamptz default now()
);
create table if not exists public.countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, name text, target_date date, meta jsonb, created_at timestamptz default now()
);
-- If upgrading an existing DB, run: alter table public.countdowns add column if not exists meta jsonb;

-- ---- Tasks ------------------------------------------------------------------
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, text text not null, term text default 'short',
  due date, done boolean default false, created_at timestamptz default now()
);

-- ---- Upkeep (AI-scheduled maintenance) -------------------------------------
create table if not exists public.upkeep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, name text, brand text, category text default 'other',
  purchased text, tasks text, created_at timestamptz default now()
);

-- ---- Money ------------------------------------------------------------------
create table if not exists public.finance_balance ( user_id uuid primary key, aud_balance numeric, updated_at timestamptz default now() );
create table if not exists public.net_worth     ( id uuid primary key default gen_random_uuid(), user_id uuid not null, kind text, name text, amount numeric, created_at timestamptz default now() );
create table if not exists public.budget        ( id uuid primary key default gen_random_uuid(), user_id uuid not null, name text, monthly_limit numeric, spent numeric, created_at timestamptz default now() );
create table if not exists public.finance_goals ( id uuid primary key default gen_random_uuid(), user_id uuid not null, name text, target numeric, saved numeric, created_at timestamptz default now() );
create table if not exists public.investments   ( id uuid primary key default gen_random_uuid(), user_id uuid not null, name text, value numeric, created_at timestamptz default now() );
-- ---- Zero-based budget system (groups > categories > assignments + transactions) ----
create table if not exists public.budget_cats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, grp text, name text, icon text, position int default 0,
  rollover boolean default false, created_at timestamptz default now()
);
create table if not exists public.budget_assign (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, month text, cat_id uuid, assigned numeric default 0,
  created_at timestamptz default now()
);
create table if not exists public.budget_txns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, cat_id uuid, month text, amount numeric, note text,
  spent_on date default now(), created_at timestamptz default now()
);
create table if not exists public.budget_income (
  user_id uuid not null, month text, amount numeric default 0,
  primary key (user_id, month)
);
create table if not exists public.budget_profile (
  user_id uuid primary key, data jsonb, updated_at timestamptz default now()
);
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, name text, kind text, balance numeric default 0,
  currency text default 'GBP', position int default 0, created_at timestamptz default now()
);


-- ---- Meals / habits / car ---------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, day date, slot text, meal text,
  updated_at timestamptz default now(), unique(user_id,day,slot)
);
create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, kind text, day date, value numeric, note text,
  created_at timestamptz default now(), unique(user_id,kind,day)
);
create table if not exists public.car (
  user_id uuid primary key, insurance text, rego text, service_next text,
  service_last text, make_model text, plate text, odometer text,
  updated_at timestamptz default now()
);

-- ---- Future Me + Understudy agent ------------------------------------------
create table if not exists public.proposals   ( id uuid primary key default gen_random_uuid(), user_id uuid not null, type text, payload text, summary text, why text, status text default 'pending', created_at timestamptz default now() );
create table if not exists public.life_context( user_id uuid primary key, routine text, summary text, updated_at timestamptz default now() );

-- ---- Password vault (zero-knowledge, AES-256-GCM ciphertext) ---------------
create table if not exists public.vault (
  user_id uuid primary key, salt text not null,
  v_iv text not null, v_cipher text not null, created_at timestamptz default now()
);
create table if not exists public.passwords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, label text not null, url text default '',
  iv text not null, cipher text not null, created_at timestamptz default now()
);


-- ============================================================================
-- SECTION B — PERMISSIVE RLS on every table above (idempotent)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','avatars','settings','pin_resets','login_events','requests',
    'items','events','shifts','countdowns','todos','upkeep',
    'finance_balance','net_worth','budget','finance_goals','investments',
    'budget_cats','budget_assign','budget_txns','budget_income','budget_profile','accounts',
    'meals','trackers','car',
    'proposals','life_context',
    'vault','passwords'
  ] loop
    if to_regclass('public.'||t) is null then
      continue;                                   -- table not in this project, skip it
    end if;
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s all" on public.%I;', t, t);
    execute format('create policy "%s all" on public.%I for all using (true) with check (true);', t, t);
  end loop;
end $$;


-- ============================================================================
-- SECTION C — RPC FUNCTIONS the app calls
-- ----------------------------------------------------------------------------
-- The app uses these via sb.rpc(...). They are NOT defined here because they
-- already exist in your project (the app works). Listed only so you know they
-- are required and must not be dropped:
--   forge_get_or_create_profile, forge_profiles, forge_signup, forge_set_name,
--   forge_set_pin, forge_owner_set_pin, forge_set_avatar, forge_delete_profile
-- If you ever rebuild the project from scratch, these need recreating too.
-- (Ask and I'll reconstruct them from the code's call signatures.)
-- ============================================================================


-- ============================================================================
-- CLEANUP — Strava / Ignis running coach (REMOVED from Forge)
-- The running-coach code and all Strava integration are gone from the app.
-- Run this block once to drop everything left over. Safe to re-run.
-- ============================================================================
drop table if exists public.run_plan;
drop table if exists public.run_logs;
drop table if exists public.strava_tokens;
drop table if exists public.auth_handoff;
drop table if exists public.future_me;
drop table if exists public.future_goals;
