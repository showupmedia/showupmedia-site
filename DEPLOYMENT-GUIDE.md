# 🚀 Show Up Media - Deployment Guide

## ⚠️ CRITICAL SETUP REQUIRED BEFORE LAUNCH

### 1. Environment Variables (Netlify)
Add these in Netlify dashboard → Site settings → Build & deploy → Environment:

```bash
# Email Service
RESEND_API_KEY=your_resend_api_key_here

# Database  
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Development
URL=https://your-domain.com
NETLIFY_DEV_TOKEN=your_netlify_dev_token
```

### 2. Stripe Production Setup
Replace placeholder links in `bookingbuilder-upgraded.html`:

```javascript
const STRIPE_LINKS = {
  basic:   'https://buy.stripe.com/YOUR_ACTUAL_BASIC_PLAN_ID',
  pro:     'https://buy.stripe.com/YOUR_ACTUAL_PRO_PLAN_ID', 
  premium: 'https://buy.stripe.com/YOUR_ACTUAL_PREMIUM_PLAN_ID',
};
```

### 3. Webhook Configuration
Set webhook endpoint in Stripe Dashboard:
```
https://your-domain.com/.netlify/functions/stripe-webhook
```

Events to listen for:
- checkout.session.completed
- invoice.payment_succeeded  
- customer.subscription.created
- customer.subscription.deleted

### 4. Database Tables Required
Ensure these Supabase tables exist:

```sql
-- Businesses table
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL,
  template TEXT DEFAULT 'noir',
  primary_color TEXT DEFAULT '#2563eb',
  accent_color TEXT DEFAULT '#10b981',
  stripe_customer_id TEXT,
  status TEXT DEFAULT 'active',
  subdomain TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  tagline TEXT,
  about TEXT,
  logo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Services table
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business Hours table
CREATE TABLE business_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  open_time TEXT,
  close_time TEXT,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Business Settings table
CREATE TABLE business_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. Test Everything

#### Email Testing
```bash
# Test email service
curl -X POST https://your-domain.com/.netlify/functions/test-email
```

#### Payment Testing
1. Use test mode: `?test=true` on booking builder
2. Test real Stripe payments with small amounts
3. Verify webhook receives events correctly

#### Booking Page Testing
1. Create test business via booking builder
2. Complete payment flow
3. Verify booking page loads: `https://your-domain.com/booking/test-subdomain`
4. Test booking submission

### 6. Netlify Redirect Rules
Add this to `netlify.toml`:

```toml
[[redirects]]
  from = "/api/business/*"
  to = "/.netlify/functions/api-business"
  status = 200

[[redirects]]
  from = "/api/services/*"  
  to = "/.netlify/functions/api-services"
  status = 200

[[redirects]]
  from = "/api/booking"
  to = "/.netlify/functions/api-booking"
  status = 200

[[redirects]]
  from = "/booking/*"
  to = "/booking.html"
  status = 200
```

### 7. Pre-Launch Checklist

- [ ] All environment variables set
- [ ] Stripe production links configured
- [ ] Webhook endpoint working
- [ ] Database tables created
- [ ] Email service tested
- [ ] Payment flow tested end-to-end
- [ ] Booking pages functional
- [ ] Error handling working
- [ ] Mobile responsive on all pages
- [ ] Privacy policy accessible
- [ ] Terms & conditions accessible

### 8. Launch Sequence

1. **Deploy to production**
2. **Test live payment flow** (use small amount)
3. **Verify webhook processing**
4. **Test email confirmations**
5. **Monitor first real bookings**
6. **Set up analytics/error monitoring**

## 🚨 CRITICAL WARNINGS

- **DO NOT LAUNCH** until all environment variables are set
- **DO NOT LAUNCH** until Stripe webhook is verified
- **DO NOT LAUNCH** until email service is tested
- **DO NOT LAUNCH** until database is properly configured

## 📞 Support

If you encounter issues:
1. Check Netlify function logs
2. Verify environment variables
3. Test email service independently
4. Check Stripe webhook logs
5. Verify Supabase connection

---

**Your booking system will be fully functional once these steps are completed!**
