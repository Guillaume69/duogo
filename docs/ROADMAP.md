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
- [x] **Rebuild natif** (`BUILD SUCCESSFUL in 21s`, APK installé + ouvert sur le Pixel) — modules natifs embarqués
- [x] Migrer les écrans d'auth existants **FR → EN** (`login`/`verify`/`country`/home)
- **✅ Acceptation OK** : l'app rebuild et démarre ; le client Supabase est typé `<Database>` (zéro `as`, `tsc` vert). _Commit `afe6fab`. Hors-scope brique 0 : `eas init` (reporté brique 8)._

## Brique 1 — Shell (onglets natifs) + profils + onboarding + Account
*But : la coquille de l'app connectée + l'identité minimale.*
- [x] Table `profiles` (squelette) + trigger `handle_new_user` (création auto) + RLS *(migration `20260628120000`)*
- [x] **Correctif GRANT** : rôles API n'avaient pas les droits DML → migration `20260628140000` (+ default privileges). Voir piège mémoire.
- [x] `(tabs)/_layout` avec **NativeTabs** (Explore / Inbox / Account, `sf`/`md` icons) — API v56 vérifiée sur les docs
- [x] `ProfileProvider` / `useProfile` (`src/lib/profile.tsx`, modèle `country.tsx`) — distingue « pas de profil » de « échec de chargement »
- [x] Guard **onboarding** dans `(app)/_layout` (+ `ProfileGate` loading/erreur)
- [x] Écran onboarding « choose a username » (validation points de code)
- [x] Onglet **Account** (pseudo + numéro, Sign out)
- **✅ Acceptation OK** : onboarding → pseudo → onglets **testé sur le device**. Revue adversariale complète (briques 0+1) passée ; 9 findings corrigés (`countries.ts` EN, robustesse `auth`/`account`/`verify`). Migrations `…120000`/`…140000`/`…150000` **appliquées au distant** (durcissement CHECK `display_name` inclus). Commité.

## Brique 2 — Profil complet + géoloc + cities + activités
*But : un profil riche, géolocalisé, avec centres d'intérêt et photo.*
- [x] Table `cities` + seed (**Khon Kaen, TH**) *(migration `…160000`)*
- [x] Table `activities` (seed 12) + `profile_activities` + RLS *(migration `…160000`)*
- [x] Colonnes profil : `bio`, `gender`, `birth_date` (≥18), `avatar_path`, `device/search_location` (geo + GIST), `city_id` + `onboarding_completed` (générée) + **GRANT colonne masquant le GPS** *(migration `…161000`)*
- [x] Bucket Storage `avatars` (privé) + policies dossier `<uid>/` *(migration `…162000`)*
- [x] Table `push_tokens` + RLS *(migration `…163000`, exploitée brique 8)*
- [x] `LocationProvider` (GPS one-shot → **RPC `set_my_location`** qui dérive `city_id` par jointure spatiale côté serveur, rayon 50 km — plus robuste qu'un matching de chaîne ; les coords ne sortent jamais)
- [x] Écran **Edit profile** (avatar via picker + upload `fetch().arrayBuffer()`, name, **gender** + **date of birth** ajoutés (matching/≥18), location GPS, bio, intérêts en chips) + Account enrichi + composant `Avatar` (URL signée **cachée** -> pas de flash au retour)
- [x] **Composants natifs** : `@expo/ui` (segmented + datetime) était janky (blanc/blanc, lag) -> remplacés par `@react-native-segmented-control/segmented-control` + `@react-native-community/datetimepicker` (vrais natifs). **Rebuild natif fait** (`BUILD SUCCESSFUL`, APK installé).
- **⏳ Acceptation (à valider sur device au retour)** : tous les champs persistent ; avatar visible (sans flash) ; ville dérivée du GPS (Khon Kaen) ; gender + DOB natifs lisibles/fluides.
- **Revue adversariale** (2 agents) faite ; corrigés : B1 onboarding 42501 (update au lieu d'upsert), perte d'activités au Save (`activitiesLoaded`), Account intérêts périmés (`useEffect [profile]`), sync géoloc↔contexte (`applyProfile` à la capture), flash avatar au changement de path, statut géoloc périmé, double-tap Save (`useRef`), timeout GPS.
- **⚠️ Différé (nécessite redéploiement/brique 3)** :
  - **DOB exacte** lisible par tout authentifié (policy `using(true)` + grant SELECT `birth_date`) -> **brique 3** : ne renvoyer que l'âge via la RPC de browse + lecture du profil propre via RPC dédiée.
  - Save multi-call **non atomique** + anciens avatars orphelins dans le bucket -> futur RPC `save_profile` atomique + cleanup.
- **Décision avatars** : bucket **privé** + **URLs signées** (créées à la volée par chaque viewer, TTL 1 h, cachées côté client). expo-image cache les octets -> pas d'avatar manquant. Pour les **listes** (Browse People), utiliser **`createSignedUrls` (batch, pluriel)** = 1 seul appel pour N avatars.

## Brique 3 — Browse People + filtres + fiche personne
*But : découvrir les gens autour de soi.*
- [ ] RPC `find_nearby_people` (PostGIS, même `city_id`, distance, filtres genre/âge/activités, renvoie distance + `deja_invite`)
- [ ] Explore → **People** (FlashList de `PersonRow` : avatar, `ville • km`, chips, badge « Invited ») — avatars via **`createSignedUrls` batch** (1 appel pour toute la page)
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
