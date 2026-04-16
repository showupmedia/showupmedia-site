const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role for elevated permissions
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enhanced error handling
class WebhookError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Webhook event processing with retry logic
class WebhookProcessor {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }
  
  // Process webhook with duplicate prevention
  async processEvent(event) {
    const eventId = event.id;
    
    try {
      // Check for duplicate events
      const { data: existingEvent } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('event_id', eventId)
        .single();
      
      if (existingEvent) {
        console.log(`Duplicate webhook event detected: ${eventId}`);
        return { success: true, message: 'Duplicate event processed', duplicate: true };
      }
      
      // Log webhook event
      await this.logWebhookEvent(eventId, event.type, event);
      
      // Process specific event types
      let result;
      switch (event.type) {
        case 'checkout.session.completed':
          result = await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'payment_intent.succeeded':
          result = await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          result = await this.handlePaymentIntentFailed(event.data.object);
          break;
        case 'checkout.session.expired':
          result = await this.handleCheckoutSessionExpired(event.data.object);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          result = { success: true, message: 'Event type not handled', handled: false };
      }
      
      // Mark event as processed
      await this.markEventProcessed(eventId, result);
      
      return result;
      
    } catch (error) {
      console.error(`Webhook processing error for event ${eventId}:`, error);
      
      // Mark event as failed
      await this.markEventFailed(eventId, error);
      
      throw error;
    }
  }
  
  // Log webhook event
  async logWebhookEvent(eventId, eventType, eventData) {
    try {
      await supabase
        .from('webhook_events')
        .insert({
          event_id: eventId,
          event_type: eventType,
          event_data: eventData,
          processed: false,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
      throw new WebhookError('Failed to log webhook event', 'WEBHOOK_LOG_ERROR', { eventId, error: error.message });
    }
  }
  
  // Mark event as processed
  async markEventProcessed(eventId, result) {
    try {
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_result: result
        })
        .eq('event_id', eventId);
    } catch (error) {
      console.error('Failed to mark event as processed:', error);
      // Non-critical error, don't throw
    }
  }
  
  // Mark event as failed
  async markEventFailed(eventId, error) {
    try {
      await supabase
        .from('webhook_events')
        .update({
          processed: false,
          failed: true,
          error_message: error.message,
          error_code: error.code || 'UNKNOWN_ERROR',
          failed_at: new Date().toISOString()
        })
        .eq('event_id', eventId);
    } catch (logError) {
      console.error('Failed to mark event as failed:', logError);
      // Non-critical error, don't throw
    }
  }
  
  // Handle checkout session completed
  async handleCheckoutSessionCompleted(session) {
    try {
      console.log('Processing checkout session completed:', session.id);
      
      // Verify session status
      if (session.payment_status !== 'paid') {
        console.log(`Session not paid: ${session.payment_status}`);
        return { success: true, message: 'Session not paid', action: 'none' };
      }
      
      // Get booking by session ID
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('stripe_session_id', session.id)
        .single();
      
      if (error || !booking) {
        console.log('Booking not found for session:', session.id);
        return { success: true, message: 'Booking not found', action: 'none' };
      }
      
      // Prevent duplicate processing
      if (booking.status === 'confirmed') {
        console.log('Booking already confirmed:', booking.id);
        return { success: true, message: 'Booking already confirmed', action: 'none' };
      }
      
      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          stripe_payment_status: session.payment_status,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);
      
      if (updateError) {
        throw new WebhookError('Failed to update booking', 'BOOKING_UPDATE_ERROR', { 
          bookingId: booking.id,
          error: updateError.message 
        });
      }
      
      // Create settlement payout
      await this.createSettlementPayout(booking);
      
      // Send confirmation emails
      await this.sendBookingConfirmation(booking);
      
      console.log('Checkout session processed successfully:', {
        sessionId: session.id,
        bookingId: booking.id,
        businessId: booking.business_id
      });
      
      return { 
        success: true, 
        message: 'Booking confirmed successfully',
        action: 'confirmed',
        bookingId: booking.id
      };
      
    } catch (error) {
      console.error('Checkout session processing error:', error);
      throw error;
    }
  }
  
  // Handle payment intent succeeded
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      console.log('Processing payment intent succeeded:', paymentIntent.id);
      
      // Find booking by payment intent ID
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();
      
      if (error || !booking) {
        console.log('Booking not found for payment intent:', paymentIntent.id);
        return { success: true, message: 'Booking not found', action: 'none' };
      }
      
      // Update payment status if needed
      if (booking.payment_status !== 'paid') {
        await supabase
          .from('bookings')
          .update({
            payment_status: 'paid',
            stripe_payment_status: 'succeeded',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);
      }
      
      return { 
        success: true, 
        message: 'Payment intent processed',
        action: 'payment_updated',
        bookingId: booking.id
      };
      
    } catch (error) {
      console.error('Payment intent processing error:', error);
      throw error;
    }
  }
  
  // Handle payment intent failed
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      console.log('Processing payment intent failed:', paymentIntent.id);
      
      // Find booking by payment intent ID
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();
      
      if (error || !booking) {
        console.log('Booking not found for payment intent:', paymentIntent.id);
        return { success: true, message: 'Booking not found', action: 'none' };
      }
      
      // Update booking status to failed
      await supabase
        .from('bookings')
        .update({
          status: 'payment_failed',
          payment_status: 'failed',
          stripe_payment_status: 'failed',
          failure_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);
      
      // Send failure notification
      await this.sendPaymentFailureNotification(booking, paymentIntent);
      
      return { 
        success: true, 
        message: 'Payment failure processed',
        action: 'payment_failed',
        bookingId: booking.id
      };
      
    } catch (error) {
      console.error('Payment intent failure processing error:', error);
      throw error;
    }
  }
  
  // Handle checkout session expired
  async handleCheckoutSessionExpired(session) {
    try {
      console.log('Processing checkout session expired:', session.id);
      
      // Find and update expired booking
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('stripe_session_id', session.id)
        .single();
      
      if (error || !booking) {
        console.log('Booking not found for expired session:', session.id);
        return { success: true, message: 'Booking not found', action: 'none' };
      }
      
      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'expired',
          payment_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);
      
      return { 
        success: true, 
        message: 'Session expired processed',
        action: 'expired',
        bookingId: booking.id
      };
      
    } catch (error) {
      console.error('Session expiration processing error:', error);
      throw error;
    }
  }
  
  // Create settlement payout
  async createSettlementPayout(booking) {
    try {
      // Get service details
      const { data: service, error } = await supabase
        .from('services')
        .select('name, price')
        .eq('id', booking.service_id)
        .single();
      
      if (error || !service) {
        throw new WebhookError('Service not found for payout', 'SERVICE_NOT_FOUND', { 
          bookingId: booking.id,
          serviceId: booking.service_id 
        });
      }
      
      const servicePrice = parseFloat(service.price);
      const platformFee = 0.50;
      const stripeFee = (servicePrice * 0.015) + 0.20;
      const totalFees = platformFee + stripeFee;
      const businessEarnings = servicePrice - totalFees;
      
      // Calculate settlement dates
      const today = new Date();
      const settlementDate = this.calculateStripeSettlementDate(today);
      const businessPayoutDate = this.getNextBusinessDay(settlementDate);
      
      const { error: payoutError } = await supabase
        .from('payouts')
        .insert({
          business_id: booking.business_id,
          booking_id: booking.id,
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
          notes: `Settlement payout for ${service.name} - ${booking.customer_name}`,
          created_at: new Date().toISOString()
        });
      
      if (payoutError) {
        throw new WebhookError('Failed to create payout', 'PAYOUT_CREATION_FAILED', { 
          bookingId: booking.id,
          error: payoutError.message 
        });
      }
      
      console.log('Settlement payout created:', {
        bookingId: booking.id,
        businessId: booking.business_id,
        amount: businessEarnings,
        settlementDate: settlementDate.toISOString().split('T')[0],
        payoutDate: businessPayoutDate.toISOString().split('T')[0]
      });
      
    } catch (error) {
      console.error('Settlement payout creation error:', error);
      // Non-critical error, don't throw to avoid webhook failure
    }
  }
  
  // Send booking confirmation
  async sendBookingConfirmation(booking) {
    try {
      // This would integrate with your email service
      console.log('Booking confirmation sent for:', booking.id);
    } catch (error) {
      console.error('Failed to send booking confirmation:', error);
      // Non-critical error, don't throw
    }
  }
  
  // Send payment failure notification
  async sendPaymentFailureNotification(booking, paymentIntent) {
    try {
      // This would integrate with your email service
      console.log('Payment failure notification sent for:', booking.id);
    } catch (error) {
      console.error('Failed to send payment failure notification:', error);
      // Non-critical error, don't throw
    }
  }
  
  // Helper functions
  calculateStripeSettlementDate(startDate) {
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
  
  getNextBusinessDay(date) {
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
}

// Main webhook handler
exports.handler = async (event, context) => {
  const processor = new WebhookProcessor();
  
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
    const sig = event.headers['stripe-signature'];
    const body = event.body;
    
    if (!sig) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Stripe signature missing' })
      };
    }
    
    // Verify webhook signature
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Webhook signature verification failed' })
      };
    }
    
    // Process the event
    const result = await processor.processEvent(stripeEvent);
    
    const processingTime = Date.now() - startTime;
    console.log('Webhook processed successfully:', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      processingTime: `${processingTime}ms`,
      result: result
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        eventId: stripeEvent.id,
        eventType: stripeEvent.type,
        processingTime,
        result
      })
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Webhook processing error:', {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details || {},
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Webhook processing failed',
        code: error.code || 'UNKNOWN_ERROR',
        processingTime
      })
    };
  }
};
