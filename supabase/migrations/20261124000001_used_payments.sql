-- used_payments: one row per on-chain payment transaction that has been
-- consumed by ANY paid feature (listing, agent listing, boost, paid API).
-- The unique (chain, tx_hash) key makes "claim before granting" atomic, so a
-- single transfer can never fund more than one paid action, even under
-- concurrent requests. Additive only: nothing is dropped or rewritten.

CREATE TABLE IF NOT EXISTS public.used_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain      text NOT NULL,
  tx_hash    text NOT NULL,
  feature    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT used_payments_chain_tx_key UNIQUE (chain, tx_hash)
);

ALTER TABLE public.used_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client reads used_payments"   ON public.used_payments;
DROP POLICY IF EXISTS "No client inserts used_payments" ON public.used_payments;
DROP POLICY IF EXISTS "No client updates used_payments" ON public.used_payments;
DROP POLICY IF EXISTS "No client deletes used_payments" ON public.used_payments;

CREATE POLICY "No client reads used_payments"   ON public.used_payments FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "No client inserts used_payments" ON public.used_payments FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates used_payments" ON public.used_payments FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No client deletes used_payments" ON public.used_payments FOR DELETE TO anon, authenticated USING (false);

REVOKE ALL ON public.used_payments FROM anon, authenticated;
GRANT ALL ON public.used_payments TO service_role;

-- Seed with payments already consumed so historic transactions cannot be
-- replayed through the new check. Each block is isolated: if a source table
-- or column differs in this project, that block is skipped, never fatal.

-- 1) Listings / agent listings: payment_id looks like "<chain>:<tx_hash>".
DO $$
BEGIN
  INSERT INTO public.used_payments (chain, tx_hash, feature)
  SELECT lower(split_part(payment_id, ':', 1)),
         CASE WHEN substr(substring(payment_id FROM position(':' IN payment_id) + 1), 1, 2) = '0x'
              THEN lower(substring(payment_id FROM position(':' IN payment_id) + 1))
              ELSE substring(payment_id FROM position(':' IN payment_id) + 1) END,
         'legacy-submission'
  FROM public.submissions
  WHERE payment_id IS NOT NULL
    AND payment_id LIKE '%:%'
    AND payment_id NOT LIKE 'x402:%'
  ON CONFLICT (chain, tx_hash) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'used_payments seed (submissions) skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  INSERT INTO public.used_payments (chain, tx_hash, feature)
  SELECT lower(split_part(payment_id, ':', 1)),
         CASE WHEN substr(substring(payment_id FROM position(':' IN payment_id) + 1), 1, 2) = '0x'
              THEN lower(substring(payment_id FROM position(':' IN payment_id) + 1))
              ELSE substring(payment_id FROM position(':' IN payment_id) + 1) END,
         'legacy-partner'
  FROM public.partners
  WHERE payment_id IS NOT NULL
    AND payment_id LIKE '%:%'
    AND payment_id NOT LIKE 'x402:%'
  ON CONFLICT (chain, tx_hash) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'used_payments seed (partners) skipped: %', SQLERRM;
END $$;

-- 2) Boosts: raw tx hash plus a chain column.
DO $$
BEGIN
  INSERT INTO public.used_payments (chain, tx_hash, feature)
  SELECT lower(chain),
         CASE WHEN substr(payment_id, 1, 2) = '0x' THEN lower(payment_id) ELSE payment_id END,
         'legacy-boost'
  FROM public.agent_boosts
  WHERE payment_id IS NOT NULL AND chain IS NOT NULL AND payment_id NOT LIKE 'x402:%'
  ON CONFLICT (chain, tx_hash) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'used_payments seed (agent_boosts) skipped: %', SQLERRM;
END $$;

-- 3) Paid API calls that settled by an on-chain transfer (not x402 nonces).
DO $$
BEGIN
  INSERT INTO public.used_payments (chain, tx_hash, feature)
  SELECT lower(chain),
         CASE WHEN substr(payment_id, 1, 2) = '0x' THEN lower(payment_id) ELSE payment_id END,
         'legacy-api'
  FROM public.agent_api_payments
  WHERE scheme = 'onchain' AND payment_id IS NOT NULL AND chain IS NOT NULL
  ON CONFLICT (chain, tx_hash) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'used_payments seed (agent_api_payments) skipped: %', SQLERRM;
END $$;
