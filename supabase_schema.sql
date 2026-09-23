-- =============================================================
-- FamilySearch Europe VR — Supabase Full Setup
-- Run this in: Supabase → SQL Editor → New Query → Run
-- =============================================================

-- ── TOURS TABLE ──────────────────────────────────────────────

create table if not exists public.tours (
  id           text primary key,
  title        text,
  subtitle     text,
  category     text,
  thumbnail    text,
  description  text,
  "videoSrc"   text,
  duration     integer default 120,
  hotspots     jsonb default '[]'::jsonb,
  "startPOV"   jsonb
);

alter table public.tours enable row level security;

-- Migration for existing tables: add Start POV storage (jsonb: {yaw, pitch})
alter table public.tours add column if not exists "startPOV" jsonb;

-- Drop old conflicting policies first (safe to re-run)
drop policy if exists "Public read access" on public.tours;
drop policy if exists "Authenticated write access" on public.tours;
drop policy if exists "Allow public read access" on public.tours;
drop policy if exists "Allow public insert and update" on public.tours;

-- Anyone (visitors) can read tours
create policy "Public read access"
  on public.tours for select using (true);

-- Only authenticated admins can write tours
create policy "Authenticated write access"
  on public.tours for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── PROFILES TABLE ───────────────────────────────────────────
-- Mirrors auth.users. Auto-populated by trigger on user creation.
-- This IS the user management backbone — no separate tracking table needed.

create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text,
  name       text,
  role       text default 'admin',
  is_active  boolean default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Drop old conflicting policies first
drop policy if exists "Authenticated read profiles" on public.profiles;
drop policy if exists "Own profile update" on public.profiles;
drop policy if exists "Admin full profile access" on public.profiles;
drop policy if exists "Authenticated access only" on public.profiles;

-- Authenticated users can see all profiles (who's on the team)
create policy "Authenticated read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile (name etc.)
create policy "Own profile update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can update any profile (e.g. deactivate a member)
create policy "Admin full profile access"
  on public.profiles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
-- Whenever Supabase creates a user in auth.users, this trigger
-- automatically creates a matching row in public.profiles.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it already exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── CLEANUP (if you previously ran the old team_members setup) ──
drop table if exists public.team_members;
