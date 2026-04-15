// Netlify Function for handling booking submissions
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { businessId, customerName, serviceName, bookingTime, customerEmail, customerPhone } = JSON.parse(event.body);

    // Validate required fields
    if (!businessId || !customerName || !serviceName || !bookingTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Insert booking into database
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        business_id: businessId,
        customer_name: customerName,
        service_name: serviceName,
        booking_time: bookingTime,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      throw error;
    }

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        booking: data[0]
      })
    };

  } catch (error) {
    console.error('Booking error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to create booking',
        details: error.message 
      })
    };
  }
};
