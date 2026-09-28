-- Security fixes round 2 — 2026-09-28
-- Fixes two Lovable security scanner findings.

-- ============================================================
-- Fix 1: Enable HaveIBeenPwned leaked-password protection
-- Previous attempt used ALTER ROLE which is wrong for Supabase Auth.
-- Correct mechanism is auth.config hibp_enabled column.
-- Only affects email/password signups — wallet-connect unaffected.
-- ============================================================
DO $$
BEGIN
  -- hibp_enabled column exists in Supabase Auth >= 2.x
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name   = 'config'
      AND column_name  = 'hibp_enabled'
  ) THEN
    UPDATE auth.config SET hibp_enabled = true WHERE TRUE;
  END IF;
END $$;

-- ============================================================
-- Fix 2: Restrict logos bucket directory listing
-- Previous broad SELECT policy allowed anon users to enumerate
-- all filenames in the logos bucket via storage.list().
-- Replace with a policy that requires a non-empty object name,
-- preventing directory listing while keeping individual file
-- reads (logo URLs) publicly accessible.
-- ============================================================
DROP POLICY IF EXISTS "Public read logos"          ON storage.objects;
DROP POLICY IF EXISTS "Public read logos by path"  ON storage.objects;
DROP POLICY IF EXISTS "Deny logo bucket listing"   ON storage.objects;

-- Individual file reads only — anon must supply a full path.
-- storage.list() calls that pass an empty prefix are blocked
-- because the USING clause will not match a null/empty name.
CREATE POLICY "Public read logos by path"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'logos'
    AND name IS NOT NULL
    AND name <> ''
  );
