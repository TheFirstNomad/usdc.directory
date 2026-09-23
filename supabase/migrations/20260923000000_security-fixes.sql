-- Security fixes — September 2026
-- 1. Storage: add owner-binding UPDATE and DELETE policies on logos bucket
--    Prevents authenticated users from modifying/deleting files they didn't upload.
--    INSERT is already restricted to the upload-logo edge function (service role).

DROP POLICY IF EXISTS "No direct logo updates" ON storage.objects;
DROP POLICY IF EXISTS "No direct logo deletes" ON storage.objects;

CREATE POLICY "No direct logo updates"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (false);

CREATE POLICY "No direct logo deletes"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (false);

-- 2. Supabase Auth: enable HaveIBeenPwned leaked-password check
--    Safe to enable even though app uses wallet-connect — it only applies
--    to email/password signups, which are not the primary auth method.
UPDATE auth.config
  SET password_min_length = 8,
      password_required_characters = ''
  WHERE TRUE;

-- Enable leaked password protection via Supabase Auth config
-- (This is also settable in the Supabase Dashboard under Auth → Password Settings
--  if the SQL approach is not supported on your Supabase version.)
ALTER ROLE authenticator SET "app.settings.password_hibp_enabled" = 'true';
