-- Migration to add metadata column to communication_history table
-- This allows linking SMS and Email blasts to specific records (like attendance_sessions)

ALTER TABLE public.communication_history
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Optional: Create an index on metadata to optimize queries containing metadata
CREATE INDEX IF NOT EXISTS idx_communication_history_metadata ON public.communication_history USING GIN (metadata);
