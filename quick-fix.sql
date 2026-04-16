-- Quick fix for missing stripe_session_id column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
