-- Add sms_sender_id to organizations table if it doesn't exist
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sms_sender_id text;

-- Create an index to improve lookup performance if needed
CREATE INDEX IF NOT EXISTS idx_organizations_sms_sender_id ON organizations(sms_sender_id);
