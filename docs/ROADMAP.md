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
