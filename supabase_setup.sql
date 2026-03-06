-- Run this in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste & run

-- Key-value store for shared trip data
create table if not exists kv_store (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- Allow anonymous read/write (all group members, no login needed)
alter table kv_store enable row level security;

create policy "Public read"
  on kv_store for select
  using (true);

create policy "Public write"
  on kv_store for insert
  with check (true);

create policy "Public update"
  on kv_store for update
  using (true);

-- Enable real-time updates on this table
alter publication supabase_realtime add table kv_store;
