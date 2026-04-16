const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase with service role for elevated permissions
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enhanced error handling
class PaymentSuccessError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PaymentSuccessError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Enhanced payment success handler with comprehensive verification
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  const startTime = Date.now();
  
  try {
    const sessionId = event.queryStringParameters.session_id;

    if (!sessionId) {
      throw new PaymentSuccessError('Session ID required', 'MISSING_SESSION_ID');
    }

    console.log('Processing payment success for session:', sessionId);

    // Step 1: Verify session with Stripe (critical verification)
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'line_items']
      });
    } catch (stripeError) {
      console.error('Stripe session retrieval error:', stripeError);
      throw new PaymentSuccessError('Failed to verify session with Stripe', 'STRIPE_VERIFICATION_FAILED', { 
        sessionId,
        error: stripeError.message 
      });
    }

    // Step 2: Validate session status
    if (!session) {
      throw new PaymentSuccessError('Session not found', 'SESSION_NOT_FOUND', { sessionId });
    }

    if (session.payment_status !== 'paid') {
      throw new PaymentSuccessError('Payment not completed', 'PAYMENT_NOT_COMPLETED', { 
        sessionId,
        paymentStatus: session.payment_status 
      });
    }

    // Step 3: Get booking details with comprehensive data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(name, price, description),
        businesses!inner(name, email, subdomain, address, bank_details, plan)
      `)
      .eq('stripe_session_id', sessionId)
      .single();

    if (bookingError || !booking) {
      throw new PaymentSuccessError('Booking not found', 'BOOKING_NOT_FOUND', { 
        sessionId,
        error: bookingError?.message 
      });
    }

    // Step 4: Prevent duplicate processing
    if (booking.status === 'confirmed') {
      console.log('Booking already confirmed:', booking.id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          booking: {
            id: booking.id,
            customerName: booking.customer_name,
            serviceName: booking.services.name,
            bookingDate: booking.booking_date,
            bookingTime: booking.booking_time,
            businessName: booking.businesses.name,
            status: booking.status
          },
          message: 'Booking already confirmed',
          processingTime: Date.now() - startTime
        })
      };
    }

    // Step 5: Verify payment amount matches service price
    const sessionAmount = session.amount_total / 100; // Convert from pence to pounds
    const servicePrice = parseFloat(booking.services.price);
    
    if (Math.abs(sessionAmount - servicePrice) > 0.01) { // Allow for minor rounding differences
      throw new PaymentSuccessError('Payment amount mismatch', 'AMOUNT_MISMATCH', {
        sessionId,
        sessionAmount,
        servicePrice,
        difference: Math.abs(sessionAmount - servicePrice)
      });
    }

    // Step 6: Update booking with comprehensive data
    const updateData = {
      status: 'confirmed',
      payment_status: 'paid',
      stripe_payment_status: session.payment_status,
      stripe_payment_intent_id: session.payment_intent?.id,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id);

    if (updateError) {
      throw new PaymentSuccessError('Failed to update booking', 'BOOKING_UPDATE_FAILED', { 
        bookingId: booking.id,
        error: updateError.message 
      });
    }

    // Step 7: Create settlement payout with enhanced tracking
    await createSettlementPayout(booking, session);

    // Step 8: Send comprehensive confirmation emails
    await sendBookingConfirmation(booking, session);

    // Step 9: Log successful processing
    const processingTime = Date.now() - startTime;
    console.log('Enhanced payment success completed:', {
      sessionId,
      bookingId: booking.id,
      businessId: booking.business_id,
      amount: sessionAmount,
      processingTime: `${processingTime}ms`
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          customerName: booking.customer_name,
          customerEmail: booking.customer_email,
          serviceName: booking.services.name,
          servicePrice: booking.services.price,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          businessName: booking.businesses.name,
          businessEmail: booking.businesses.email,
          status: 'confirmed',
          paymentStatus: 'paid',
          paidAt: updateData.paid_at
        },
        payment: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent?.id,
          amount: sessionAmount,
          currency: session.currency,
          paymentStatus: session.payment_status
        },
        message: 'Payment verified and booking confirmed',
        processingTime
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Enhanced payment success error:', {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details || {},
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

    // Return appropriate error response
    let statusCode = 500;
    let errorResponse = {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      processingTime
    };

    if (error instanceof PaymentSuccessError) {
      // Map error codes to appropriate HTTP status codes
      const statusCodeMap = {
        'MISSING_SESSION_ID': 400,
        'STRIPE_VERIFICATION_FAILED': 400,
        'SESSION_NOT_FOUND': 404,
        'PAYMENT_NOT_COMPLETED': 400,
        'BOOKING_NOT_FOUND': 404,
        'AMOUNT_MISMATCH': 400,
        'BOOKING_UPDATE_FAILED': 500
      };
      
      statusCode = statusCodeMap[error.code] || 500;
      
      errorResponse = {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        processingTime
      };
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};

// Enhanced settlement payout creation
async function createSettlementPayout(booking, session) {
  try {
    const servicePrice = parseFloat(booking.services.price);
    const platformFee = 0.50;
    const stripeFee = (servicePrice * 0.015) + 0.20;
    const totalFees = platformFee + stripeFee;
    const businessEarnings = servicePrice - totalFees;

    // Calculate realistic settlement dates
    const today = new Date();
    const settlementDate = calculateStripeSettlementDate(today);
    const businessPayoutDate = getNextBusinessDay(settlementDate);

    const payoutData = {
      business_id: booking.business_id,
      booking_id: booking.id,
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent?.id,
      gross_amount: servicePrice,
      platform_fee: platformFee,
      stripe_fee: stripeFee,
      total_fees: totalFees,
      net_amount: businessEarnings,
      transaction_count: 1,
      payment_method: 'bank_transfer',
      status: 'pending_settlement',
      stripe_settlement_date: settlementDate.toISOString().split('T')[0],
      payout_date: businessPayoutDate.toISOString().split('T')[0],
      notes: `Settlement payout for ${booking.services.name} - ${booking.customer_name}`,
      created_at: new Date().toISOString()
    };

    const { error: payoutError } = await supabase
      .from('payouts')
      .insert(payoutData);

    if (payoutError) {
      throw new PaymentSuccessError('Failed to create payout', 'PAYOUT_CREATION_FAILED', { 
        bookingId: booking.id,
        error: payoutError.message 
      });
    }

    console.log('Settlement payout created successfully:', {
      bookingId: booking.id,
      businessId: booking.business_id,
      amount: businessEarnings,
      settlementDate: settlementDate.toISOString().split('T')[0],
      payoutDate: businessPayoutDate.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('Settlement payout creation error:', error);
    throw error;
  }
}

// Enhanced booking confirmation with comprehensive data
async function sendBookingConfirmation(booking, session) {
  try {
    // Prepare comprehensive booking data for email
    const bookingData = {
      id: booking.id,
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      serviceName: booking.services.name,
      serviceDescription: booking.services.description,
      servicePrice: booking.services.price,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      businessName: booking.businesses.name,
      businessEmail: booking.businesses.email,
      businessAddress: booking.businesses.address,
      status: 'confirmed',
      paymentStatus: 'paid',
      paidAt: new Date().toISOString(),
      sessionId: session.id,
      paymentIntentId: session.payment_intent?.id,
      amount: session.amount_total / 100,
      currency: session.currency
    };

    // Log booking confirmation
    console.log('Booking confirmation prepared:', {
      bookingId: booking.id,
      customerEmail: booking.customer_email,
      businessEmail: booking.businesses.email,
      serviceName: booking.services.name
    });

    // This would integrate with your email service
    // await emailService.sendBookingConfirmation(bookingData);

  } catch (error) {
    console.error('Failed to send booking confirmation:', error);
    // Non-critical error, don't throw to avoid payment failure
  }
}

// Helper functions for date calculations
function calculateStripeSettlementDate(startDate) {
  const date = new Date(startDate);
  let businessDaysToAdd = 3; // Average settlement time
  
  while (businessDaysToAdd > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day >= 1 && day <= 5) { // Monday-Friday
      businessDaysToAdd--;
    }
  }
  
  return date;
}

function getNextBusinessDay(date) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const day = nextDay.getDay();
  if (day === 0) { // Sunday
    nextDay.setDate(nextDay.getDate() + 1); // Move to Monday
  } else if (day === 6) { // Saturday
    nextDay.setDate(nextDay.getDate() + 2); // Move to Monday
  }
  
  return nextDay;
}
