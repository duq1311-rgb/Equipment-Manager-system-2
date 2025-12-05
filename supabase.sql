-- Run these SQL statements in Supabase SQL editor to create the needed tables

-- equipment table
create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_qty int not null default 0,
  available_qty int not null default 0,
  metadata jsonb,
  created_at timestamptz default now()
);

-- transactions: represents a checkout session
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  assistant_user_id uuid references auth.users(id) on delete set null,
  project_name text,
  project_owner text,
  checkout_time timestamptz,
  shoot_time timestamptz,
  return_time timestamptz,
  status text default 'open', -- open, closed, partially_returned
  notes text,
  created_at timestamptz default now()
);

-- items inside a transaction (which equipment and how many)
create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete set null,
  qty int not null default 1,
  damaged boolean default false,
  damage_notes text,
  lost boolean default false,
  lost_notes text
);

create table if not exists transaction_assistants (
  transaction_id uuid references transactions(id) on delete cascade,
  assistant_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (transaction_id, assistant_user_id)
);

-- optionally: a users table to store role (admin/user) if you want to mirror auth.users
-- but Supabase's auth.users exists; you can add a profiles table
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade,
  full_name text,
  role text default 'user', -- admin or user
  created_at timestamptz default now(),
  primary key (id)
);

-- NOTE: after creating tables, configure RLS policies according to your desired visibility.
-- For initial testing you can disable RLS or allow public inserts from anon key but for production configure strict policies.

-- If the transactions table already exists, run this to add the assistant column:
-- alter table public.transactions add column if not exists assistant_user_id uuid references auth.users(id) on delete set null;

-- Table for multiple assistants
-- create table if not exists public.transaction_assistants (
--   transaction_id uuid references public.transactions(id) on delete cascade,
--   assistant_user_id uuid references auth.users(id) on delete cascade,
--   created_at timestamptz default now(),
--   primary key (transaction_id, assistant_user_id)
-- );

