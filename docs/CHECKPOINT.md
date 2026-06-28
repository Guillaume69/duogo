# DuoGo — Point d'étape

> Dernière mise à jour : **2026-06-29** · dernier commit : `c58693e`

Doc de reprise : où on en est, comment lancer, ce qui reste. **À lire en début de session.**
Le « quoi faire ensuite » détaillé vit dans [`docs/ROADMAP.md`](./ROADMAP.md) (8 briques, cases
cochées). Les conventions d'archi vivent dans [`AGENTS.md`](../AGENTS.md) (importé par `CLAUDE.md`).

---

## Le projet
App mobile de **matching d'activité entre 2 utilisateurs**. **Expo** (SDK 56, Expo Router) +
**Supabase**. Méthode **MVP brique par brique**. Pas de design custom (stock OS + **max de natif**),
app verrouillée en **mode clair**. UI en **anglais**, commentaires en français. **Zéro `as` TS.**

---

## Où on en est (briques 0 → 3 DONE, poussées, testées sur device)
- **0 — Fondations** (`afe6fab`) : libs natives, CLI Supabase + migrations versionnées, types générés `createClient<Database>`.
- **1 — Shell + profils + onboarding** (`019dd66`) : NativeTabs (Explore/Inbox/Account), `profiles` + trigger + RLS, `ProfileProvider`, onboarding pseudo, Account.
- **2 — Profil complet + géoloc + cities + activités** (`1aed5db`) : avatar Storage, bio/genre/naissance/intérêts, `cities` (seed **Khon Kaen, TH**) + `activities`, `set_my_location` (dérive `city_id`, ne sort jamais les coords).
- **3 — Browse People + filtres + fiche personne** (`c58693e`) :
  - RPC `find_nearby_people` + `get_person` (PostGIS, intra-ville) ; **anti-trilatération** (snap grille ~1 km + arrondi 500 m, helper `snapped_distance_m`) ; jamais de coords client ; DOB durcie (`get_my_profile`, browse = âge seul).
  - **Localisation auto/live** (capture au montage d'Explore) ; `search_location` retirée ; hors zone 50 km → `city_id` NULL (assumé).
  - UI : Explore (segmented People/Activities, `PersonRow`, intérêts communs en avant), sheet **Filter By** (distance/genre/âge multi/activités), fiche `person/[id]` (About + Read More, Interests, Invite inactif).
  - **Icônes natives** : `@expo/ui` `Icon` + `@expo/material-symbols` (XML) + `metro.config.js` (`assetExts += 'xml'`). Pas de rebuild natif (XML parsé au runtime).
  - Corrections de revue : âge en heure locale (`cities.timezone`), filtre rayon indexé (pré-filtre `ST_DWithin` + frontière snappée), robustesse erreurs client.

> Toutes les migrations sont **appliquées sur la base distante** ET commitées dans `supabase/migrations/`.
> Données de dev : profils de test `seed+N@duogo.test` à Khon Kaen ; bios de test sur Ethan/Olivia
> (réversibles : `update profiles set bio = null where display_name in ('Ethan','Olivia')`).

---

## Comment lancer (machine déjà configurée)
```bash
source ~/android-build/env.sh    # JAVA_HOME + ANDROID_HOME
npx expo run:android             # build + install + Metro (Pixel 10 Pro en USB)
# en dev courant (pas de module natif ajouté) : npx expo start  suffit (Fast Refresh)
```
**Entrer dans l'app sans vrai SMS** : numéro **`0600000000`** (🇫🇷 +33) → OTP **`123456`** (valide jusqu'au 2026-08-31).

| But | Commande |
|---|---|
| Typecheck (doit rester vert) | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Régénérer les types Supabase (après CHAQUE migration) | `npx supabase gen types typescript --linked > src/lib/database.types.ts` |
| Pousser une migration | `npx supabase db push` *(le warning pg-delta sur le certificat est cosmétique)* |

---

## ⚙️ Reprendre sur une AUTRE machine
Le **code est sur `main`** (`git pull` suffit) et tout le contexte est dans le repo (ce fichier +
`ROADMAP.md` + `AGENTS.md`). Ce qui **NE transite PAS par git** et doit être (re)mis en place :

1. `npm install` (deps, dont `@expo/material-symbols` ajouté en brique 3).
2. **`.env`** (gitignoré) : copier `.env.example` → `.env` et remplir `EXPO_PUBLIC_SUPABASE_URL` +
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (valeurs publiques, dans le dashboard Supabase → Project Settings → API).
3. **Toolchain Android** : un `~/android-build/env.sh` qui exporte `JAVA_HOME`/`ANDROID_HOME` (JDK + Android SDK installés), et un **device/émulateur branché** (`adb devices`).
4. **Supabase CLI** : `npx supabase login` (token perso, par machine) pour pouvoir `db push` / `gen types`. Le projet est déjà lié via `supabase/config.toml` (commité).
5. La **mémoire auto de Claude** (`~/.claude/.../memory`) est **locale à l'ancienne machine** → le nouveau Claude ne l'aura pas, mais ce CHECKPOINT + `ROADMAP.md` + `AGENTS.md` portent l'essentiel.

---

## ⏭️ Prochaine étape — Brique 4 : Envoi d'invitation
Table `locations` (seed Khon Kaen) + RPC `find_nearby_locations` ; table `invitations` + RLS +
RPC `send_invitation` + index unique partiel anti-spam (1 invitation active par couple) ; flux modal
**Invite to Activity** (`InviteDraftProvider` : activité, date/heure native, créneau ou heure précise,
lieu optionnel, message) ; badge « Invited » dans les listes. *(Détail dans `docs/ROADMAP.md`.)*

### Dette technique à garder en tête (cf. `docs/ROADMAP.md`)
- Résolution GPS→ville = **nearest-center 50 km** (pas de polygone) → à revoir **avant la 2ᵉ ville**.
- Le bouton « Invite to Activity » de la fiche personne est **inactif** (s'active en brique 4).
