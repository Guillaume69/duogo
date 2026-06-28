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
(AsyncStorage, `autoRefreshToken` lié à `AppState`).

**Auth/session.** `src/lib/auth.tsx` : `AuthProvider` s'abonne à `getSession()` +
`onAuthStateChange`, expose `{ session, loading }` via `useAuth()`. C'est le pivot du routing.

**Pattern Context.** Chaque état transverse = un `Provider` + un hook `useX()` qui **throw hors
de son provider** (modèles : `src/lib/country.tsx`, `src/lib/auth.tsx`). À répliquer pour les
futurs `ProfileProvider` / `LocationProvider` / `FilterProvider`.

## Règles dures (non négociables)

- **Zéro `as` TypeScript.** Typer honnêtement **à la source**, jamais asserter au point d'usage
  (exceptions : imports, ou cas de force majeure **extrêmement rares**). Pour Supabase :
  `createClient<Database>` + types générés, pas d'assertion sur les retours. Pour les params de
  route : `useLocalSearchParams<{…}>()` + garde `undefined`. Un `as` = le symptôme d'un type trop
  large **en amont** → resserrer en amont.
- **Langues.** UI de l'app en **anglais** ; commentaires de code en **français** ; réponses à
  l'utilisateur en **français**.
- **Aucun design custom** pour l'instant : design **stock des 2 OS**, **maximum d'éléments
  natifs** (NativeTabs, `@expo/ui`, `expo-symbols`, `expo-image`, `@shopify/flash-list`), le plus
  fluide possible. App **verrouillée en mode clair** (`userInterfaceStyle: light`).
- **Jamais modifier `auth.users`** → tout passe par une table `profiles` qui la référence (FK).
- **Coordonnées GPS jamais renvoyées au client** (GRANT colonne + RPC qui ne sort que la distance).
- **Multi-ville dès le départ** : table `cities` + FK `city_id` partout, jamais de ville en dur
  (le MVP ne seede qu'une ville).
- **Migrations versionnées** dans `supabase/migrations/` ; **régénérer `database.types.ts` après
  chaque migration**.

## Méthode de travail

Itérer **brique par brique** selon `docs/ROADMAP.md` (cocher au fur et à mesure). **Commit
uniquement quand l'utilisateur le demande** ; il commit directement sur `main`.
