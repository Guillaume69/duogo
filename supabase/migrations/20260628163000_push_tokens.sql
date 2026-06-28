-- Brique 2 — Table push_tokens (créée tôt, exploitée en brique 8 pour les push).
-- Un device = un token Expo Push + une plateforme. L'Edge Function (service_role)
-- les lira pour envoyer ; ici, RLS « chacun ses tokens ».

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Token Expo Push (unique par device, peut migrer d'un user à l'autre -> on
  -- résoudra le conflit par upsert sur `token` côté client en brique 8).
  token text not null unique,
  platform public.push_platform not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

create trigger push_tokens_touch_updated_at
  before update on public.push_tokens
  for each row execute function public.touch_updated_at();

alter table public.push_tokens enable row level security;

create policy "Users read their own push tokens"
  on public.push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their own push tokens"
  on public.push_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own push tokens"
  on public.push_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own push tokens"
  on public.push_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;
