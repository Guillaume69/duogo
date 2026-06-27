# DuoGo

App mobile de **matching d'activité pour 2 utilisateurs**, construite avec
[Expo](https://expo.dev) (SDK 56, Expo Router) et [Supabase](https://supabase.com).

## Stack

- **Expo Router** — routing par fichiers dans `src/app/`
- **TypeScript** strict, alias `@/*` → `src/*`
- **Supabase** (`@supabase/supabase-js`) — accès direct à PostgREST, validation côté DB

## Démarrer

1. Installer les dépendances

   ```bash
   npm install
   ```

2. Configurer Supabase

   ```bash
   cp .env.example .env
   # puis renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
   # (dashboard Supabase → Project Settings → API)
   ```

3. Lancer l'app

   ```bash
   npx expo start
   ```

## Structure

```
src/
  app/            # écrans + layouts (Expo Router uniquement)
    _layout.tsx
    index.tsx
  lib/
    supabase.ts   # client Supabase (AsyncStorage, auto-refresh)
```

> Le code applicatif vit dans `src/` ; seuls les écrans et layouts vont dans `src/app/`.

## Roadmap

- [x] Squelette Expo + client Supabase
- [ ] Authentification par numéro de téléphone
- [ ] Matching d'activité entre 2 utilisateurs
