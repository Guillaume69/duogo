-- Brique 2 — Storage : bucket `avatars` (privé) + policies « dossier par user ».
-- Bucket PRIVÉ : la lecture passe par une signed URL (générée à l'affichage), pas
-- d'URL publique permanente. Convention de chemin OBLIGATOIRE côté client :
-- `<auth.uid()>/<fichier>` -> c'est le 1er segment du chemin qui porte le contrôle.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', false,
  5242880,                                            -- 5 Mo max
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- storage.objects a déjà la RLS activée par Supabase ; on ajoute nos policies.
-- (storage.foldername(name))[1] = 1er dossier du chemin = l'uid attendu.

-- Écriture : un user n'écrit que dans SON dossier.
create policy "avatars: insert own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- MAJ (nécessaire pour l'upsert/remplacement d'avatar) : ancien ET nouveau dans son dossier.
create policy "avatars: update own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Suppression : un user ne supprime que ses fichiers.
create policy "avatars: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Lecture : avatars semi-privés -> lisibles par TOUT utilisateur connecté
-- (nécessaire pour afficher les avatars d'autrui au browse). Pas `anon`.
create policy "avatars: readable by authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
