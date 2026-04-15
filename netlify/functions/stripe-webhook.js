const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const sig = event.headers['stripe-signature'];
    const body = event.body;
    
    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log(`Webhook signature verification failed:`, err.message);
      return {
        statusCode: 400,
        body: 'Webhook signature verification failed'
      };
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSession(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return {
      statusCode: 200,
      body: 'Webhook processed successfully'
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};

async function handleCheckoutSession(session) {
  console.log('Processing checkout session:', session.id);
  
  // Get metadata from the session
  const metadata = session.metadata || {};
  const customerEmail = session.customer_details?.email;
  const plan = metadata.plan || 'basic';
  
  if (!customerEmail) {
    console.error('No customer email found in session');
    return;
  }

  try {
    // Create business record
    const { data: business, error } = await supabase
      .from('businesses')
      .insert([
        {
          name: metadata.business_name || 'New Business',
          email: customerEmail,
          plan: plan,
          template: metadata.template || 'noir',
          primary_color: metadata.primary_color || '#2563eb',
          accent_color: metadata.accent_color || '#10b981',
          stripe_customer_id: session.customer,
          status: 'active',
          subdomain: metadata.subdomain || generateSubdomain(metadata.business_name),
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating business:', error);
      throw error;
    }

    console.log('Business created successfully:', business.id);

    // Send welcome email
    await sendWelcomeEmail(business, plan);

    // Store Stripe subscription ID if available
    if (session.subscription) {
      await supabase
        .from('business_settings')
        .insert([
          {
            business_id: business.id,
            setting_key: 'stripe_subscription_id',
            setting_value: session.subscription
          }
        ]);
    }

  } catch (error) {
    console.error('Error in handleCheckoutSession:', error);
    throw error;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded for subscription:', invoice.subscription);
  
  try {
    // Update business status to active if payment succeeded
    const { error } = await supabase
      .from('businesses')
      .update({ status: 'active' })
      .eq('stripe_customer_id', invoice.customer);

    if (error) {
      console.error('Error updating business status:', error);
    }

  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  
  try {
    // Find business by Stripe customer ID
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (error || !business) {
      console.error('Business not found for customer:', subscription.customer);
      return;
    }

    // Store subscription details
    await supabase
      .from('business_settings')
      .upsert([
        {
          business_id: business.id,
          setting_key: 'stripe_subscription_id',
          setting_value: subscription.id
        }
      ]);

  } catch (error) {
    console.error('Error in handleSubscriptionCreated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  try {
    // Find business by subscription ID
    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('business_id')
      .eq('setting_key', 'stripe_subscription_id')
      .eq('setting_value', subscription.id)
      .single();

    if (error || !settings) {
      console.error('Business not found for subscription:', subscription.id);
      return;
    }

    // Update business status to inactive
    await supabase
      .from('businesses')
      .update({ status: 'inactive' })
      .eq('id', settings.business_id);

  } catch (error) {
    console.error('Error in handleSubscriptionDeleted:', error);
  }
}

async function sendWelcomeEmail(business, email, plan) {
  try {
    // This would use your existing email system (Resend)
    console.log(`Welcome email sent to ${email} for plan ${plan}`);
    
    // TODO: Implement actual email sending using your Resend setup
    // You can reuse the existing email function from your CRM
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

function generateSubdomain(businessName) {
  if (!businessName) return 'business' + Math.random().toString(36).substr(2, 9);
  
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '-')
    .substr(0, 20) + '-' + Math.random().toString(36).substr(2, 5);
}
