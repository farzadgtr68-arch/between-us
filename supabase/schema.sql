-- Between Us MVP Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text,
  source text default 'landing',
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free',
  subscription_status text not null default 'none',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing installs can safely run these alter statements again.
alter table public.user_profiles add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.user_profiles add column if not exists stripe_subscription_id text unique;
alter table public.user_profiles add column if not exists subscription_status text not null default 'none';
alter table public.user_profiles add column if not exists current_period_end timestamptz;

create table if not exists public.rewrite_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  identity_hash text not null,
  speaker_role text,
  target_role text,
  topic text,
  desired_tone text,
  safety_classification text,
  input_chars integer,
  created_at timestamptz not null default now()
);

alter table public.rewrite_events add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists rewrite_events_identity_created_idx
  on public.rewrite_events (identity_hash, created_at desc);

create index if not exists rewrite_events_user_created_idx
  on public.rewrite_events (user_id, created_at desc);

create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Keep RLS enabled for client safety. Serverless API uses the service role key.
alter table public.waitlist_signups enable row level security;
alter table public.rewrite_events enable row level security;
alter table public.user_profiles enable row level security;
alter table public.stripe_events enable row level security;

-- Authenticated users may read their own profile if you later use Supabase directly from the browser.
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);
