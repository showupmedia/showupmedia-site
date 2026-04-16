-- Payouts Table
CREATE TABLE payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  stripe_fee DECIMAL(10,2) NOT NULL,
  total_fees DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, paid, failed
  payment_method TEXT DEFAULT 'bank_transfer', -- bank_transfer, paypal, etc.
  payment_reference TEXT,
  notes TEXT,
  processed_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_payouts_business_id ON payouts(business_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at);

-- Financial Summary View
CREATE VIEW business_financial_summary AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.email as business_email,
  COUNT(DISTINCT bk.id) as total_bookings,
  COALESCE(SUM(s.price), 0) as gross_revenue,
  COALESCE(COUNT(DISTINCT bk.id) * 0.50, 0) as total_platform_fees,
  COALESCE(SUM((s.price * 0.015) + 0.20), 0) as total_stripe_fees,
  COALESCE(SUM(s.price) - (COUNT(DISTINCT bk.id) * 0.50) - SUM((s.price * 0.015) + 0.20), 0) as total_business_earnings,
  COALESCE(SUM(p.amount), 0) as total_paid_out,
  COALESCE(SUM(s.price) - (COUNT(DISTINCT bk.id) * 0.50) - SUM((s.price * 0.015) + 0.20), 0) - COALESCE(SUM(p.amount), 0) as accumulated_earnings,
  MAX(bk.created_at) as last_booking_date,
  MAX(p.created_at) as last_payout_date
FROM businesses b
LEFT JOIN bookings bk ON b.id = bk.business_id AND bk.status = 'confirmed'
LEFT JOIN services s ON bk.service_id = s.id
LEFT JOIN payouts p ON b.id = p.business_id AND p.status = 'paid'
GROUP BY b.id, b.name, b.email;

-- Monthly Financial Report View
CREATE VIEW monthly_financial_report AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  DATE_TRUNC('month', bk.created_at) as month,
  COUNT(DISTINCT bk.id) as monthly_bookings,
  COALESCE(SUM(s.price), 0) as monthly_gross_revenue,
  COALESCE(COUNT(DISTINCT bk.id) * 0.50, 0) as monthly_platform_fees,
  COALESCE(SUM((s.price * 0.015) + 0.20), 0) as monthly_stripe_fees,
  COALESCE(SUM(s.price) - (COUNT(DISTINCT bk.id) * 0.50) - SUM((s.price * 0.015) + 0.20), 0) as monthly_business_earnings,
  COALESCE(SUM(p.amount), 0) as monthly_paid_out
FROM businesses b
LEFT JOIN bookings bk ON b.id = bk.business_id AND bk.status = 'confirmed'
LEFT JOIN services s ON bk.service_id = s.id
LEFT JOIN payouts p ON b.id = p.business_id 
  AND DATE_TRUNC('month', p.created_at) = DATE_TRUNC('month', bk.created_at)
GROUP BY b.id, b.name, DATE_TRUNC('month', bk.created_at)
ORDER BY b.name, month DESC;

-- RLS Policies for Payouts
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Business can see their own payouts
CREATE POLICY "Businesses can view own payouts" ON payouts
  FOR SELECT USING (auth.uid()::text = business_id::text);

-- Admin can manage all payouts
CREATE POLICY "Admins can manage all payouts" ON payouts
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_payouts_updated_at 
  BEFORE UPDATE ON payouts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
