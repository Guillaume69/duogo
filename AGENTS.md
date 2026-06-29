# AGENTS.md

Guide d'architecture et de conventions pour DuoGo. Lu par tous les agents IA du repo
(`CLAUDE.md` ne fait que l'importer).

## ⚠️ Avant d'écrire le moindre code Expo

**Expo SDK 56 a changé** (APIs, imports, plugins). Lis la doc **versionnée exacte** avant de
coder : https://docs.expo.dev/versions/v56.0.0/ — ne te fie pas à la mémoire des versions
antérieures.

## Le projet

DuoGo — app mobile de **matching d'activité entre 2 utilisateurs**. **Expo SDK 56** (Expo
Router) + **Supabase**. Méthode : **MVP step-by-step**, brique par brique.

- `docs/ROADMAP.md` = **source de vérité du « quoi faire ensuite »** (8 briques ordonnées par
  dépendances, cases à cocher au fur et à mesure).
- `docs/CHECKPOINT.md` = contexte de reprise (où on en est, comment lancer). À lire en début de session.

## Commandes

| But | Commande |
|---|---|
| Build + run natif Android (Pixel 10 Pro, USB) | `source ~/android-build/env.sh && npx expo run:android` |
| Typecheck — **doit rester vert** | `npx tsc --noEmit` |
| Lint | `npm run lint` *(= `expo lint`)* |
| Dev server seul | `npx expo start` |
| Régénérer les types Supabase *(après CHAQUE migration)* | `npx supabase gen types typescript --linked > src/lib/database.types.ts` |

- Le `source ~/android-build/env.sh` charge `JAVA_HOME`/`ANDROID_HOME`. **Rebuild natif obligatoire**
  après l'ajout d'un module natif ; sinon le Fast Refresh suffit.
- `.env` (gitignoré) doit contenir `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (cf. `.env.example`). Le préfixe `EXPO_PUBLIC_` expose la variable au bundle client.
- **Entrer dans l'app en dev** (numéro de test, sans vrai SMS) : `0600000000` → OTP `123456`
  (Twilio est parqué ; numéro de test valide jusqu'au 2026-08-31).

## Architecture (vue d'ensemble)

**Organisation de `src/`** (alias `@/*` → `src/*`, rangé **par nature** de fichier) :
`app/` écrans + layouts (Expo Router, **seul** dossier de routing) · `providers/` Context + hook
d'état transverse (`auth`, `profile`, `location`, `filters`, `country`, `invite-draft`) · `hooks/`
hooks React réutilisables non-provider (`useNearbyPeople`, `useEditProfileForm`) · `data/` couche
d'accès Supabase, fonctions pures (cf. ci-dessous) · `utils/` helpers purs sans React (`datetime`,
`countries`, `person-format`, `profile-fields`, `invite-events`) · `components/` UI réutilisable ·
`lib/` **infra bas niveau uniquement** (`supabase.ts`, `database.types.ts`) · `theme.ts` tokens.

**Routing piloté par la session.** Expo Router, file-based, sous `src/app/` uniquement (écrans +
layouts). Tout le reste du code vit sous `src/` (alias `@/*` → `src/*`). Deux groupes de routes
gardés par l'état d'auth :

- `src/app/_layout.tsx` monte `SafeAreaProvider > AuthProvider`, puis un `RootNavigator` qui rend
  `<Stack.Protected guard={!!session}>` → groupe `(app)` et `guard={!session}` → groupe `(auth)`.
  Le splash reste affiché tant que `loading`. **Conséquence : on change d'écran en changeant
  l'état (la session/le profil), pas avec `router.push`.** Même mécanique à répliquer pour le
  guard d'onboarding (profil complet).
- `(auth)/` : `login` (téléphone E.164 via `libphonenumber-js`) → `verify` (OTP) → `country`
  (picker d'indicatif, défaut déduit de la locale via `expo-localization`). `(app)/` : connecté.

**Supabase, pas de backend Express.** L'app parle **directement à PostgREST**. La validation vit
**dans la base** : contraintes + **RLS** + **RPC `SECURITY DEFINER`** pour les transitions
sensibles (jamais d'`UPDATE` RLS exposé) ; + validation client pour l'UX seulement. Le **seul**
bout serveur prévu pour le MVP = une **Edge Function** (push). Client dans `src/lib/supabase.ts`
(AsyncStorage, `autoRefreshToken` lié à `AppState`). ⚠️ Accès à une table = **deux couches** :
`GRANT` de table **ET** policy RLS (cf. migration `…_api_role_grants`).

**Couche d'accès aux données (`src/data/`).** Les requêtes Supabase ne vivent **jamais** dans un
écran ni en dur dans un Provider : chaque domaine a un module `src/data/<domaine>.ts` (ex.
`src/data/profiles.ts`) de **fonctions pures** (sans React), typées via les types générés (zéro
`as`), qui **lèvent en cas d'échec** et renvoient la donnée directement. Les Providers/hooks les
appellent et ne gèrent que l'**état React** (ils n'importent pas `supabase`). Les écrans ne
connaissent ni `supabase` ni les tables — ils passent par le hook (ex. `useProfile()`).

**Auth/session.** `src/providers/auth.tsx` : `AuthProvider` s'abonne à `getSession()` +
`onAuthStateChange`, expose `{ session, loading }` via `useAuth()`. C'est le pivot du routing.

**Pattern Context.** Chaque état transverse = un `Provider` + un hook `useX()` qui **throw hors
de son provider** (modèles : `src/providers/country.tsx`, `src/providers/auth.tsx`). Déjà en place
dans `src/providers/` : `profile`, `location`, `filters`, `invite-draft` ; à répliquer pour les
prochains états transverses.

## Où placer la logique (RLS-first, 4 étages)

Archi **Supabase-native** : RLS **d'abord**, on monte d'un étage **seulement** quand celui du
dessous ne suffit pas. Les étages **coexistent** (additif) — ajouter un étage ne fait jamais
« sortir » de RLS ; le modèle de données posé reste valide même si un backend arrive plus tard.

| Besoin | Étage |
|---|---|
| L'utilisateur agit sur **ses** données, règles simples | **Client → PostgREST + RLS** (~80 % de l'app) |
| Atomique / multi-lignes / machine à états / lit des données que l'appelant ne voit pas | **RPC** `security definer` (via PostgREST) |
| Secrets, **API externes**, déclenché par event/webhook, planifié | **Edge Function** (Deno) |
| Compute lourd/long, stateful, service séparé | **Backend dédié** — **hors MVP** |

- **Règle d'or : chaque règle métier a UN seul propriétaire.** Invariants de données → la base
  (contraintes / RLS / RPC / triggers). Intégration externe → Edge Function. Confort UX → client
  (validation cosmétique, doublon **assumé** de la base). Ne **jamais** dupliquer une règle de
  sécurité entre deux étages, ni faire en plusieurs calls client ce qui doit être **une RPC atomique**.
- **Contrôle d'accès, du plus large au plus fin** : GRANT de **table** (le rôle touche-t-il la
  table ?) → GRANT de **colonne** (quelles colonnes écrire/lire — l'outil pour « champ non
  modifiable ») → RLS **`USING`** (quelles lignes) → RLS **`WITH CHECK`** (quelles valeurs) →
  **trigger** (règles OLD vs NEW : immuable, dérivé) → **RPC** (opération sensible encapsulée).
  ⚠️ La RLS filtre des **lignes**, pas des colonnes. La base est la **frontière de confiance** ;
  le client est non fiable, donc tout invariant se défend **dans la base**.
- **Un backend dédié n'est justifié que** si : matching ML/scoring lourd, modération/anti-fraude
  temps réel, analytics massives, Realtime+RLS qui plafonne, ou limites/cold-starts Edge gênants
  sur un chemin critique. Sinon **non**. Il s'ajoute **devant** Supabase (service_role pour ses
  écritures), sans retirer la RLS existante.

## Règles dures (non négociables)

- **Zéro `as` TypeScript.** Typer honnêtement **à la source**, jamais asserter au point d'usage
  (exceptions : imports, ou cas de force majeure **extrêmement rares**). Pour Supabase :
  `createClient<Database>` + types générés, pas d'assertion sur les retours. Pour les params de
  route : `useLocalSearchParams<{…}>()` + garde `undefined`. Un `as` = le symptôme d'un type trop
  large **en amont** → resserrer en amont.
- **Langues.** UI de l'app en **anglais** ; commentaires de code en **français** ; réponses à
  l'utilisateur en **français**.
- **Aucun design custom** pour l'instant : design **stock des 2 OS**, **maximum d'éléments
  natifs** (NativeTabs, `expo-symbols`, `expo-image`, `@shopify/flash-list`, **drop-ins natifs
  `@expo/ui`** ex. `@expo/ui/community/picker` ; pour les dates `@react-native-community/datetimepicker`
  — le datetime-picker `@expo/ui` était janky). **Natif d'abord, priorité absolue** ; custom JS
  **uniquement en dernier recours** (et si le natif ne sait pas faire, le DIRE, ne pas bricoler).
  App **verrouillée en mode clair** (`userInterfaceStyle: light`).
- **Valeurs de style centralisées** dans `src/theme.ts` (tokens : `colors` / `fontSize` /
  `radius` / `space`). Les `StyleSheet` référencent les tokens — **pas de magic numbers**
  (`#111`, `fontSize: 16`…) dans les composants. (Tokens ≠ design custom : juste de la cohérence.)
- **Jamais modifier `auth.users`** → tout passe par une table `profiles` qui la référence (FK).
- **Coordonnées GPS jamais renvoyées au client** (GRANT colonne + RPC qui ne sort que la distance).
- **Multi-ville dès le départ** : table `cities` + FK `city_id` partout, jamais de ville en dur
  (le MVP ne seede qu'une ville).
- **Migrations versionnées** dans `supabase/migrations/` ; **régénérer `database.types.ts` après
  chaque migration**.

## Méthode de travail

Itérer **brique par brique** selon `docs/ROADMAP.md` (cocher au fur et à mesure). **Commit
uniquement quand l'utilisateur le demande** ; il commit directement sur `main`.
