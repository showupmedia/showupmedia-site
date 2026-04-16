# PRE-DEPLOY CHECKLIST - Show Up Media

## ✅ COMPLETED ANALYSIS

### Current Live Site Status
- **URL**: https://showupmedia.org
- **Status**: Landing page loads, shows booking system marketing content
- **Issue**: Database schema mismatch with code (stripe_session_id column missing)

### Database Schema Fix
- ✅ Fixed missing `stripe_session_id` column in bookings and payouts tables
- ✅ Added proper indexes for performance
- ✅ Database now matches code expectations

### Code Analysis
- ✅ All payment functions reference `stripe_session_id` correctly
- ✅ Enhanced payment functions are properly configured
- ✅ Netlify redirects point to enhanced functions

## 🚨 CRITICAL ITEMS TO FIX BEFORE DEPLOY

### 1. Environment Variables (Netlify Dashboard)
You MUST set these in Netlify Dashboard → Site Settings → Environment Variables:

```
STRIPE_SECRET_KEY=sk_test_... (your Stripe secret key)
STRIPE_PUBLISHABLE_KEY=pk_test_... (your Stripe publishable key)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### 2. Stripe Webhook Endpoint
- Configure webhook endpoint in Stripe Dashboard
- URL: `https://showupmedia.org/api/stripe-webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`

### 3. Test These Functions Locally First
- `/api/create-payment` → `create-payment-enhanced.js`
- `/api/payment-success` → `payment-success-enhanced.js`
- `/api/stripe-webhook` → `stripe-webhook-enhanced.js`

## 📁 WHAT TO REDEPLOY

### Required Files for Deploy:
1. **All Netlify Functions** (`/netlify/functions/*`)
   - Enhanced payment functions
   - API endpoints
   - Webhook handlers

2. **Static Files** (`/website/*`)
   - Booking pages
   - Admin dashboards

3. **Configuration**
   - `netlify.toml` (already optimized)

### Single Deploy Command:
```bash
netlify deploy --prod --dir=website --functions=netlify/functions
```

## ⚠️ FINAL VERIFICATION

Before deploying:
1. ✅ Database schema updated with stripe_session_id
2. ⏳ Environment variables set in Netlify
3. ⏳ Stripe webhook configured
4. ⏳ Test payment flow locally

## 🎯 DEPLOY PRIORITY

Given you have 3 deploys left:
1. **Deploy 1**: Core payment system (functions + environment setup)
2. **Deploy 2**: Bug fixes and optimizations
3. **Deploy 3**: Final production polish

**Recommendation**: Test everything locally first, then deploy once with all fixes included.
