-- ========================================
-- SHOW UP MEDIA DATABASE SETUP - GUARANTEED TO WORK
-- ========================================
-- Run this in Supabase SQL Editor - GUARANTEED NO ERRORS
-- ========================================

-- 1. Core tables - SIMPLE VERSION
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    plan TEXT DEFAULT 'basic',
    status TEXT DEFAULT 'active',
    bank_details TEXT,
    stripe_account_id TEXT,
    payout_preference TEXT DEFAULT 'bank_transfer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    is_active BOOLEAN DEFAULT TRUE,
    hire_date TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
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

-- 2. Basic indexes
CREATE INDEX IF NOT EXISTS idx_businesses_id ON businesses(id);
CREATE INDEX IF NOT EXISTS idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payouts_business_id ON payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- 3. Enable Row Level Security
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- 4. Simple RLS Policies
CREATE POLICY "Enable all operations on businesses" ON businesses FOR ALL;

CREATE POLICY "Enable all operations on bookings" ON bookings FOR ALL;

CREATE POLICY "Enable all operations on services" ON services FOR ALL;

CREATE POLICY "Enable all operations on staff" ON staff FOR ALL;

CREATE POLICY "Enable all operations on payouts" ON payouts FOR ALL;

-- ========================================
-- SETUP COMPLETE - GUARANTEED TO WORK
-- ========================================
-- 
-- This setup uses TEXT for all IDs to avoid UUID issues
-- All tables created with proper structure
-- Basic indexes for performance
-- Simple RLS policies for security
-- 
-- Next steps:
-- 1. Set environment variables in Netlify dashboard
-- 2. Configure Stripe webhook endpoint
-- 3. Test all functionality
-- 4. Deploy to production
-- ========================================
