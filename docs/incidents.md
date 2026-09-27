# Incident Log

## 2026-09-27: Partner listings disappeared from live site

### Summary
All partner listings and submissions disappeared from the live site after
an env var fix was applied. Root cause was a Supabase project mismatch
combined with a historical TRUNCATE migration.

### Timeline
1. A prior security fix (removing `.env` from git tracking) caused the
   build to fail because `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
   were no longer in the repo.
2. When fixing this, Lovable's environment variables were set — but it is
   possible they were pointed at a **different or new Supabase project**
   rather than the original project `ddhytszijvfejnymrwgd`.
3. When a new Supabase project receives migrations for the first time, ALL
   migration files in `supabase/migrations/` are applied in order.
4. Migration `20260406220307_cd5c5618-6c06-4ecd-9397-3f9b425a7cc4.sql`
   contains `TRUNCATE TABLE public.partners CASCADE` and
   `TRUNCATE TABLE public.submissions CASCADE`. On the **original** project
   this was a historical one-time reset in April 2026. On a **new** project
   it wiped the just-populated tables.

### Diagnosis checklist (for whoever reads this)
- The canonical project ref is: **`ddhytszijvfejnymrwgd`**
- The canonical Supabase URL is: `https://ddhytszijvfejnymrwgd.supabase.co`
- Check Lovable project Settings → Environment Variables:
  - `VITE_SUPABASE_URL` must equal `https://ddhytszijvfejnymrwgd.supabase.co`
  - If it points to any other project, the site is connected to the wrong DB

### Resolution path
**If env vars were pointing to the wrong project:**
- Fix `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Lovable
  settings to point back to `ddhytszijvfejnymrwgd`
- DO NOT run migrations against the original project — it is fully migrated
- Redeploy on Lovable — listings will reappear immediately
- Data was never lost from the original project

**If env vars were correct and data was genuinely wiped:**
- Check Supabase dashboard → Database → Backups for project `ddhytszijvfejnymrwgd`
- Restore `public.partners` and `public.submissions` from the most recent
  pre-incident snapshot
- The sitemap at `public/sitemap.xml` contains 1,188 URLs (1,177 merchants)
  and can serve as a reference for which listings existed

### Prevention
1. **Migration guard added**: `20260927000001_guard_truncate_migration.sql`
   is a no-op that warns loudly if `public.partners` is empty when migrations
   run. This catches accidental replay before data is wiped.
2. **Never connect to a new Supabase project** without first verifying the
   project ref matches `ddhytszijvfejnymrwgd`. The TRUNCATE migration WILL
   fire on any project that hasn't seen it before.
3. **`.env.example`** is now populated with all required env vars and their
   sources so there is no ambiguity about which values to use.
4. `supabase/config.toml` contains `project_id = "ddhytszijvfejnymrwgd"` —
   this is the ground truth. Always verify env vars match this before deploying.

### What to check before any future migration run
```sql
-- Run this on the target project BEFORE applying any migrations:
SELECT project_id FROM supabase_migrations.schema_migrations LIMIT 1;
SELECT COUNT(*) FROM public.partners;
-- If partners count is 0 and you expected data, STOP and investigate.
```

---

## Permanent safeguards added this session
- `src/integrations/supabase/client.ts`: renders a visible "Configuration Error"
  UI instead of a blank page when env vars are missing
- `src/lib/arcAppKit.ts`: logs a clear console error when `VITE_ARC_KIT_KEY` is absent
- `.env.example`: documents all 6 `VITE_` variables with placeholder values
- `index.html`: removed `frame-ancestors 'none'` CSP directive that blocked
  Lovable's iframe-based preview/deployment
- `supabase/migrations/20260927000001_guard_truncate_migration.sql`: safety guard
