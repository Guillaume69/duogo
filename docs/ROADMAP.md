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
- **Géoloc** : GPS → `city_id` (centre seedé le plus proche dans 50 km), pas de reverse-geocode.
  Matching **intra-ville**, distances PostGIS. Archi **multi-ville** dès le départ (table `cities`) ;
  choisir une autre ville = premium plus tard. ⚠ Voir [Dette technique](#dette-technique-connue) (résolution de ville).
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
- [x] `ProfileProvider` / `useProfile` (`src/providers/profile.tsx`, modèle `country.tsx`) — distingue « pas de profil » de « échec de chargement »
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
- [x] **Composants natifs** (priorité absolue au natif) : **date of birth** = `@react-native-community/datetimepicker` ; **gender** = ligne cohérente + **bottom-sheet native `@expo/ui`** (`@expo/ui/community/bottom-sheet`, Material 3, `backgroundStyle` clair + `handleComponent={null}` + `enablePanDownToClose`). Tokens de style dans `src/theme.ts`. (Tâtonné via segmented/picker avant d'aboutir — leçon : natif d'abord, voir mémoire.)
- **✅ Acceptation OK** : testé sur device (champs persistent, avatar sans flash, ville Khon Kaen via GPS, gender/DOB natifs). **Commité + poussé (`1aed5db`).**
- **Revue adversariale** (2 agents) faite ; corrigés : B1 onboarding 42501 (update au lieu d'upsert), perte d'activités au Save (`activitiesLoaded`), Account intérêts périmés (`useEffect [profile]`), sync géoloc↔contexte (`applyProfile` à la capture), flash avatar au changement de path, statut géoloc périmé, double-tap Save (`useRef`), timeout GPS.
- **⚠️ Différé (nécessite redéploiement/brique 3)** :
  - **DOB exacte** lisible par tout authentifié (policy `using(true)` + grant SELECT `birth_date`) -> **brique 3** : ne renvoyer que l'âge via la RPC de browse + lecture du profil propre via RPC dédiée.
  - Save multi-call **non atomique** + anciens avatars orphelins dans le bucket -> futur RPC `save_profile` atomique + cleanup.
- **Décision avatars** : bucket **privé** + **URLs signées** (créées à la volée par chaque viewer, TTL 1 h, cachées côté client). expo-image cache les octets -> pas d'avatar manquant. Pour les **listes** (Browse People), utiliser **`createSignedUrls` (batch, pluriel)** = 1 seul appel pour N avatars.

## Brique 3 — Browse People + filtres + fiche personne ✅
*But : découvrir les gens autour de soi.*
- [x] RPC `find_nearby_people` (PostGIS, même `city_id`, distance, filtres genre/âge multi/activités) — **anti-trilatération** (snap grille ~1 km + arrondi 500 m), jamais de coordonnées. *(`deja_invite` reporté en brique 4 : pas encore de table `invitations`.)*
- [x] **Durcissement DOB** (différé brique 2) : `revoke select(birth_date)` + `get_my_profile()` (lecture du profil propre) ; le browse ne renvoie que l'âge (int).
- [x] Position **automatique** (GPS live au montage d'Explore, dernière position connue en cache) ; colonne `search_location` retirée (YAGNI).
- [x] Explore → **People** (FlashList de `PersonRow` : avatar, `ville · âge · ~km`, chips, communes mises en avant) + segmented **People | Activities** — avatars via **`createSignedUrls` batch** (1 appel pour toute la page)
- [x] Écran **Filter By** en sheet (`@expo/ui` slider distance, activités multi, **âge multi**, genre multi)
- [x] Fiche `person/[id]` (avatar, méta, About + Read More, Interests, bouton « Invite to Activity » inactif jusqu'à la brique 4) via RPC `get_person`
- **✅ Acceptation** : liste des gens proches ; le filtre change les résultats ; tap → fiche. **Testé sur device.**

## Brique 4 — Envoi d'invitation ✅
*But : inviter quelqu'un à une activité.*
- [x] Table `locations` (seed Khon Kaen, 8 lieux) + RPC `find_nearby_locations` (intra-ville, distance exacte — lieux publics, jamais de geog au client).
- [x] Table `invitations` + RLS (SELECT membres seulement ; écriture **uniquement** via RPC) + RPC `send_invitation` (`security definer`, valide visibilité destinataire/activité/lieu/date+heure) + **index anti-spam** unique partiel sur la paire **non ordonnée** `(least, greatest)` where pending (1 invitation active entre deux personnes, peu importe le sens).
- [x] Flux modal **Invite to Activity** (`InviteDraftProvider` + `useInviteDraft` : activité [sheet natif], date [date picker natif, min = aujourd'hui], créneau Morning/Afternoon/Evening **ou** heure précise [time picker natif] exclusifs, lieu optionnel [sheet natif], message).
- [x] `already_invited` ajouté à `find_nearby_people`/`get_person` → badge « **Invited** » dans la liste Explore + état « Invited » (désactivé) sur la fiche.
- **✅ Acceptation OK** : **testé sur device** (flux complet : Explore → fiche → modale → activité/date/créneau → Send → invitation créée en base → « Invited » sur la fiche ET dans la liste). `tsc`/`lint` verts.
- **Revue adversariale** (ultracode, 6 dimensions × find→verify, 12 findings confirmés, tous **low**) : 9 corrigés — durcissement GRANT `locations`, validation **heure passée** le jour même (`send_invitation`), mapping erreur date/heure passée (22023), type `address` nullable honnête, déduplication `firstName`, anti double-fetch Explore (signal one-shot `invite-events`), garde de séquence anti-écrasement périmé (`useNearbyPeople`), état vide du `PickerField`, commentaire d'index GiST corrigé.
- **Différé (documenté)** : (a) sens **entrant** « on m'a invité » (bouton actif, échec propre via anti-spam) → vrai état dédié en **brique 5** ; (b) fermeture du date/time picker **iOS** inline → passe iOS ; (c) micro-magic-numbers alignés sur les composants existants (GenderField/edit-profile) — non corrigés par cohérence.

## Brique 5 — Inbox + réponse + match + Modify ✅
*But : recevoir et répondre aux invitations ; créer le match.*
- [x] Modèle **« tour de parole »** : `invitations.awaiting_response_from` (qui doit répondre ; NULL = terminée) ; anti-spam élargi à `changes_requested` ; `send_invitation` pose le tour initial.
- [x] RPC `respond_invitation` (accept/decline, `for update`) → **crée/réutilise** `conversations` à l'acceptation. RPC `modify_invitation` (contre-proposition → `changes_requested`, renvoie le tour à l'autre membre).
- [x] Table `conversations` (= le match) : `invitation_id` UNIQUE + **paire unique** (`user_a<user_b`) + RLS membres ; aucune écriture client.
- [x] RPC `get_my_invitations` (reçues+envoyées enrichies) + `get_invitation` (détail + distances) ; flags `invited_by_them`/`active_invitation_id` ajoutés à `find_nearby_people`/`get_person` (sens entrant — dette brique 4).
- [x] Onglet **Inbox** (reçues + actionnables) + lien **Sent** (envoyées + statuts) ; écran `invitation/[id]` (carte + **Accept / Modify / Decline** selon « mon tour ») ; `modify-invitation/[id]` réutilise le formulaire (`InviteForm` + `InviteDraftProvider` create|modify).
- **✅ Acceptation** : testé avec 2 comptes sur device ; revue adversariale (21 findings → 12 confirmés, tous corrigés) ; `tsc`/`lint` verts.
- **Décisions** : **Modify avancé** de la brique 8 → brique 5 (demande produit). Pas de temps réel (focus/pull-to-refresh) → live = brique 6, push + badge = brique 8.
- **Différés (lows documentés)** : flash bref du lieu pré-rempli en Modify ; pas de garde anti-double-tap sur les *push* de navigation ; état « matched » sur la fiche personne → brique 6 (chat).

## Brique 6 — Chat temps réel ✅ *(boucle cœur complète)*
*But : discuter une fois matché.*
- [x] Table `messages` + RLS (SELECT/INSERT membres ; **GRANT par colonne** : `id`/`created_at` server-only) + ajout à la publication `supabase_realtime`. Écriture **client-directe** (PostgREST + RLS, cas « mes données ») ; lecture des messages aussi (pas de RPC).
- [x] RPC `mark_messages_read` + trigger `last_message_at` (+ pointeurs de lecture par membre `user_a/b_last_read_at` → non-lus / badge « Your Turn »).
- [x] RPC `get_my_conversations` (liste Chats enrichie : autre membre, activité, dernier message, non-lus) + `get_conversation` (en-tête + carte épinglée).
- [x] Onglet Inbox **segmenté Chats | Invitations** (Chats en principal, cf. maquette) + écran `chat/[id]` (**FlashList v2 `startRenderingFromBottom`** — v2 n'a plus `inverted` —, carte invitation épinglée en header, composer natif, bulles, séparateurs de jour, abonnement Realtime + cleanup).
- [x] `get_person.conversation_id` → bouton **Message** sur la fiche quand matché (**clôt le différé brique 5** « état matched »). Accept d'une invitation → entre direct dans le chat.
- [x] **Décision** : **helper maison** (hooks `useConversations`/`useChat`), pas de `@tanstack/react-query` (cohérent avec le reste du repo, zéro nouvelle dépendance).
- **✅ Acceptation** : invitation acceptée → conversation ; **2 appareils échangent en temps réel** (FlashList depuis le bas, dédup par id, normalisation du `created_at` Realtime).
- **Revue adversariale** (ultracode, 7 dimensions × find→verify, **19 findings → 15 confirmés**, 13 corrigés + 2 différés) : dont **high** = `created_at` Realtime (format Postgres brut non parsable par Hermes → tri + séparateurs cassés) normalisé (`toIsoTimestamp`) ; **medium** = `created_at`/`id` forgeables (→ GRANT colonne), échec d'envoi silencieux (→ erreur inline + `maxLength`), pas de resync au retour au premier plan (→ listener `AppState` + re-snapshot au `SUBSCRIBED`). Lows : index inutile supprimé, débounce `mark_read`, `myId` via ref, course join/snapshot, `bio` nullable honnête, layout timestamp liste, spinner retry, `KeyboardAvoidingView` Android. `tsc`/`lint` verts.
- **Différés (lows documentés)** : garde anti-double-tap sur les `push` de navigation (app-wide, déjà différé brique 5) ; marquage « lu » d'un message reçu quand le chat est monté mais pas au premier plan (fenêtre étroite, sans perte de donnée) ; **présence « Online »** (Realtime Presence) et **recherche** dans la liste Chats (hors acceptation, non triviaux en natif) → plus tard.

## Brique 6.5 — Inbox unifiée (un fil par personne)
*But : fusionner « chats + invitations + sent » (3 endroits, frontière `incoming/outgoing`
bancale) en UN flux cohérent, une ligne par personne, avec un compteur d'attention unique sur
l'onglet. L'axe de rangement devient « ça m'attend, oui/non », plus « qui a envoyé ».*
- [x] RPC `get_inbox` (`security definer`) : UNION des conversations (matchs) + des invitations
  qui **m'attendent** (`awaiting_response_from = moi`, actives, hors paires déjà matchées) en
  une ligne homogène (`kind`, `state`, `needs_me`, `sort_ts`, aperçu, activité). Tri : mon tour
  d'abord puis récence. `needs_me` d'une conversation = pointeur de lecture NULL **ou** non-lus > 0
  (un match jamais ouvert compte ; celui qui accepte a ouvert le chat -> pointeur posé -> ne compte pas).
- [x] RPC `get_inbox_count` = `count(*) where needs_me` de `get_inbox` (source **unique** du badge).
- [x] Onglet **Inbox** = une seule `FlashList` (`InboxRow`), plus de `Segmented` ; aperçu + badge
  « Your Turn » pilotés par `state` ; tap -> `chat/[id]` ou `invitation/[id]` selon `kind`.
- [x] Écran **Sent** = file d'attente vivante : invitations où **j'attends l'autre**
  (`!awaiting_me`, actives) ; les résolues en sortent (accepté -> chat dans l'Inbox / refusé -> disparaît).
- [x] **Badge natif** d'onglet (`NativeTabs.Trigger.Badge`, vérifié dans le package SDK 56) alimenté
  par `InboxBadgeProvider` / `useInboxBadge` : fetch au montage + retour au premier plan ; quand l'Inbox
  est montée, le compte est **dérivé de la liste chargée** (`setCount`, pas de 2ᵉ RPC). La
  différenciation message/invitation vit dans la **ligne** (et le **texte** des push en brique 8).
- [x] Nettoyage : `useConversations`/`ConversationRow` supprimés ; `data/conversations` perd la liste
  (désormais via `get_inbox`). Migration `20260701130000` appliquée au distant + types régénérés.
- **✅ Acceptation** : un seul flux lisible (invites + chats mêlés, tri « mon tour » d'abord) ; badge
  reflétant « ce qui m'attend » ; `tsc`/`lint` verts. **Vérifié bout-en-bout** (seed 6 lignes Inbox +
  4 Sent, badge 4, appel réel de `get_inbox` connecté au compte de test) + testé sur device.
- **Revue adversariale** (ultracode, 3 dimensions × find→verify, 7 findings → **5 confirmés, tous low**) :
  corrigés — **#4** `other_avatar_path` resserré `string | null` (règle « typer honnêtement à la source ») ;
  **#5** double exécution de `get_inbox` au focus supprimée (badge dérivé de la liste via `setCount`).
  Réfutés : « code mort declined » (`subtitleFor` atteignable), « asymétrie du fold » (inatteignable).
- **Différés (lows documentés)** : **#1** ré-invitation après match repliée hors flux+badge — **non
  atteignable via l'UI** (fiche « Message » quand matché), à reprendre avec la ré-invitation in-chat ;
  **#2** `get_inbox_count` recalcule tout `get_inbox` (perf, acceptable à l'échelle MVP — few conversations) ;
  **#3** badge non-live entre deux visites de l'onglet (over-count après Accept / under-count sur message
  reçu) — s'auto-corrige au re-focus de l'Inbox ; le live = **brique 8** (Realtime/push).

## Brique 7 — Explore Activities (découverte)
*But : surface de découverte par activité.*
- [ ] Explore → **Activities** (`ActivityCard` + `AvatarStack` « +12 »)
- [ ] Écran `activity/[id]` (hero, description, closest locations, people close)
- [ ] Écran `all-locations` cherchable
- **✅ Acceptation** : liste d'activités ; Activity View ; All Locations cherchable.

## Brique 8 — Notifications push + deep links
*But : notifier en temps réel.*
- [ ] Edge Function `send-push` + **Database Webhooks** (invitations insert/update, messages insert) + secrets
- [ ] Client : permission + token Expo (`projectId`, → table `push_tokens`), `setNotificationHandler` (popup foreground), deep-link → `invitation/[id]` ou `chat/[id]`, **badge** sur l'onglet Inbox
- [ ] Prérequis **FCM** (Android) / **APNs** (iOS) chez EAS
- [x] ~~Activer **Modify**~~ → **fait en brique 5** (modèle « tour de parole » : réécriture en place + `awaiting_response_from`, RPC `modify_invitation` ; pas de colonnes `proposed_*`).
- **✅ Acceptation** : invitation/message → push ; tap deep-link ouvre le bon écran ; bannière in-app en foreground.

---

## Dette technique connue

### Résolution GPS → ville = nearest-center (à revoir avant la 2ᵉ ville)
Aujourd'hui `set_my_location` rattache un point GPS à une ville par **« centre seedé le plus proche
dans un rayon de 50 km »** (`ST_DWithin(c.center, point, 50000)` + `order by ST_Distance limit 1`,
sinon `city_id = NULL`). Chaque ville n'est qu'**un point-centre** (`cities.center`), **pas un
polygone de frontière** — on ne teste donc jamais si le point est réellement *dans* la ville.

- **OK pour le MVP** : avec **une seule ville**, tout point à ≤ 50 km de Khon Kaen → Khon Kaen ;
  au-delà → « hors zone ». Aucun risque de confusion de villes (il n'y a qu'un centre).
- **Casse en multi-ville** : nearest-center = partition de **Voronoï** → la frontière entre 2 villes
  est la **médiatrice** de leurs centres, pas la vraie limite. Faux près des frontières, surtout si
  les villes ont des **tailles différentes** ou si le **rayon uniforme de 50 km** ne colle pas.
- **Correctif (le jour où on seede la ville #2, surtout si 2 villes sont à < ~100 km)** : passer à
  des **polygones de frontière** — colonne `cities.boundary geography(MultiPolygon)` (contours
  OSM/GADM) + test `ST_Covers(boundary, point)`, avec index GiST. Étape intermédiaire possible :
  un `radius_m` **par ville** au lieu des 50 km fixes. L'archi (`city_id` FK partout) permet de
  **changer uniquement la méthode de résolution** sans rien casser ailleurs.
- **Aussi** : le plan initial mentionnait un **reverse-geocoding** (`reverseGeocodeAsync → city_id`)
  jamais implémenté — le client envoie juste `lat/lng` à `set_my_location`. Alternative robuste aux
  frontières si on ne veut pas gérer de polygones, mais dépend d'un service externe + matching de noms.

### Voyage hors zone : `city_id` → NULL (assumé pour le MVP)
Ouvrir Explore capture la position (localisation **live**). Hors des 50 km d'une ville seedée,
`set_my_location` met `city_id = NULL` → l'utilisateur n'est plus découvrable et voit « hors zone ».
**C'est voulu** : « live » = *je suis dans cette ville maintenant* ; ailleurs, on n'apparaît pas à
Khon Kaen. Ça **s'auto-répare** au retour (re-capture) et le routing dépend du **pseudo**, pas de ce
flag. Évolution premium = parcourir une **autre ville** sans y être (cf. nearest-center ci-dessus).

---

## Comment tester (rappel)
- Build/run : `source ~/android-build/env.sh && npx expo run:android` (Pixel 10 Pro en USB).
- `npx tsc --noEmit` doit rester vert (zéro `as`).
- Entrer dans l'app : numéro `0600000000`, code `123456`.
- Boucle cœur (après brique 6) : 2 comptes de test, A invite B → B accepte → chat temps réel sur 2 appareils.
