-- Show Up Media April Launch Promotion Database Schema
-- Add these tables to your existing database for promotion tracking

-- Business Promotions Table
CREATE TABLE IF NOT EXISTS business_promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    promo_code TEXT NOT NULL,
    promo_type TEXT NOT NULL DEFAULT 'april_launch',
    discount_percentage INTEGER DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'used')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promo Usage Tracking Table
CREATE TABLE IF NOT EXISTS promo_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    promo_code TEXT NOT NULL,
    promo_type TEXT NOT NULL DEFAULT 'april_launch',
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    plan_signed_up TEXT,
    original_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    final_price DECIMAL(10,2)
);

-- Promo Analytics Table
CREATE TABLE IF NOT EXISTS promo_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    promo_code TEXT NOT NULL,
    promo_type TEXT NOT NULL DEFAULT 'april_launch',
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'signup', 'payment', 'conversion')),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on promo tables
ALTER TABLE business_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Business Promotions
CREATE POLICY "Businesses can view own promotions" ON business_promotions
  FOR SELECT USING (
    business_promotions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Businesses can insert own promotions" ON business_promotions
  FOR INSERT WITH CHECK (
    business_promotions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Businesses can update own promotions" ON business_promotions
  FOR UPDATE USING (
    business_promotions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- RLS Policies for Promo Usage
CREATE POLICY "Businesses can view own promo usage" ON promo_usage
  FOR SELECT USING (
    promo_usage.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "System can insert promo usage" ON promo_usage
  FOR INSERT WITH CHECK (true);

-- RLS Policies for Promo Analytics
CREATE POLICY "Businesses can view own promo analytics" ON promo_analytics
  FOR SELECT USING (
    promo_analytics.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "System can insert promo analytics" ON promo_analytics
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_promotions_business_id ON business_promotions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_promotions_promo_code ON business_promotions(promo_code);
CREATE INDEX IF NOT EXISTS idx_business_promotions_status ON business_promotions(status);
CREATE INDEX IF NOT EXISTS idx_business_promotions_end_date ON business_promotions(end_date);

CREATE INDEX IF NOT EXISTS idx_promo_usage_email ON promo_usage(email);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo_code ON promo_usage(promo_code);
CREATE INDEX IF NOT EXISTS idx_promo_usage_business_id ON promo_usage(business_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_used_at ON promo_usage(used_at);

CREATE INDEX IF NOT EXISTS idx_promo_analytics_promo_code ON promo_analytics(promo_code);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_event_type ON promo_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_business_id ON promo_analytics(business_id);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_created_at ON promo_analytics(created_at);

-- Function to check if promo is still valid
CREATE OR REPLACE FUNCTION is_promo_valid(promo_code_param TEXT, business_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    promo_record RECORD;
    current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    SELECT * INTO promo_record 
    FROM business_promotions 
    WHERE promo_code = promo_code_param 
      AND business_id = business_id_param
      AND status = 'active'
      AND start_date <= current_time 
      AND end_date > current_time;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get promo discount amount
CREATE OR REPLACE FUNCTION get_promo_discount(promo_code_param TEXT, business_id_param UUID, original_price DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    promo_record RECORD;
    discount_amount DECIMAL := 0;
BEGIN
    SELECT * INTO promo_record 
    FROM business_promotions 
    WHERE promo_code = promo_code_param 
      AND business_id = business_id_param
      AND status = 'active'
      AND start_date <= NOW() 
      AND end_date > NOW();
    
    IF FOUND THEN
        discount_amount := original_price * (promo_record.discount_percentage / 100.0);
        discount_amount := discount_amount + promo_record.discount_amount;
    END IF;
    
    RETURN discount_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire old promotions
CREATE OR REPLACE FUNCTION expire_old_promotions()
RETURNS void AS $$
BEGIN
    UPDATE business_promotions 
    SET status = 'expired', updated_at = NOW()
    WHERE end_date < NOW() 
      AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get promo statistics
CREATE OR REPLACE FUNCTION get_promo_statistics(promo_type_param TEXT DEFAULT 'april_launch')
RETURNS TABLE (
    total_usage BIGINT,
    active_promotions BIGINT,
    total_savings DECIMAL,
    conversion_rate DECIMAL,
    plan_breakdown JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(pu.id) as total_usage,
        COUNT(bp.id) FILTER (WHERE bp.status = 'active') as active_promotions,
        COALESCE(SUM(pu.discount_amount), 0) as total_savings,
        -- Calculate conversion rate (this would need view tracking data)
        CASE 
            WHEN COUNT(pu.id) > 0 THEN (COUNT(pu.id) * 100.0 / 1500.0) -- 1500 is estimated page views
            ELSE 0 
        END as conversion_rate,
        jsonb_build_object(
            'basic', COUNT(pu.id) FILTER (WHERE pu.plan_signed_up = 'basic'),
            'pro', COUNT(pu.id) FILTER (WHERE pu.plan_signed_up = 'pro'),
            'premium', COUNT(pu.id) FILTER (WHERE pu.plan_signed_up = 'premium')
        ) as plan_breakdown
    FROM promo_usage pu
    LEFT JOIN business_promotions bp ON pu.business_id = bp.business_id
    WHERE pu.promo_type = promo_type_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically expire promotions
CREATE OR REPLACE FUNCTION trigger_expire_promotions()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM expire_old_promotions();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (this would be called by a scheduled job)
-- DROP TRIGGER IF EXISTS auto_expire_promotions ON business_promotions;
-- CREATE TRIGGER auto_expire_promotions
--     AFTER INSERT OR UPDATE ON business_promotions
--     FOR EACH ROW EXECUTE FUNCTION trigger_expire_promotions();

-- Insert sample April promotion data (for testing)
INSERT INTO business_promotions (
    promo_code,
    promo_type,
    discount_percentage,
    start_date,
    end_date,
    status
) VALUES 
    ('SHOWUPFREE', 'show_up_launch', 100, '2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z', 'active'),
    ('SHOWUP24', 'show_up_launch', 100, '2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z', 'active'),
    ('LAUNCH26', 'show_up_launch', 100, '2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z', 'active')
ON CONFLICT DO NOTHING;
