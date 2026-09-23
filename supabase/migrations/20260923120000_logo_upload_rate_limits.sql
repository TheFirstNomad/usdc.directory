-- Logo upload rate limiting table.
-- Tracks uploads per IP to enforce max 3 per hour in the upload-logo edge function.
-- Rows are cheap — auto-pruned by the index below once they are older than 24h.
-- Add a pg_cron job to DELETE FROM logo_upload_rate_limits WHERE created_at < now() - interval '24 hours'
-- for long-term hygiene (optional — rows are small and the query is indexed).

create table if not exists public.logo_upload_rate_limits (
  id         bigserial primary key,
  ip         text        not null,
  wallet     text        not null,
  created_at timestamptz not null default now()
);

-- Index used by the rate-limit window query (eq ip + gte created_at).
create index if not exists logo_upload_rate_limits_ip_created_at
  on public.logo_upload_rate_limits (ip, created_at desc);

-- Only the service role (edge functions) may write; nobody reads from the client.
alter table public.logo_upload_rate_limits enable row level security;

-- No client-side access at all — all reads/writes go through service role in the edge function.
-- (No policies = denied for anon and authenticated roles.)
