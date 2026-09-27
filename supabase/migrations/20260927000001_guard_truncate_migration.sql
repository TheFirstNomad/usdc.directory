-- SAFETY GUARD: This migration exists solely to document that
-- 20260406220307_cd5c5618-6c06-4ecd-9397-3f9b425a7cc4.sql
-- (which contains TRUNCATE TABLE public.partners CASCADE and
-- TRUNCATE TABLE public.submissions CASCADE) has already been
-- applied to this project and must never execute again.
--
-- INCIDENT: 2026-09-27 — When Lovable env vars were misconfigured
-- pointing to a fresh Supabase instance, that migration ran against
-- the new empty project. On the original project (ddhytszijvfejnymrwgd)
-- the TRUNCATE ran historically in April 2026 when the directory data
-- was intentionally reset. All subsequent data was re-populated and
-- is intact on the original project.
--
-- This file is a no-op. Its only purpose is to be recorded in
-- supabase_migrations.schema_migrations so any future migration replay
-- tool sees the TRUNCATE migration as already applied in context.
--
-- DO NOT DELETE THIS FILE. DO NOT EDIT THE TRUNCATE MIGRATION FILE.
-- Migration integrity requires the historical file to remain unchanged.

DO $$
BEGIN
  -- Verify partners table exists and is not empty. If it is empty,
  -- raise a warning so a DBA can investigate before proceeding.
  IF (SELECT COUNT(*) FROM public.partners) = 0 THEN
    RAISE WARNING 'SAFETY CHECK: public.partners is empty. If this is unexpected, restore from backup before running further migrations. Incident documented in docs/incidents.md.';
  END IF;
END $$;
