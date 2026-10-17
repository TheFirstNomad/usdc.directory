-- Add payment_amount to track actual USDC paid per submission
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS payment_amount numeric(10,6) DEFAULT NULL;

-- Back-fill existing confirmed submissions with 3 USDC (standard fee)
UPDATE public.submissions
  SET payment_amount = 3
  WHERE payment_amount IS NULL
    AND payment_status IN ('confirmed', 'finished', 'sending');
