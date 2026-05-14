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

create table if not exists public.rewrite_events (
  id uuid primary key default gen_random_uuid(),
  identity_hash text not null,
  speaker_role text,
  target_role text,
  topic text,
  desired_tone text,
  safety_classification text,
  input_chars integer,
  created_at timestamptz not null default now()
);

create index if not exists rewrite_events_identity_created_idx
  on public.rewrite_events (identity_hash, created_at desc);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  stripe_customer_id text unique,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep RLS enabled for client safety. Serverless API uses the service role key.
alter table public.waitlist_signups enable row level security;
alter table public.rewrite_events enable row level security;
alter table public.user_profiles enable row level security;

create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
