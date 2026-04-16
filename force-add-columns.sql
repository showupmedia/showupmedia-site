-- Force add missing columns to existing tables
-- This will work even if tables already exist

-- Drop and recreate bookings table with all required columns
DROP TABLE IF EXISTS bookings CASCADE;

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    business_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status TEXT DEFAULT 'pending_payment',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    gross_amount DECIMAL(10,2),
    currency TEXT DEFAULT 'gbp',
    stripe_payment_status TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_bookings_business_id ON bookings(business_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_stripe_session_id ON bookings(stripe_session_id);
CREATE INDEX idx_bookings_stripe_payment_intent_id ON bookings(stripe_payment_intent_id);

-- Drop and recreate payouts table with all required columns
DROP TABLE IF EXISTS payouts CASCADE;

CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,
    business_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    gross_amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0.50,
    stripe_fee DECIMAL(10,2) NOT NULL,
    total_fees DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    transaction_count INTEGER DEFAULT 1,
    payment_method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'pending_settlement',
    payout_type TEXT DEFAULT 'settlement_based',
    settlement_status TEXT DEFAULT 'pending',
    stripe_settlement_date DATE,
    payout_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payouts_business_id ON payouts(business_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_settlement_date ON payouts(stripe_settlement_date);
CREATE INDEX idx_payouts_created_at ON payouts(created_at);

-- Verify the columns were created
SELECT 'bookings' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'stripe_session_id'
UNION ALL
SELECT 'payouts' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payouts' AND column_name = 'stripe_session_id';
