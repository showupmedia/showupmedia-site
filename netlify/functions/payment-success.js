const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const sessionId = event.queryStringParameters.session_id;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Get booking details from database
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(
          name,
          price,
          duration
        ),
        businesses!inner(
          name,
          email,
          subdomain,
          address
        )
      `)
      .eq('stripe_session_id', sessionId)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Update booking status to confirmed
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update booking' })
      };
    }

    // Send confirmation email
    await sendBookingConfirmation(booking, booking.businesses);

    // Trigger daily payout recording
    try {
      const payoutResponse = await fetch(`${process.env.URL}/.netlify/functions/daily-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.id,
          businessId: booking.business_id
        })
      });

      const payoutResult = await payoutResponse.json();
      
      if (!payoutResult.success) {
        console.error('Daily payout recording failed:', payoutResult.error);
        // Don't fail the payment success, just log the error
      }
    } catch (payoutError) {
      console.error('Daily payout recording error:', payoutError);
      // Don't fail the payment success, just log the error
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          customerName: booking.customer_name,
          serviceName: booking.services.name,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          businessName: booking.businesses.name
        },
        message: 'Payment successful and daily payout scheduled'
      })
    };

  } catch (error) {
    console.error('Payment success error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendConfirmationEmails(booking) {
  try {
    // Send to customer
    await fetch(`${process.env.URL}/.netlify/functions/email-confirmations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_confirmation',
        booking: booking,
        service: booking.services,
        business: booking.businesses
      })
    });

    // Send to business
    await fetch(`${process.env.URL}/.netlify/functions/email-confirmations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'business_notification',
        booking: booking,
        service: booking.services,
        business: booking.businesses
      })
    });

    console.log(`Confirmation emails sent for booking ${booking.id}`);
  } catch (error) {
    console.error('Error sending confirmation emails:', error);
  }
}
