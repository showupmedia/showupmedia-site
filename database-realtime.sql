-- Show Up Media Booking System - Realtime Database Schema
-- Add these tables to your existing database

-- Realtime Subscriptions Table
CREATE TABLE IF NOT EXISTS realtime_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('business_updates', 'booking_notifications', 'staff_updates')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP,
  UNIQUE(business_id, user_id, subscription_type)
);

-- Realtime Notifications Table
CREATE TABLE IF NOT EXISTS realtime_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on realtime tables
ALTER TABLE realtime_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Realtime Subscriptions
CREATE POLICY "Users can subscribe to business updates" ON realtime_subscriptions
  FOR SELECT USING (
    realtime_subscriptions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Users can manage own subscriptions" ON realtime_subscriptions
  FOR INSERT WITH CHECK (
    realtime_subscriptions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Users can update own subscriptions" ON realtime_subscriptions
  FOR UPDATE USING (
    realtime_subscriptions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Users can delete own subscriptions" ON realtime_subscriptions
  FOR DELETE USING (
    realtime_subscriptions.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- RLS Policies for Realtime Notifications
CREATE POLICY "Users can view business notifications" ON realtime_notifications
  FOR SELECT USING (
    realtime_notifications.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Users can insert business notifications" ON realtime_notifications
  FOR INSERT WITH CHECK (
    realtime_notifications.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_business ON realtime_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_user ON realtime_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_type ON realtime_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_realtime_notifications_business ON realtime_notifications(business_id);
CREATE INDEX IF NOT EXISTS idx_realtime_notifications_type ON realtime_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_realtime_notifications_created ON realtime_notifications(created_at);

-- Function to get active subscriptions for a business
CREATE OR REPLACE FUNCTION get_active_subscriptions(business_id_param UUID)
RETURNS TABLE (
  user_id TEXT,
  subscription_type TEXT,
  status TEXT
) AS $$
  SELECT user_id, subscription_type, status
  FROM realtime_subscriptions 
  WHERE business_id = business_id_param 
    AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to cleanup old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
  DELETE FROM realtime_notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
$$ LANGUAGE sql SECURITY DEFINER;
