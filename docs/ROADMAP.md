# DuoGo — Roadmap MVP

> Document de **suivi** : on coche au fur et à mesure, on itère **brique par brique** sur
> plusieurs jours. `[x]` = fait, `[ ]` = à faire, `[~]` = en cours.
> Voir aussi `docs/CHECKPOINT.md` (contexte de reprise) et le plan détaillé d'origine.

L'**auth par téléphone** est ✅ faite (login → OTP → session → écran connecté → déconnexion).
On teste en dev avec le **numéro de test** `0600000000` → code `123456` (Twilio est parqué).

---

## Décisions cadres (valent pour toutes les briques)
- **Code** : TypeScript strict, **zéro `as`** (typage honnête à la source), bien découpé.
- **Design** : aucun design custom pour l'instant → stock OS + **maximum d'éléments natifs**, fluide.
- **Langue** : **UI de l'app en anglais** ; commentaires de code en français pour l'instant.
- **Backend** : **Supabase au maximum** (PostgREST + RLS + RPC + Realtime + Storage). Le **seul**
  bout serveur = une **Edge Function** pour les push. Pas de backend dédié pour le MVP.
- **Navigation** : onglets **natifs** (`expo-router/unstable-native-tabs`), Explore / Inbox / Account.
- **Géoloc** : GPS → ville (reverse-geocode) → `city_id`. Matching **intra-ville**, distances PostGIS.
  Archi **multi-ville** dès le départ (table `cities`) ; choisir une autre ville = premium plus tard.
- **Modèle** : pas de table `matches` — la **conversation EST le match**.

---

## Brique 0 — Fondations techniques
*But : poser les outils (libs natives, Supabase CLI/migrations, EAS, types générés). Pas d'écran.*
- [x] Installer les libs natives (`expo-location`, `expo-notifications`, `expo-image-picker`, `@shopify/flash-list`)
- [x] Installer la CLI Supabase (devDep)
- [x] `npx supabase login` + `supabase link` au projet `iyantsbthzjawcxfodfb`
- [ ] **(toi)** `npx eas init` → `projectId` dans `app.json` *(reporté à la brique 8 / push)*
- [x] `supabase init` + 1re migration écrite : **PostGIS**, enums (`gender`, `time_slot`, `invitation_status`, `push_platform`), helper `touch_updated_at()`
- [x] `npx supabase db push` (migration appliquée au projet distant — le warning pg-delta est cosmétique)
- [x] Script `db:types` ajouté à `package.json`
- [x] Généré `src/lib/database.types.ts` (4 enums présents) + client en `createClient<Database>`
- [ ] **(toi) Rebuild natif** (`source ~/android-build/env.sh && npx expo run:android`) pour embarquer les nouveaux modules
- [x] Migrer les écrans d'auth existants **FR → EN** (`login`/`verify`/`country`/home)
- **✅ Acceptation** : l'app rebuild et démarre ; `supabase.from('profiles')` est typé (zéro `as`).

## Brique 1 — Shell (onglets natifs) + profils + onboarding + Account
*But : la coquille de l'app connectée + l'identité minimale.*
- [ ] Table `profiles` (squelette) + trigger `handle_new_user` (création auto) + RLS
- [ ] `(tabs)/_layout` avec **NativeTabs** (Explore / Inbox / Account, icônes `expo-symbols`)
- [ ] `ProfileProvider` / `useProfile` (modèle `src/lib/country.tsx`)
- [ ] Guard **onboarding** dans `(app)/_layout` (redirige si pas de pseudo)
- [ ] Écran onboarding « choisis ton pseudo »
- [ ] Onglet **Account** (vue profil en lecture)
- **✅ Acceptation** : sans pseudo → onboarding → après pseudo, redirection auto vers les onglets ; bascule d'onglets native ; Account affiche le profil.

## Brique 2 — Profil complet + géoloc + cities + activités
*But : un profil riche, géolocalisé, avec centres d'intérêt et photo.*
- [ ] Table `cities` + seed (1 ville)
- [ ] Table `activities` (seed) + `profile_activities` + RLS
- [ ] Colonnes profil : `bio`, `gender`, `birth_date` (≥18), `avatar_path`, `device/search_location` (geo + GIST), `city_id` + **GRANT** masquant le GPS
- [ ] Bucket Storage `avatars` + policies
- [ ] Table `push_tokens` + RLS
- [ ] `LocationProvider` (GPS one-shot + reverse-geocode → `city_id`)
- [ ] Écran **Edit profile** (avatar via picker + upload `ArrayBuffer`, nom, bio, genre, date naissance, intérêts multi-select)
- **✅ Acceptation** : tous les champs persistent et survivent au redémarrage ; avatar visible ; ville dérivée du GPS.

## Brique 3 — Browse People + filtres + fiche personne
*But : découvrir les gens autour de soi.*
- [ ] RPC `find_nearby_people` (PostGIS, même `city_id`, distance, filtres genre/âge/activités, renvoie distance + `deja_invite`)
- [ ] Explore → **People** (FlashList de `PersonRow` : avatar, `ville • km`, chips, badge « Invited »)
- [ ] Écran **Filter By** en sheet (`@expo/ui` slider distance, activités multi, âge, genre)
- [ ] Fiche `person/[id]` (+ bouton « Invite to Activity »)
- **✅ Acceptation** : liste des gens proches ; le filtre change les résultats ; tap → fiche.

## Brique 4 — Envoi d'invitation
*But : inviter quelqu'un à une activité.*
- [ ] Table `locations` (seed) + RPC `find_nearby_locations`
- [ ] Table `invitations` + RLS + RPC `send_invitation` + index anti-spam (1 invitation active/couple)
- [ ] Flux modal **Invite to Activity** (`InviteDraftProvider` : activité, date/heure native, créneau Matin/Après-midi/Soir ou heure précise, lieu optionnel, message)
- [ ] Badge « Invited » reflété dans les listes
- **✅ Acceptation** : invitation composée et créée en base ; bouton Send géré ; « Invited » visible.

## Brique 5 — Inbox + réponse + match
*But : recevoir et répondre aux invitations ; créer le match.*
- [ ] RPC `respond_invitation` (accept/decline, verrou `for update`) → crée `conversations` à l'acceptation
- [ ] RLS `conversations` (membres seulement)
- [ ] Onglet **Inbox** (segmented Chats | Invitations ; reçues/envoyées + statuts)
- [ ] Écran `invitation/[id]` (carte + Accept / Decline) *(Modify reporté en brique 8)*
- **✅ Acceptation** : le destinataire accepte → conversation créée ; decline met à jour le statut ; l'expéditeur voit le changement.

## Brique 6 — Chat temps réel *(boucle cœur complète)*
*But : discuter une fois matché.*
- [ ] Table `messages` + RLS + ajout à la publication `supabase_realtime`
- [ ] RPC `mark_messages_read` + trigger `last_message_at`
- [ ] Liste **Chats** + écran `chat/[conversationId]` (FlashList inversée, carte invitation épinglée, composer, abonnement realtime + cleanup)
- [ ] Décider `@tanstack/react-query` vs helper maison
- **✅ Acceptation** : invitation acceptée → conversation ; **2 appareils échangent en temps réel**.

## Brique 7 — Explore Activities (découverte)
*But : surface de découverte par activité.*
- [ ] Explore → **Activities** (`ActivityCard` + `AvatarStack` « +12 »)
- [ ] Écran `activity/[id]` (hero, description, closest locations, people close)
- [ ] Écran `all-locations` cherchable
- **✅ Acceptation** : liste d'activités ; Activity View ; All Locations cherchable.

## Brique 8 — Notifications push + deep links + Modify
*But : notifier en temps réel et permettre la contre-proposition.*
- [ ] Edge Function `send-push` + **Database Webhooks** (invitations insert/update, messages insert) + secrets
- [ ] Client : permission + token Expo (`projectId`), `setNotificationHandler` (popup foreground), deep-link → `invitation/[id]` ou `chat/[id]`
- [ ] Prérequis **FCM** (Android) / **APNs** (iOS) chez EAS
- [ ] Activer **Modify** (statut `changes_requested` + `proposed_*` + RPC)
- **✅ Acceptation** : invitation/message → push ; tap deep-link ouvre le bon écran ; bannière in-app en foreground.

---

## Comment tester (rappel)
- Build/run : `source ~/android-build/env.sh && npx expo run:android` (Pixel 10 Pro en USB).
- `npx tsc --noEmit` doit rester vert (zéro `as`).
- Entrer dans l'app : numéro `0600000000`, code `123456`.
- Boucle cœur (après brique 6) : 2 comptes de test, A invite B → B accepte → chat temps réel sur 2 appareils.
