-- Migration: Add returned_qty and admin_verified columns to transaction_items
-- Run this in Supabase SQL editor if your database already exists

-- Add returned_qty column if it doesn't exist
ALTER TABLE public.transaction_items 
ADD COLUMN IF NOT EXISTS returned_qty int DEFAULT 0;

-- Add admin_verified column if it doesn't exist (used in AdminVerify page)
ALTER TABLE public.transaction_items 
ADD COLUMN IF NOT EXISTS admin_verified boolean DEFAULT false;

-- Update existing rows to set returned_qty = qty for closed transactions
UPDATE public.transaction_items 
SET returned_qty = qty 
WHERE returned_qty IS NULL OR returned_qty = 0
AND transaction_id IN (
  SELECT id FROM public.transactions WHERE status = 'closed'
);
