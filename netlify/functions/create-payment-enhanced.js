const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role for elevated permissions
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enhanced error class for better debugging
class PaymentError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Comprehensive input validation
function validatePaymentInput(data) {
  const { serviceId, businessId, customerName, customerEmail, bookingDate, bookingTime } = data;
  
  // Required fields validation
  const requiredFields = ['serviceId', 'businessId', 'customerName', 'customerEmail', 'bookingDate', 'bookingTime'];
  for (const field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === '') {
      throw new PaymentError(`Missing required field: ${field}`, 'MISSING_FIELD', { field });
    }
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail.toLowerCase().trim())) {
    throw new PaymentError('Invalid email format', 'INVALID_EMAIL', { customerEmail });
  }
  
  // Name validation
  if (customerName.trim().length < 2) {
    throw new PaymentError('Customer name too short', 'INVALID_NAME', { customerName });
  }
  
  // Date validation
  const bookingDateObj = new Date(bookingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (bookingDateObj < today) {
    throw new PaymentError('Booking date cannot be in the past', 'INVALID_DATE', { bookingDate });
  }
  
  // Time validation
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(bookingTime)) {
    throw new PaymentError('Invalid time format', 'INVALID_TIME', { bookingTime });
  }
  
  return true;
}

// Service validation with comprehensive checks
async function validateService(serviceId, businessId) {
  try {
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Service query error:', error);
      throw new PaymentError('Failed to query service', 'SERVICE_QUERY_ERROR', { error: error.message });
    }
    
    if (!service) {
      throw new PaymentError('Service not found or inactive', 'SERVICE_NOT_FOUND', { serviceId, businessId });
    }
    
    // Price validation
    const price = parseFloat(service.price);
    if (isNaN(price) || price <= 0 || price > 10000) {
      throw new PaymentError('Invalid service price', 'INVALID_PRICE', { serviceId, price: service.price });
    }
    
    return service;
  } catch (error) {
    console.error('Service validation error:', error);
    throw error;
  }
}

// Business validation with payment capability check
async function validateBusiness(businessId) {
  try {
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('status', 'active')
      .single();
    
    if (error) {
      console.error('Business query error:', error);
      throw new PaymentError('Failed to query business', 'BUSINESS_QUERY_ERROR', { error: error.message });
    }
    
    if (!business) {
      throw new PaymentError('Business not found or inactive', 'BUSINESS_NOT_FOUND', { businessId });
    }
    
    // Check if business can accept payments
    if (business.plan !== 'premium') {
      throw new PaymentError('Business must be on Premium plan to accept payments', 'PAYMENT_NOT_ENABLED', { 
        businessId, 
        plan: business.plan 
      });
    }
    
    // Validate bank details for payouts
    if (!business.bank_details || business.bank_details.trim() === '') {
      throw new PaymentError('Business bank details not configured', 'NO_BANK_DETAILS', { businessId });
    }
    
    return business;
  } catch (error) {
    console.error('Business validation error:', error);
    throw error;
  }
}

// Comprehensive booking conflict check
async function checkBookingConflict(businessId, serviceId, bookingDate, bookingTime, excludeBookingId = null) {
  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('business_id', businessId)
      .eq('service_id', serviceId)
      .eq('booking_date', bookingDate)
      .eq('booking_time', bookingTime)
      .in('status', ['confirmed', 'pending_payment']);
    
    // Exclude current booking if updating
    if (excludeBookingId) {
      query = query.neq('id', excludeBookingId);
    }
    
    const { data: conflicts, error } = await query;
    
    if (error) {
      console.error('Conflict check error:', error);
      throw new PaymentError('Failed to check booking conflicts', 'CONFLICT_CHECK_ERROR', { error: error.message });
    }
    
    if (conflicts && conflicts.length > 0) {
      throw new PaymentError('Time slot already booked', 'BOOKING_CONFLICT', { 
        conflicts: conflicts.length,
        existingBookings: conflicts.map(c => ({ id: c.id, customer: c.customer_name }))
      });
    }
    
    return false;
  } catch (error) {
    console.error('Booking conflict check error:', error);
    throw error;
  }
}

// Create Stripe Checkout Session with enhanced security
async function createStripeSession(service, business, customerData, bookingData) {
  try {
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: service.name,
            description: service.description || `Service at ${business.name}`,
            images: business.logo ? [business.logo] : [],
            metadata: {
              service_id: service.id,
              business_id: business.id,
              business_name: business.name
            }
          },
          unit_amount: Math.round(parseFloat(service.price) * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/booking/${business.subdomain}?cancelled=true`,
      customer_email: customerData.customerEmail.toLowerCase().trim(),
      metadata: {
        business_id: business.id,
        service_id: service.id,
        customer_name: customerData.customerName.trim(),
        customer_email: customerData.customerEmail.toLowerCase().trim(),
        booking_date: bookingData.bookingDate,
        booking_time: bookingData.bookingTime,
        business_name: business.name,
        service_name: service.name,
        service_price: service.price,
        created_at: new Date().toISOString()
      },
      payment_intent_data: {
        metadata: {
          business_id: business.id,
          service_id: service.id,
          customer_name: customerData.customerName.trim(),
          customer_email: customerData.customerEmail.toLowerCase().trim(),
          booking_date: bookingData.bookingDate,
          booking_time: bookingData.bookingTime
        },
        setup_future_usage: 'off_session',
        description: `Payment for ${service.name} at ${business.name}`
      },
      // Enhanced security settings
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['GB'] },
      allow_promotion_codes: false,
      tax_id_collection: { enabled: false },
      client_reference_id: `${business.id}_${service.id}_${Date.now()}`,
      // Session expiration
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
    };
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('Stripe session created:', {
      sessionId: session.id,
      businessId: business.id,
      serviceId: service.id,
      amount: service.price
    });
    
    return session;
  } catch (error) {
    console.error('Stripe session creation error:', error);
    throw new PaymentError('Failed to create payment session', 'STRIPE_SESSION_ERROR', { 
      error: error.message,
      businessId: business.id,
      serviceId: service.id
    });
  }
}

// Create booking with transaction safety
async function createBooking(session, business, service, customerData, bookingData) {
  try {
    const bookingDataRecord = {
      business_id: business.id,
      service_id: service.id,
      customer_name: customerData.customerName.trim(),
      customer_email: customerData.customerEmail.toLowerCase().trim(),
      booking_date: bookingData.bookingDate,
      booking_time: bookingData.bookingTime,
      status: 'pending_payment',
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent,
      gross_amount: parseFloat(service.price),
      currency: 'gbp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingDataRecord)
      .select()
      .single();
    
    if (error) {
      console.error('Booking creation error:', error);
      
      // Attempt to cancel Stripe session to prevent orphaned payments
      try {
        await stripe.checkout.sessions.expire(session.id);
        console.log('Expired Stripe session due to booking creation failure:', session.id);
      } catch (cancelError) {
        console.error('Failed to expire Stripe session:', cancelError);
      }
      
      throw new PaymentError('Failed to create booking', 'BOOKING_CREATION_FAILED', { 
        error: error.message,
        sessionId: session.id
      });
    }
    
    console.log('Booking created successfully:', {
      bookingId: booking.id,
      sessionId: session.id,
      businessId: business.id,
      serviceId: service.id
    });
    
    return booking;
  } catch (error) {
    console.error('Booking creation error:', error);
    throw error;
  }
}

// Main enhanced payment creation function
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  const startTime = Date.now();
  
  try {
    // Parse and validate input
    let paymentData;
    try {
      paymentData = JSON.parse(event.body);
    } catch (parseError) {
      throw new PaymentError('Invalid JSON in request body', 'INVALID_JSON', { error: parseError.message });
    }
    
    validatePaymentInput(paymentData);
    
    const { serviceId, businessId, customerName, customerEmail, bookingDate, bookingTime } = paymentData;
    const customerData = { customerName, customerEmail };
    const bookingData = { bookingDate, bookingTime };
    
    // Validate service and business
    const [service, business] = await Promise.all([
      validateService(serviceId, businessId),
      validateBusiness(businessId)
    ]);
    
    // Check for booking conflicts
    await checkBookingConflict(businessId, serviceId, bookingDate, bookingTime);
    
    // Create Stripe session
    const session = await createStripeSession(service, business, customerData, bookingData);
    
    // Create booking record
    const booking = await createBooking(session, business, service, customerData, bookingData);
    
    // Log successful payment creation
    const processingTime = Date.now() - startTime;
    console.log('Enhanced payment creation completed:', {
      sessionId: session.id,
      bookingId: booking.id,
      processingTime: `${processingTime}ms`,
      businessId: business.id,
      serviceId: service.id,
      amount: service.price
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        bookingId: booking.id,
        amount: parseFloat(service.price),
        currency: 'gbp',
        processingTime: processingTime,
        message: 'Payment session created successfully'
      })
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Enhanced payment creation error:', {
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
    
    if (error instanceof PaymentError) {
      // Map error codes to appropriate HTTP status codes
      const statusCodeMap = {
        'MISSING_FIELD': 400,
        'INVALID_EMAIL': 400,
        'INVALID_NAME': 400,
        'INVALID_DATE': 400,
        'INVALID_TIME': 400,
        'INVALID_PRICE': 400,
        'SERVICE_NOT_FOUND': 404,
        'BUSINESS_NOT_FOUND': 404,
        'PAYMENT_NOT_ENABLED': 403,
        'NO_BANK_DETAILS': 403,
        'BOOKING_CONFLICT': 409,
        'BOOKING_CREATION_FAILED': 500,
        'STRIPE_SESSION_ERROR': 500
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
