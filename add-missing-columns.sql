-- Add missing stripe_session_id column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Add missing stripe_session_id column to payouts table  
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payouts_stripe_session_id ON payouts(stripe_session_id);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('bookings', 'payouts') 
AND column_name = 'stripe_session_id';
