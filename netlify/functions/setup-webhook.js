const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { webhookUrl } = JSON.parse(event.body);

    if (!webhookUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Webhook URL is required' })
      };
    }

    // Create webhook endpoint configuration
    const webhookEndpoint = await stripe.webhookEndpoints.create({
      enabled_events: [
        'checkout.session.completed',
        'invoice.payment_succeeded', 
        'customer.subscription.created',
        'customer.subscription.deleted'
      ],
      url: webhookUrl,
      description: 'Show Up Media Booking System Webhook'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Webhook configured successfully',
        webhookEndpoint: webhookEndpoint,
        webhookUrl: webhookUrl
      })
    };

  } catch (error) {
    console.error('Webhook setup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
