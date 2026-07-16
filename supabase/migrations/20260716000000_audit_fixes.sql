-- Add previous_status to disputes to track pre-dispute milestone status
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Add stripe_session_id to payments to track Stripe payments correctly
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);

-- Update RLS policy for razorpay_accounts to restrict client updates of critical columns
DROP POLICY IF EXISTS "Users can update their own razorpay account" ON public.razorpay_accounts;

CREATE POLICY "Users can update their own razorpay account" ON public.razorpay_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    payouts_enabled = (SELECT payouts_enabled FROM public.razorpay_accounts WHERE user_id = auth.uid()) AND
    account_status = (SELECT account_status FROM public.razorpay_accounts WHERE user_id = auth.uid()) AND
    kyc_status = (SELECT kyc_status FROM public.razorpay_accounts WHERE user_id = auth.uid()) AND
    razorpay_account_id IS NOT DISTINCT FROM (SELECT razorpay_account_id FROM public.razorpay_accounts WHERE user_id = auth.uid())
  );
