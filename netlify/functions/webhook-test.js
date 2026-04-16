exports.handler = async (event, context) => {
  try {
    // Simulate Stripe webhook payload for testing
    const testPayload = {
      id: 'evt_test_' + Date.now(),
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_' + Date.now(),
          object: 'checkout.session',
          amount: 699,
          currency: 'gbp',
          customer: 'cus_test_' + Date.now(),
          payment_status: 'paid',
          metadata: {
            business_name: 'Test Business',
            business_email: 'test@example.com',
            plan: 'basic',
            template: 'noir',
            primary_color: '#2563eb',
            subdomain: 'test-business-' + Date.now(),
            services_data: JSON.stringify([
              { name: 'Test Service', price: '50', duration: '30 min', description: 'Test description' }
            ]),
            hours_data: JSON.stringify({
              mon: { isOpen: true, open: '09:00', close: '17:00' },
              tue: { isOpen: true, open: '09:00', close: '17:00' }
            })
          },
          customer_details: {
            email: 'test@example.com'
          }
        }
      }
    };

    // Test webhook processing
    const webhookResponse = await fetch(`${process.env.URL}/.netlify/functions/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature'
      },
      body: JSON.stringify(testPayload)
    });

    const result = await webhookResponse.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Webhook test completed',
        test_payload: testPayload,
        webhook_response: result,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Webhook test error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Webhook test failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
