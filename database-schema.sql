-- Show Up Media Booking System Database Schema

-- Businesses table
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'pro', 'premium')),
  subdomain TEXT UNIQUE,
  custom_domain TEXT,
  template TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  accent_color TEXT DEFAULT '#10b981',
  stripe_customer_id TEXT,
  bank_sort_code TEXT, -- Only for premium plan
  bank_account_number TEXT, -- Only for premium plan
  bank_account_name TEXT, -- Only for premium plan
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Services table
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Staff table
CREATE TABLE staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  service_price DECIMAL(10,2) NOT NULL,
  stripe_fee DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0.30,
  total_paid DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Availability table
CREATE TABLE availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Booking reminders table
CREATE TABLE booking_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24_hours', '1_hour', 'custom')),
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business settings table
CREATE TABLE business_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(business_id, setting_key)
);

-- Indexes for performance
CREATE INDEX idx_businesses_plan ON businesses(plan);
CREATE INDEX idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX idx_services_business_id ON services(business_id);
CREATE INDEX idx_staff_business_id ON staff(business_id);
CREATE INDEX idx_bookings_business_id ON bookings(business_id);
CREATE INDEX idx_bookings_date_time ON bookings(booking_date, booking_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_availability_business_staff ON availability(business_id, staff_id);
CREATE INDEX idx_booking_reminders_booking_id ON booking_reminders(booking_id);

-- Row Level Security (RLS) Policies
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Businesses can only access their own data
CREATE POLICY "Businesses can view own business" ON businesses
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Businesses can update own business" ON businesses
  FOR UPDATE USING (auth.uid() = id);

-- Services policies
CREATE POLICY "Businesses can view own services" ON services
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Businesses can manage own services" ON services
  FOR ALL USING (auth.uid() = business_id);

-- Staff policies
CREATE POLICY "Businesses can view own staff" ON staff
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Businesses can manage own staff" ON staff
  FOR ALL USING (auth.uid() = business_id);

-- Bookings policies
CREATE POLICY "Businesses can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Businesses can manage own bookings" ON bookings
  FOR ALL USING (auth.uid() = business_id);

-- Availability policies
CREATE POLICY "Businesses can view own availability" ON availability
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Businesses can manage own availability" ON availability
  FOR ALL USING (auth.uid() = business_id);

-- Booking reminders policies
CREATE POLICY "Businesses can view own reminders" ON booking_reminders
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = booking_reminders.booking_id 
    AND bookings.business_id = auth.uid()
  ));

CREATE POLICY "Businesses can manage own reminders" ON booking_reminders
  FOR ALL USING (EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = booking_reminders.booking_id 
    AND bookings.business_id = auth.uid()
  ));

-- Business settings policies
CREATE POLICY "Businesses can view own settings" ON business_settings
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "Businesses can manage own settings" ON business_settings
  FOR ALL USING (auth.uid() = business_id);

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
