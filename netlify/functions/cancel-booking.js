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
    const { 
      bookingId, 
      businessId, 
      reason, 
      refundRequested,
      customerEmail,
      customerName 
    } = JSON.parse(event.body);

    if (!bookingId || !reason) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        bookings.*,
        services!inner(
          name,
          price,
          cancellation_policy
        ),
        businesses!inner(
          name,
          email,
          cancellation_policy as business_cancellation_policy
        )
      `)
      .eq('bookings.id', bookingId)
      .single();

    if (error || !booking) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Check cancellation policy
    const policy = booking.services.cancellation_policy || booking.businesses.business_cancellation_policy || '24h';
    const bookingDateTime = new Date(booking.booking_date + 'T' + booking.booking_time);
    const now = new Date();
    const timeDiff = bookingDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    let refundAmount = 0;
    let canCancel = true;
    let cancellationFee = 0;
    let cancellationReason = '';

    // Apply cancellation policy
    if (hoursDiff <= 24) {
      // Less than 24 hours - no refund
      refundAmount = 0;
      cancellationFee = booking.services.price;
      cancellationReason = 'Less than 24 hours notice - no refund';
      canCancel = false;
    } else if (hoursDiff <= 48) {
      // 24-48 hours - 50% refund
      refundAmount = booking.services.price * 0.5;
      cancellationFee = booking.services.price * 0.5;
      cancellationReason = '24-48 hours notice - 50% refund';
    } else {
      // More than 48 hours - full refund
      refundAmount = booking.services.price;
      cancellationFee = 0;
      cancellationReason = 'More than 48 hours notice - full refund';
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_fee: cancellationFee,
        refund_amount: refundAmount,
        cancelled_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to cancel booking' })
      };
    }

    // Send cancellation emails
    await sendCancellationEmails(booking, policy, refundAmount, cancellationFee, customerEmail);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Booking cancelled successfully',
        booking: {
          id: booking.id,
          canCancel,
          refundAmount,
          cancellationFee,
          policy: cancellationReason
        }
      })
    };

  } catch (error) {
    console.error('Booking cancellation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendCancellationEmails(booking, policy, refundAmount, cancellationFee, customerEmail) {
  try {
    // Customer cancellation email
    const customerEmailContent = generateCustomerCancellationEmail(booking, policy, refundAmount, cancellationFee);
    console.log(`Sending cancellation email to customer: ${customerEmail}`);
    
    // Business notification email
    const businessEmailContent = generateBusinessCancellationEmail(booking, policy, refundAmount, cancellationFee);
    console.log(`Sending cancellation notification to business: ${booking.businesses.email}`);
    
    // In real implementation, you'd call your Resend function here
    console.log('Customer cancellation email content:', customerEmailContent);
    console.log('Business cancellation email content:', businessEmailContent);
    
    return true;
  } catch (error) {
    console.error('Error sending cancellation emails:', error);
    return false;
  }
}

function generateCustomerCancellationEmail(booking, policy, refundAmount, cancellationFee) {
  const refundStatus = refundAmount > 0 ? 
    `£${refundAmount.toFixed(2)} refund` : 
    'No refund (cancellation fee applies)';
    
  const refundMessage = refundAmount > 0 ? 
    'Your refund will be processed within 5-7 business days.' : 
    'Unfortunately, no refund is available due to the cancellation policy.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancelled - ${booking.services.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 18px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .cancelled-info { background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 20px; }
        .refund-info { background: #dcfce7; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .policy-box { background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px; }
        .cta { background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: block; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">❌</div>
          <div class="title">Booking Cancelled</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.customer_name || 'Valued Customer'}</strong>,</p>
          <p>Your booking for <strong>${booking.services.name}</strong> has been cancelled.</p>

          <div class="cancelled-info">
            <h3>Cancelled Booking Details:</h3>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${booking.booking_time}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Original Price:</span>
              <span class="detail-value">£${booking.services.price}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cancellation Fee:</span>
              <span class="detail-value">£${cancellationFee.toFixed(2)}</span>
            </div>
          </div>

          <div class="refund-info">
            <h3>💰 Refund Information</h3>
            <p><strong>Refund Amount:</strong> ${refundStatus}</p>
            <p>${refundMessage}</p>
          </div>

          <div class="policy-box">
            <h3>📋 Cancellation Policy</h3>
            <p><strong>Standard Policy:</strong></p>
            <ul>
              <li>✅ More than 48 hours notice: Full refund</li>
              <li>⚠️ 24-48 hours notice: 50% refund</li>
              <li>❌ Less than 24 hours notice: No refund</li>
            </ul>
            <p><em>This policy ensures fair treatment for both customers and service providers.</em></p>
          </div>

          <a href="https://showupmedia.org/booking" class="cta">Book New Appointment</a>
        </div>

        <div class="footer">
          <p>We're sorry to see your booking cancelled. Hope to see you again soon!</p>
          <p>© 2024 ${booking.businesses.name}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateBusinessCancellationEmail(booking, policy, refundAmount, cancellationFee) {
  const refundStatus = refundAmount > 0 ? 
    `£${refundAmount.toFixed(2)} refund to customer` : 
    'No refund (cancellation fee retained)';
    
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancelled - ${booking.services.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 18px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .cancelled-info { background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .policy-box { background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px; }
        .cta { background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: block; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📅</div>
          <div class="title">Booking Cancelled</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.businesses.name}</strong> Team,</p>
          <p>A booking has been cancelled by the customer:</p>

          <div class="cancelled-info">
            <h3>Cancelled Booking Details:</h3>
            <div class="detail-row">
              <span class="detail-label">Customer:</span>
              <span class="detail-value">${booking.customer_name || 'Customer'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${booking.booking_time}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Original Price:</span>
              <span class="detail-value">£${booking.services.price}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cancellation Fee:</span>
              <span class="detail-value">£${cancellationFee.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Refund to Customer:</span>
              <span class="detail-value">${refundStatus}</span>
            </div>
          </div>

          <div class="policy-box">
            <h3>💡 Business Actions</h3>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>📅 Open the time slot for new bookings</li>
              <li>💰 Process refund if applicable</li>
              <li>📧 Review cancellation patterns</li>
              <li>📊 Update availability if needed</li>
            </ul>
          </div>

          <a href="https://showupmedia.org/crm" class="cta">View in Dashboard</a>
        </div>

        <div class="footer">
          <p>Check your dashboard for more details and customer management.</p>
          <p>© 2024 Show Up Media. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
