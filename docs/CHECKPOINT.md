# DuoGo — Point d'étape

> Dernière mise à jour : **2026-06-28** · dernier commit : `1e14060`

Doc de reprise : où on en est, comment lancer, ce qui reste. À lire en début de session.

---

## Le projet
App mobile de **matching d'activité entre 2 utilisateurs**.
**Expo** (SDK 56, Expo Router) + **Supabase**.

**Conventions**
- Expo Router (routing par fichiers), TypeScript strict, alias `@/*` → `src/*`
- Supabase : l'app écrit **directement dans PostgREST** ; validation **dans la base**
  (contraintes + RLS), plus validation client pour l'UX. Pas de backend Express.
- Approche : **MVP step-by-step**. Pas de design custom pour l'instant (design stock
  OS, on fera le design plus tard). App verrouillée en **mode clair**.

---

## ✅ Fait : Authentification par téléphone (OTP SMS)
Testée de bout en bout sur le Pixel : `login → 6 cases OTP → session → écran connecté → déconnexion`.

- Routing `Stack.Protected` avec groupes `(auth)` (non connecté) et `(app)` (connecté)
- `AuthProvider` / `useAuth` (onAuthStateChange) → `src/lib/auth.tsx`
- Numéro validé en **E.164** via `libphonenumber-js`
- Sélecteur d'indicatif pays, défaut déduit de la locale (`expo-localization`)
- Toggle WhatsApp présent mais **désactivé** (à activer plus tard)

### Structure
```
src/
  app/
    _layout.tsx          # AuthProvider + Stack.Protected (selon session)
    (auth)/
      _layout.tsx        # Stack + CountryProvider
      login.tsx          # téléphone + indicatif → signInWithOtp
      verify.tsx         # 6 cases OTP + resend (30s) → verifyOtp
      country.tsx        # picker pays cherchable
    (app)/
      _layout.tsx
      index.tsx          # écran connecté + déconnexion
  lib/
    supabase.ts          # client (AsyncStorage, auto-refresh)
    auth.tsx             # AuthProvider / useAuth
    country.tsx          # contexte du pays sélectionné
    countries.ts         # liste pays (nom, indicatif, drapeau)
```

---

## Comment lancer
```bash
source ~/android-build/env.sh          # JAVA_HOME + ANDROID_HOME
npx expo run:android                    # build + install + Metro (Pixel 10 Pro en USB)
```
Le `.env` (gitignoré) contient `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Tester l'auth (numéro de test, sans vrai SMS)
- Numéro : **`0600000000`** (indicatif 🇫🇷 +33) → E.164 `+33600000000`
- Code OTP : **`123456`**

---

## ⚠️ Points d'attention
- **Twilio** : le compte du user a été **instant-ban** à la création (mail envoyé au
  support). En attendant, Supabase a des **credentials Twilio bidon** + un **numéro
  de test** (`+33600000000` → `123456`) qui court-circuite Twilio.
  → Les **vrais SMS** ne marcheront qu'avec de **vraies clés Twilio** (à coller dans
  Supabase : Authentication → Providers → Phone), une fois le ban levé.
- **Validité du numéro de test : 2026-08-31** (champ « Test OTPs Valid Until »).
- L'onglet **Users** du dashboard Supabase **buggue** (affiche 0 user) alors que
  `auth.users` contient bien le user — cosmétique, la base est la vérité.
- Le user phone est stocké **sans `+`** (`33600000000`) côté Supabase.

---

## ⏭️ Prochaine étape
**Table `profiles` + RLS** (le cœur du matching) : créer un profil à l'inscription,
puis construire le matching d'activité entre 2 utilisateurs.
