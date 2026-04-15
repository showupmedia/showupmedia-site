-- Show Up Media Booking System - Row Level Security Policies
-- This ensures businesses can only access their own data

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Businesses Table - Users can only see their own business
CREATE POLICY "Businesses can view own business" ON businesses
  FOR SELECT USING (
    auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                           WHERE business_id = businesses.id 
                           AND setting_key = 'owner_uid')
  );

CREATE POLICY "Businesses can update own business" ON businesses
  FOR UPDATE USING (
    auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                           WHERE business_id = businesses.id 
                           AND setting_key = 'owner_uid')
  );

-- Services Table - Users can only see services for their business
CREATE POLICY "Services can view own business services" ON services
  FOR SELECT USING (
    services.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Services can insert own business services" ON services
  FOR INSERT WITH CHECK (
    services.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Services can update own business services" ON services
  FOR UPDATE USING (
    services.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Services can delete own business services" ON services
  FOR DELETE USING (
    services.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Staff Table - Users can only see staff for their business
CREATE POLICY "Staff can view own business staff" ON staff
  FOR SELECT USING (
    staff.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Staff can insert own business staff" ON staff
  FOR INSERT WITH CHECK (
    staff.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Staff can update own business staff" ON staff
  FOR UPDATE USING (
    staff.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Staff can delete own business staff" ON staff
  FOR DELETE USING (
    staff.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Bookings Table - Users can only see bookings for their business
CREATE POLICY "Bookings can view own business bookings" ON bookings
  FOR SELECT USING (
    bookings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Bookings can insert own business bookings" ON bookings
  FOR INSERT WITH CHECK (
    bookings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Bookings can update own business bookings" ON bookings
  FOR UPDATE USING (
    bookings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Bookings can delete own business bookings" ON bookings
  FOR DELETE USING (
    bookings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Availability Table - Users can only see availability for their business staff
CREATE POLICY "Availability can view own business availability" ON availability
  FOR SELECT USING (
    availability.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Availability can insert own business availability" ON availability
  FOR INSERT WITH CHECK (
    availability.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Availability can update own business availability" ON availability
  FOR UPDATE USING (
    availability.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Availability can delete own business availability" ON availability
  FOR DELETE USING (
    availability.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Business Settings Table - Users can only see settings for their business
CREATE POLICY "Business settings can view own business settings" ON business_settings
  FOR SELECT USING (
    business_settings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Business settings can insert own business settings" ON business_settings
  FOR INSERT WITH CHECK (
    business_settings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Business settings can update own business settings" ON business_settings
  FOR UPDATE USING (
    business_settings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

CREATE POLICY "Business settings can delete own business settings" ON business_settings
  FOR DELETE USING (
    business_settings.business_id IN (
      SELECT id FROM businesses 
      WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                               WHERE business_id = businesses.id 
                               AND setting_key = 'owner_uid')
    )
  );

-- Booking Reminders Table - Users can only see reminders for their business bookings
CREATE POLICY "Booking reminders can view own business reminders" ON booking_reminders
  FOR SELECT USING (
    booking_reminders.booking_id IN (
      SELECT id FROM bookings 
      WHERE bookings.business_id IN (
        SELECT id FROM businesses 
        WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                                 WHERE business_id = businesses.id 
                                 AND setting_key = 'owner_uid')
      )
    )
  );

CREATE POLICY "Booking reminders can insert own business reminders" ON booking_reminders
  FOR INSERT WITH CHECK (
    booking_reminders.booking_id IN (
      SELECT id FROM bookings 
      WHERE bookings.business_id IN (
        SELECT id FROM businesses 
        WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                                 WHERE business_id = businesses.id 
                                 AND setting_key = 'owner_uid')
      )
    )
  );

CREATE POLICY "Booking reminders can update own business reminders" ON booking_reminders
  FOR UPDATE USING (
    booking_reminders.booking_id IN (
      SELECT id FROM bookings 
      WHERE bookings.business_id IN (
        SELECT id FROM businesses 
        WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                                 WHERE business_id = businesses.id 
                                 AND setting_key = 'owner_uid')
      )
    )
  );

CREATE POLICY "Booking reminders can delete own business reminders" ON booking_reminders
  FOR DELETE USING (
    booking_reminders.booking_id IN (
      SELECT id FROM bookings 
      WHERE bookings.business_id IN (
        SELECT id FROM businesses 
        WHERE auth.uid()::text = (SELECT setting_value::text FROM business_settings 
                                 WHERE business_id = businesses.id 
                                 AND setting_key = 'owner_uid')
      )
    )
  );

-- Public policies for anonymous access (needed for booking creation)
CREATE POLICY "Public can insert bookings" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view services for booking" ON services
  FOR SELECT USING (true);

-- Function to get business ID from user UID
CREATE OR REPLACE FUNCTION get_business_id_from_uid(user_uid TEXT)
RETURNS UUID AS $$
  SELECT business_id 
  FROM business_settings 
  WHERE setting_key = 'owner_uid' 
    AND setting_value::text = user_uid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user owns business
CREATE OR REPLACE FUNCTION user_owns_business(user_uid TEXT, business_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM business_settings 
    WHERE setting_key = 'owner_uid' 
      AND setting_value::text = user_uid 
      AND business_id = business_id
  );
$$ LANGUAGE sql SECURITY DEFINER;
