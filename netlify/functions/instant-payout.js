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
        businesses!inner(name, email, stripe_account_id, bank_details)
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

    // Check if payout already processed
    const { data: existingPayout } = await supabase
      .from('payouts')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (existingPayout) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Payout already processed for this booking' }) 
      };
    }

    // Calculate fees and earnings
    const servicePrice = parseFloat(booking.services.price);
    const platformFee = 0.50; // Fixed £0.50 platform fee
    const stripeFee = (servicePrice * 0.015) + 0.20; // 1.5% + £0.20 Stripe fee
    const totalFees = platformFee + stripeFee;
    const businessEarnings = servicePrice - totalFees;

    // Create payout record immediately
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
        payment_method: 'instant_transfer',
        status: 'processing',
        notes: `Instant payout for ${booking.services.name} - ${booking.customer_name}`,
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

    // Initiate instant transfer to business
    let transferResult = { success: false, message: 'Transfer initiated' };

    try {
      // If business has Stripe Connect account, use instant transfer
      if (booking.businesses.stripe_account_id) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        const transfer = await stripe.transfers.create({
          amount: Math.round(businessEarnings * 100), // Convert to pence
          currency: 'gbp',
          destination: booking.businesses.stripe_account_id,
          transfer_group: `booking_${bookingId}`,
          metadata: {
            booking_id: bookingId,
            business_id: businessId,
            service_name: booking.services.name
          }
        });

        transferResult = { 
          success: true, 
          transferId: transfer.id,
          message: 'Instant transfer initiated via Stripe Connect'
        };

        // Update payout status to completed
        await supabase
          .from('payouts')
          .update({ 
            status: 'paid',
            stripe_transfer_id: transfer.id,
            paid_at: new Date().toISOString()
          })
          .eq('id', payout.id);

      } else if (booking.businesses.bank_details) {
        // For bank transfers, mark as pending manual processing
        transferResult = { 
          success: true, 
          message: 'Bank transfer queued for immediate processing'
        };

        // Update payout status to pending
        await supabase
          .from('payouts')
          .update({ 
            status: 'pending',
            notes: `${payout.notes} - Bank transfer queued for immediate processing`
          })
          .eq('id', payout.id);

        // Send notification for immediate bank transfer processing
        await sendImmediateTransferNotification(booking.businesses, businessEarnings, booking);
      }

    } catch (transferError) {
      console.error('Transfer error:', transferError);
      transferResult = { 
        success: false, 
        message: 'Transfer failed, will retry automatically'
      };
    }

    // Send email notification to business
    await sendPayoutNotification(booking.businesses, businessEarnings, totalFees, transferResult);

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
          status: transferResult.success ? 'paid' : 'processing',
          transfer_result: transferResult
        },
        message: 'Instant payout processed successfully'
      })
    };

  } catch (error) {
    console.error('Instant payout error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendPayoutNotification(business, earnings, fees, transferResult) {
  try {
    const { sendEmail } = require('./email-service');
    
    const emailContent = {
      to: business.email,
      subject: `?? Instant Payout Received - £${earnings.toFixed(2)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Instant Payout Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            .payout-details { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .amount { font-size: 24px; font-weight: bold; color: #10b981; margin-bottom: 10px; }
            .status { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status.paid { background: #d1fae5; color: #065f46; }
            .status.processing { background: #fef3c7; color: #d97706; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>?? Instant Payout Received!</h1>
              <p>Your earnings have been processed immediately</p>
            </div>

            <div class="content">
              <p>Hi <strong>${business.name}</strong>,</p>
              <p>Great news! Your earnings from a recent booking have been processed instantly and are on their way to you.</p>
              
              <div class="payout-details">
                <div class="amount">£${earnings.toFixed(2)}</div>
                <div class="status ${transferResult.success ? 'paid' : 'processing'}">
                  ${transferResult.success ? '?? Transfer Complete' : '?? Processing...'}
                </div>
                <p><strong>${transferResult.message}</strong></p>
              </div>

              <h3>Payment Breakdown:</h3>
              <ul>
                <li>Gross Amount: £${(earnings + fees).toFixed(2)}</li>
                <li>Platform Fee: £0.50</li>
                <li>Stripe Fee: £${(fees - 0.50).toFixed(2)}</li>
                <li><strong>Your Earnings: £${earnings.toFixed(2)}</strong></li>
              </ul>

              <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <h3>?? Instant Payout Guarantee</h3>
                <p>We process payouts immediately after successful bookings. No waiting periods - you get your money as fast as possible.</p>
                <p>If you have any questions about this payout, please contact our support team.</p>
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

async function sendImmediateTransferNotification(business, amount, booking) {
  try {
    const { sendEmail } = require('./email-service');
    
    const emailContent = {
      to: 'admin@showupmedia.org', // Your email for immediate processing
      subject: `?? Immediate Bank Transfer Required - ${business.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Immediate Transfer Required</title>
        </head>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>?? Immediate Bank Transfer Required</h2>
            <p><strong>Business:</strong> ${business.name}</p>
            <p><strong>Amount:</strong> £${amount.toFixed(2)}</p>
            <p><strong>Service:</strong> ${booking.services.name}</p>
            <p><strong>Customer:</strong> ${booking.customer_name}</p>
            <p><strong>Booking ID:</strong> ${booking.id}</p>
            
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>?? ACTION REQUIRED:</strong> Process bank transfer immediately to ensure business gets paid ASAP.</p>
            </div>
            
            <p><strong>Bank Details:</strong></p>
            <pre>${business.bank_details}</pre>
          </div>
        </body>
        </html>
      `
    };

    await sendEmail(emailContent);
  } catch (error) {
    console.error('Immediate transfer notification error:', error);
  }
}
