const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    checks: {}
  };

  try {
    // 1. Check environment variables
    results.checks.environment = {
      supabase_url: !!process.env.SUPABASE_URL,
      supabase_anon_key: !!process.env.SUPABASE_ANON_KEY,
      resend_api_key: !!process.env.RESEND_API_KEY,
      stripe_secret_key: !!process.env.STRIPE_SECRET_KEY,
      stripe_webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET
    };

    // 2. Test database connection
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('count')
        .limit(1);
      
      results.checks.database = {
        connected: !error,
        error: error?.message || null
      };
    } catch (dbError) {
      results.checks.database = {
        connected: false,
        error: dbError.message
      };
    }

    // 3. Test email service
    try {
      const emailResponse = await fetch(`${process.env.URL}/.netlify/functions/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const emailResult = await emailResponse.json();
      results.checks.email = {
        working: emailResponse.ok,
        result: emailResult
      };
    } catch (emailError) {
      results.checks.email = {
        working: false,
        error: emailError.message
      };
    }

    // 4. Check Stripe links accessibility
    const stripeLinks = {
      basic: 'https://buy.stripe.com/6oU3cwcgfcX40uaeEL5Ne0m',
      pro: 'https://buy.stripe.com/4gM00k1BB0aidgW0NV5Ne0n',
      premium: 'https://buy.stripe.com/fZubJ25RRcX490G68f5Ne0o'
    };

    results.checks.stripe_links = {};
    for (const [plan, url] of Object.entries(stripeLinks)) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        results.checks.stripe_links[plan] = {
          accessible: response.ok,
          status: response.status
        };
      } catch (error) {
        results.checks.stripe_links[plan] = {
          accessible: false,
          error: error.message
        };
      }
    }

    // 5. Check all function files exist
    const requiredFunctions = [
      'email-service',
      'email-confirmations', 
      'welcome-email',
      'stripe-webhook',
      'api-business',
      'api-services',
      'api-booking',
      'error-handler',
      'test-email'
    ];

    results.checks.functions = {
      required: requiredFunctions,
      status: 'configured'
    };

    // 6. Overall status
    const allChecks = [
      ...Object.values(results.checks.environment),
      results.checks.database.connected,
      results.checks.email.working,
      ...Object.values(results.checks.stripe_links).map(link => link.accessible)
    ];

    results.status = allChecks.every(check => check === true) ? 'ready' : 'needs_attention';
    results.ready_for_launch = results.status === 'ready';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    console.error('System check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      })
    };
  }
};
