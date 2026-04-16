-- Fix missing stripe_session_id column
-- Run this in Supabase SQL Editor if you get "column stripe_session_id does not exist" error

-- Add stripe_session_id to bookings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'stripe_session_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN stripe_session_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);
    END IF;
END $$;

-- Add stripe_session_id to payouts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payouts' AND column_name = 'stripe_session_id'
    ) THEN
        ALTER TABLE payouts ADD COLUMN stripe_session_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_payouts_stripe_session_id ON payouts(stripe_session_id);
    END IF;
END $$;
