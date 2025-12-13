-- Performance Optimization: Add Database Indexes
-- Run this in Supabase SQL Editor for faster queries

-- Index for transactions by user_id (faster employee projects lookup)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
ON public.transactions(user_id);

-- Index for transactions by status (faster open/closed filtering)
CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON public.transactions(status);

-- Index for transactions by created_at (faster sorting)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
ON public.transactions(created_at DESC);

-- Index for transaction_items by transaction_id (faster joins)
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id 
ON public.transaction_items(transaction_id);

-- Index for transaction_items by equipment_id (faster equipment lookup)
CREATE INDEX IF NOT EXISTS idx_transaction_items_equipment_id 
ON public.transaction_items(equipment_id);

-- Index for transaction_assistants by assistant_user_id (faster assistant queries)
CREATE INDEX IF NOT EXISTS idx_transaction_assistants_assistant_id 
ON public.transaction_assistants(assistant_user_id);

-- Index for equipment by name (faster search)
CREATE INDEX IF NOT EXISTS idx_equipment_name 
ON public.equipment(name);

-- Composite index for transactions (user + status)
CREATE INDEX IF NOT EXISTS idx_transactions_user_status 
ON public.transactions(user_id, status);

-- Success message
SELECT 'All performance indexes created successfully!' as message;
