-- Brique 5 (2/5) — Conversations (« la conversation EST le match »).
-- Une conversation naît à l'ACCEPTATION d'une invitation (cf. respond_invitation, 3/5).
-- Pas de table `matches` : la conversation porte le match. Le chat lui-même (messages,
-- realtime) est la brique 6 ; ici on pose seulement la table + sa sécurité.
--
-- Sécurité : aucune écriture client (création via RPC `security definer` uniquement) ;
-- lecture réservée aux deux membres (RLS). Membres DÉNORMALISÉS (user_a/user_b) depuis
-- l'invitation -> RLS triviale et indexable (pas de jointure vers invitations à chaque
-- accès). Ordre canonique (user_a < user_b) -> une paire a une représentation unique.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),

  -- L'invitation acceptée d'où naît la conversation. UNIQUE : au plus UNE conversation
  -- par invitation (idempotence structurelle de respond_invitation). on delete cascade :
  -- supprimer l'invitation supprime la conversation (cohérent ; pas attendu en pratique).
  invitation_id uuid not null unique references public.invitations (id) on delete cascade,

  -- Les deux membres, en ordre canonique (least, greatest). Dénormalisés depuis
  -- l'invitation : la RLS et les lookups d'Inbox (brique 6) n'ont pas à joindre invitations.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversations_distinct_members check (user_a <> user_b),
  -- Ordre canonique : garantit que (X,Y) et (Y,X) ne s'écrivent que d'une seule façon.
  constraint conversations_canonical_order check (user_a < user_b)
);

comment on table public.conversations is
  'Conversations (= matchs). Créées à l''acceptation d''une invitation. Chat = brique 6.';

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row
  execute function public.touch_updated_at();

-- UN SEUL match par paire : unicité sur la paire canonique (user_a < user_b garantit
-- une représentation unique). Défend l'invariant « la conversation EST le match » dans la
-- BASE (l'anti-spam des invitations ne couvre que pending/changes_requested -> une paire
-- déjà acceptée pourrait sinon re-matcher). respond_invitation gère le conflit (réutilise
-- la conversation existante au lieu d'en créer une 2e).
create unique index conversations_pair_uidx on public.conversations (user_a, user_b);

-- « Mes conversations » = user_a OU user_b = moi -> un index par colonne couvre les deux
-- sens du filtre RLS (la liste Chats de la brique 6).
create index conversations_user_a_idx on public.conversations (user_a);
create index conversations_user_b_idx on public.conversations (user_b);

alter table public.conversations enable row level security;

-- Lecture : uniquement les deux membres. (select auth.uid()) wrappé (initplan, perf).
create policy "Conversations are visible to their members"
  on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- Aucune écriture client : la création passe par respond_invitation (security definer).
-- On révoque l'écriture accordée par défaut (api_role_grants) ; SELECT gardé (gaté RLS).
revoke insert, update, delete on public.conversations from authenticated;
grant select on public.conversations to authenticated;
grant all on public.conversations to service_role;
