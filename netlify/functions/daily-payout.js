const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { bookingId, businessId } = JSON.parse(event.body);

    if (!bookingId || !businessId) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Booking ID and Business ID required' }) 
      };
    }

    // Get booking details with service information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(name, price),
        businesses!inner(name, email, bank_details)
      `)
      .eq('id', bookingId)
      .eq('business_id', businessId)
      .single();

    if (bookingError || !booking) {
      return { 
        statusCode: 404, 
        headers, 
        body: JSON.stringify({ error: 'Booking not found' }) 
      };
    }

    // Check if payout already recorded
    const { data: existingPayout } = await supabase
      .from('payouts')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (existingPayout) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Payout already recorded for this booking' }) 
      };
    }

    // Calculate fees and earnings
    const servicePrice = parseFloat(booking.services.price);
    const platformFee = 0.50; // Fixed £0.50 platform fee
    const stripeFee = (servicePrice * 0.015) + 0.20; // 1.5% + £0.20 Stripe fee
    const totalFees = platformFee + stripeFee;
    const businessEarnings = servicePrice - totalFees;

    // Create daily payout record with settlement timeline
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const isWeekday = new Date().getDay() >= 1 && new Date().getDay() <= 5; // Monday-Friday
    
    // Calculate settlement date (2-7 business days from today)
    const settlementDate = calculateSettlementDate(today);
    const businessPayoutDate = getNextWeekday(settlementDate); // Business gets paid next business day after settlement

    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        business_id: businessId,
        booking_id: bookingId,
        gross_amount: servicePrice,
        platform_fee: platformFee,
        stripe_fee: stripeFee,
        total_fees: totalFees,
        net_amount: businessEarnings,
        transaction_count: 1,
        payment_method: 'daily_bank_transfer',
        status: 'pending_settlement',
        notes: `Daily payout for ${booking.services.name} - ${booking.customer_name}`,
        stripe_settlement_date: settlementDate,
        payout_date: businessPayoutDate,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Payout creation error:', payoutError);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Failed to create payout record' }) 
      };
    }

    // Send notification to business about daily payout
    await sendDailyPayoutNotification(booking.businesses, businessEarnings, totalFees, payout);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payout: {
          id: payout.id,
          gross_amount: servicePrice,
          platform_fee: platformFee,
          stripe_fee: stripeFee,
          total_fees: totalFees,
          net_amount: businessEarnings,
          status: 'pending_daily',
          payout_date: payout.payout_date,
          next_payout_day: isWeekday ? 'Today' : 'Next business day'
        },
        message: 'Daily payout recorded successfully'
      })
    };

  } catch (error) {
    console.error('Daily payout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

function getNextWeekday(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  const daysToAdd = day === 0 ? 1 : day === 6 ? 2 : 0; // Sunday -> Monday, Saturday -> Monday
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().split('T')[0];
}

function calculateSettlementDate(dateString) {
  // Stripe typically settles in 2-7 business days
  // We'll use 3 business days as average estimate
  const date = new Date(dateString);
  let businessDaysToAdd = 3;
  
  while (businessDaysToAdd > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day >= 1 && day <= 5) { // Monday-Friday
      businessDaysToAdd--;
    }
  }
  
  return date.toISOString().split('T')[0];
}

async function sendDailyPayoutNotification(business, earnings, fees, payout) {
  try {
    const { sendEmail } = require('./email-service');
    
    const settlementDate = new Date(payout.stripe_settlement_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const businessPayoutDate = new Date(payout.payout_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const emailContent = {
      to: business.email,
      subject: `?? Payout Scheduled - £${earnings.toFixed(2)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payout Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            .payout-details { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
            .status { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; background: #fef3c7; color: #d97706; }
            .timeline { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-top: 20px; }
            .timeline-step { display: flex; align-items: center; margin-bottom: 15px; }
            .step-number { width: 30px; height: 30px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
            .step-content { flex: 1; }
            .step-date { font-weight: bold; color: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>?? Payout Scheduled</h1>
              <p>Your earnings are being processed for payout</p>
            </div>

            <div class="content">
              <p>Hi <strong>${business.name}</strong>,</p>
              <p>Great news! Your earnings from a recent booking have been recorded and scheduled for payout.</p>
              
              <div class="payout-details">
                <div class="amount">£${earnings.toFixed(2)}</div>
                <div class="status">?? Pending Stripe Settlement</div>
                <p><strong>Business Payout Date:</strong> ${businessPayoutDate}</p>
              </div>

              <h3>Payment Breakdown:</h3>
              <ul>
                <li>Gross Amount: £${(earnings + fees).toFixed(2)}</li>
                <li>Platform Fee: £0.50</li>
                <li>Stripe Fee: £${(fees - 0.50).toFixed(2)}</li>
                <li><strong>Your Earnings: £${earnings.toFixed(2)}</strong></li>
              </ul>

              <div class="timeline">
                <h3>?? Payout Timeline</h3>
                <div class="timeline-step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <div class="step-date">Today</div>
                    <p>Customer payment processed and earnings recorded</p>
                  </div>
                </div>
                <div class="timeline-step">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <div class="step-date">${settlementDate}</div>
                    <p>Stripe settles funds to Show Up Media's bank account (2-7 business days)</p>
                  </div>
                </div>
                <div class="timeline-step">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <div class="step-date">${businessPayoutDate}</div>
                    <p>Show Up Media transfers your earnings to your bank account</p>
                  </div>
                </div>
              </div>

              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h3 style="color: #d97706; margin-bottom: 10px;">?? Important Note</h3>
                <p style="color: #d97706;">Payouts are processed after Stripe settlement clears. This ensures all funds are available before transfers are made.</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
              <p>Thank you for using Show Up Media!</p>
              <p>© 2024 Show Up Media. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendEmail(emailContent);
  } catch (error) {
    console.error('Email notification error:', error);
  }
}
