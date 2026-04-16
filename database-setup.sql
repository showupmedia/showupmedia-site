-- ========================================
-- SHOW UP MEDIA DATABASE SETUP
-- ========================================
-- Run these commands in your Supabase SQL editor
-- ========================================

-- 1. Enhanced webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    failed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_result JSONB
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- 2. Create enhanced payouts table with settlement tracking
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payouts_business_id ON payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_settlement_date ON payouts(stripe_settlement_date);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- 3. Enhanced bookings table with payment tracking
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'gbp',
ADD COLUMN IF NOT EXISTS stripe_payment_status TEXT,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id ON bookings(stripe_payment_intent_id);

-- 4. Businesses table - ensure bank_details column exists
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS bank_details TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS payout_preference TEXT DEFAULT 'bank_transfer';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_plan ON businesses(plan);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_subdomain ON businesses(subdomain);

-- 5. Services table - ensure proper constraints
ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS booking_window_minutes INTEGER DEFAULT 60;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- 6. Staff table - ensure proper structure
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS hire_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_business_id ON staff(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active);

-- 7. Create views for better reporting
CREATE OR REPLACE VIEW business_earnings_summary AS
SELECT 
    b.id as business_id,
    b.name as business_name,
    b.email as business_email,
    COUNT(bo.id) as total_bookings,
    COALESCE(SUM(bo.gross_amount), 0) as gross_revenue,
    COALESCE(SUM(p.total_fees), 0) as total_fees,
    COALESCE(SUM(p.net_amount), 0) as net_payout,
    COALESCE(SUM(CASE WHEN p.status = 'pending_settlement' THEN p.net_amount ELSE 0 END), 0) as accumulated_earnings,
    MAX(bo.created_at) as last_booking_date
FROM businesses b
LEFT JOIN bookings bo ON b.id = bo.business_id
LEFT JOIN payouts p ON bo.id = p.booking_id
WHERE b.status = 'active'
GROUP BY b.id, b.name, b.email;

-- 8. Create function to calculate settlement dates
CREATE OR REPLACE FUNCTION calculate_settlement_date(booking_date DATE)
RETURNS DATE AS $$
DECLARE 
    settlement_date DATE;
    business_days_to_add INTEGER := 3;
BEGIN
    settlement_date := booking_date;
    
    WHILE business_days_to_add > 0 LOOP
        settlement_date := settlement_date + INTERVAL '1 day';
        
        -- Skip weekends (Saturday=6, Sunday=0)
        IF EXTRACT(DOW FROM settlement_date) IN (0, 6) THEN
            CONTINUE;
        END IF;
        
        business_days_to_add := business_days_to_add - 1;
    END LOOP;
    
    RETURN settlement_date;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Businesses policies
CREATE POLICY "Businesses are viewable by everyone" ON businesses
    FOR SELECT USING (true);

CREATE POLICY "Businesses are insertable by authenticated users" ON businesses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Businesses are updatable by owners" ON businesses
    FOR UPDATE USING (auth.uid() = user_id);

-- Bookings policies
CREATE POLICY "Bookings are viewable by business owners" ON bookings
    FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Bookings are insertable by authenticated users" ON bookings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Bookings are updatable by business owners" ON bookings
    FOR UPDATE USING (auth.uid() = business_id);

-- Services policies
CREATE POLICY "Services are viewable by business owners" ON services
    FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Services are manageable by business owners" ON services
    FOR ALL USING (auth.uid() = business_id);

-- Staff policies
CREATE POLICY "Staff are viewable by business owners" ON staff
    FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Staff are manageable by business owners" ON staff
    FOR ALL USING (auth.uid() = business_id);

-- Payouts policies
CREATE POLICY "Payouts are viewable by business owners" ON payouts
    FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Payouts are insertable by system" ON payouts
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Payouts are updatable by system" ON payouts
    FOR UPDATE USING (auth.role() = 'service_role');

-- Webhook events policies
CREATE POLICY "Webhook events are insertable by system" ON webhook_events
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Webhook events are viewable by system" ON webhook_events
    FOR SELECT USING (auth.role() = 'service_role');

-- ========================================
-- SETUP COMPLETE
-- ========================================
-- 
-- After running this SQL:
-- 1. All tables will be properly structured
-- 2. Indexes will be created for performance
-- 3. Views will be available for reporting
-- 4. RLS policies will be in place for security
-- 5. Triggers will automatically update timestamps
-- 
-- Next steps:
-- 1. Set environment variables in Netlify dashboard
-- 2. Configure Stripe webhook endpoint
-- 3. Test all API endpoints
-- 4. Deploy to production
-- ========================================
