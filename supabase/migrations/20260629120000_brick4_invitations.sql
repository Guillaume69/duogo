-- Brique 4 (2/3) — Invitations.
-- Une invitation = une proposition d'activité de l'expéditeur vers le destinataire.
-- Cycle de vie : pending -> accepted | declined (réponse = brique 5) ; changes_requested
-- (Modify) = brique 8. Modèle : « la conversation EST le match » -> pas de table matches.
--
-- Sécurité (cf. AGENTS.md « RLS-first, 4 étages ») :
--   • Création = transition sensible + validations qui LISENT des données que l'appelant
--     ne voit pas (device_location du destinataire) -> RPC `security definer`
--     (send_invitation). Aucun INSERT/UPDATE/DELETE client direct.
--   • Lecture : RLS « membres seulement » (expéditeur OU destinataire), pour l'Inbox
--     (brique 5) ; le badge « Invited » du browse passe lui par les RPC (brique 4 §3).
--   • Anti-spam : une SEULE invitation active (pending) entre deux personnes, quel que
--     soit le sens (index unique partiel sur la paire NON ordonnée).

-- 1. Table -----------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),

  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,

  -- Cœur de l'invitation. activity_id requis (« Invite to Activity ») ; location_id
  -- optionnel. on delete restrict implicite (pas de cascade) : on ne veut pas qu'une
  -- activité/un lieu seedé disparu efface des invitations — le seed est stable.
  activity_id uuid not null references public.activities (id),
  location_id uuid references public.locations (id),

  -- Quand. La DATE est requise. L'heure est soit un CRÉNEAU (morning/afternoon/evening),
  -- soit une HEURE PRÉCISE, soit rien (flexible) — jamais les deux (CHECK plus bas).
  -- date/time sont des horaires LOCAUX (mur) de la ville (matching intra-ville, même tz).
  scheduled_date date not null,
  time_slot      public.time_slot,
  scheduled_time time,

  message text check (message is null or char_length(message) <= 500),

  status public.invitation_status not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- On ne s'invite pas soi-même.
  constraint invitations_no_self check (sender_id <> recipient_id),
  -- Créneau XOR heure précise (les deux à la fois n'a pas de sens). Les deux NULL = ok.
  constraint invitations_time_exclusive
    check (time_slot is null or scheduled_time is null)
);

comment on table public.invitations is
  'Invitations d''activité (pending/accepted/declined). La conversation naît à l''acceptation (brique 5).';

-- updated_at automatique (helper de la brique 0).
create trigger invitations_touch_updated_at
  before update on public.invitations
  for each row
  execute function public.touch_updated_at();

-- 2. Index -----------------------------------------------------------------
-- Anti-spam : au plus UNE invitation pending entre deux personnes, dans un sens OU
-- l'autre. La paire NON ordonnée (least, greatest) rend l'unicité symétrique : A→B et
-- B→A pending sont en collision (même clé) -> impossible d'avoir deux négociations
-- ouvertes entre les deux. least/greatest sur uuid sont immutables -> index valide.
-- ⚠ « active » = pending uniquement aujourd'hui ; quand changes_requested deviendra un
-- état actif (Modify, brique 8), élargir ce WHERE.
create unique index invitations_active_pair_uidx
  on public.invitations (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

-- Lookups Inbox (brique 5) + flag already_invited (brique 4 §3) : par destinataire et
-- par expéditeur. Le flag interroge (sender_id, recipient_id, pending) -> index dédié.
create index invitations_recipient_idx on public.invitations (recipient_id);
create index invitations_sender_pending_idx
  on public.invitations (sender_id, recipient_id) where status = 'pending';

-- 3. RLS + grants ----------------------------------------------------------
alter table public.invitations enable row level security;

-- Lecture : uniquement les deux membres de l'invitation. (select auth.uid()) wrappé
-- pour la perf (initplan caché). Suffit à l'Inbox brique 5 (reçues + envoyées).
create policy "Invitations are visible to their members"
  on public.invitations for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

-- AUCUNE policy insert/update/delete pour authenticated : toute écriture passe par une
-- RPC `security definer` (send_invitation ici ; respond_invitation en brique 5). La RPC
-- s'exécute en tant que propriétaire et contourne donc RLS *et* les grants ci-dessous.
-- Les default privileges (migration api_role_grants) ont accordé select/insert/update à
-- authenticated sur toute nouvelle table -> on RÉVOQUE l'écriture (défense en profondeur,
-- même si l'absence de policy suffirait déjà à bloquer). On garde le SELECT (gaté par RLS).
revoke insert, update, delete on public.invitations from authenticated;
grant select on public.invitations to authenticated;
grant all on public.invitations to service_role;

-- 4. RPC send_invitation ---------------------------------------------------
-- Crée une invitation pending de l'appelant vers p_recipient_id, après validation.
-- `security definer` : (a) écrit une table sans policy d'INSERT client ; (b) vérifie la
-- VISIBILITÉ du destinataire en lisant device_location/city (que l'appelant ne peut pas
-- lire). search_path='' -> tout est schéma-qualifié. Renvoie l'id de l'invitation créée.
--
-- ⚠ La visibilité du destinataire DOIT rester alignée sur find_nearby_people/get_person
-- (même frontière de confiance) : même ville, découvrable, géolocalisé, pas soi-même.
create or replace function public.send_invitation(
  p_recipient_id uuid,
  p_activity_id  uuid,
  p_date         date,
  p_time_slot    public.time_slot default null,
  p_time         time            default null,
  p_location_id  uuid            default null,
  p_message      text            default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_city    uuid;
  v_today   date;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Ville + date du jour (fuseau de la ville) de l'appelant. Un appelant sans ville
  -- (hors zone / non géolocalisé) ne voit personne -> ne peut pas inviter.
  select p.city_id into v_city
  from public.profiles p
  where p.id = v_uid;

  if v_city is null then
    raise exception 'you must be located in a city to send invitations'
      using errcode = 'P0001';
  end if;

  select (now() at time zone c.timezone)::date into v_today
  from public.cities c where c.id = v_city;

  -- Destinataire VISIBLE par l'appelant (même frontière que le browse) : même ville,
  -- découvrable, géolocalisé, et différent de soi. Sinon on ne révèle rien de précis.
  if not exists (
    select 1 from public.profiles r
    where r.id = p_recipient_id
      and r.id <> v_uid
      and r.onboarding_completed is true
      and r.device_location is not null
      and r.city_id = v_city
  ) then
    raise exception 'recipient is not available' using errcode = 'P0001';
  end if;

  -- Activité existante (catalogue seedé).
  if not exists (select 1 from public.activities a where a.id = p_activity_id) then
    raise exception 'unknown activity' using errcode = 'P0001';
  end if;

  -- Lieu (optionnel) : doit exister ET être dans MA ville (cohérence intra-ville).
  if p_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = p_location_id and l.city_id = v_city
  ) then
    raise exception 'unknown location' using errcode = 'P0001';
  end if;

  -- Date dans le futur (ou aujourd'hui), en date LOCALE de la ville.
  if p_date is null or p_date < v_today then
    raise exception 'invitation date must be today or later'
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  -- Créneau XOR heure précise (re-vérifié côté serveur ; le CHECK de table le garantit
  -- aussi, mais on lève un message propre plutôt qu'une erreur de contrainte brute).
  if p_time_slot is not null and p_time is not null then
    raise exception 'choose either a time slot or an exact time, not both'
      using errcode = '22023';
  end if;

  -- Insertion. L'index unique partiel anti-spam lève unique_violation (23505) s'il
  -- existe déjà une invitation pending entre les deux (peu importe le sens) : on la
  -- retraduit en message propre, en conservant le code 23505 pour le mapping client.
  begin
    insert into public.invitations (
      sender_id, recipient_id, activity_id, location_id,
      scheduled_date, time_slot, scheduled_time, message
    ) values (
      v_uid, p_recipient_id, p_activity_id, p_location_id,
      p_date, p_time_slot, p_time, nullif(btrim(p_message), '')
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'there is already a pending invitation with this person'
      using errcode = '23505';
  end;

  return v_id;
end;
$$;

revoke all on function public.send_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) from public;
grant execute on function public.send_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) to authenticated;
