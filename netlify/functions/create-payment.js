const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { serviceId, businessId, customerName, customerEmail, bookingDate, bookingTime } = JSON.parse(event.body);

    // Validate required fields
    if (!serviceId || !businessId || !customerName || !customerEmail || !bookingDate || !bookingTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get service and business details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .single();

    if (serviceError || !service) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Service not found' })
      };
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: service.name,
            description: service.description || `Service at ${business.name}`,
            images: business.logo ? [business.logo] : []
          },
          unit_amount: Math.round(parseFloat(service.price) * 100), // Convert to pence
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/booking/${business.subdomain}?cancelled=true`,
      customer_email: customerEmail,
      metadata: {
        business_id: businessId,
        service_id: serviceId,
        customer_name: customerName,
        customer_email: customerEmail,
        booking_date: bookingDate,
        booking_time: bookingTime,
        business_name: business.name,
        service_name: service.name,
        service_price: service.price
      },
      payment_intent_data: {
        metadata: {
          business_id: businessId,
          service_id: serviceId,
          customer_name: customerName,
          customer_email: customerEmail,
          booking_date: bookingDate,
          booking_time: bookingTime
        }
      }
    });

    // Create pending booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        business_id: businessId,
        service_id: serviceId,
        customer_name: customerName,
        customer_email: customerEmail,
        booking_date: bookingDate,
        booking_time: bookingTime,
        status: 'pending_payment',
        stripe_session_id: session.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create booking' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        bookingId: booking.id
      })
    };

  } catch (error) {
    console.error('Create payment error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
