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
    const bookingData = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ['customer_name', 'customer_email', 'service_id', 'booking_date', 'booking_time', 'business_subdomain'];
    for (const field of requiredFields) {
      if (!bookingData[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `${field} is required` })
        };
      }
    }

    // Get business ID from subdomain
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('subdomain', bookingData.business_subdomain)
      .eq('status', 'active')
      .single();

    if (businessError || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', bookingData.service_id)
      .eq('business_id', business.id)
      .single();

    if (serviceError || !service) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Service not found' })
      };
    }

    // Create booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        business_id: business.id,
        service_id: bookingData.service_id,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        status: 'confirmed',
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        services!inner(
          name,
          price
        ),
        businesses!inner(
          name,
          email,
          address,
          phone
        )
      `)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create booking' })
      };
    }

    // Send confirmation emails (would trigger email-confirmations function)
    console.log(`Booking created: ${booking.id} for ${bookingData.customer_email}`);
    
    // In production, you'd call your email function here
    // await sendBookingConfirmationEmails(booking.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Booking created successfully',
        booking: booking
      })
    };

  } catch (error) {
    console.error('API booking error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
