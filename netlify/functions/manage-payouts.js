const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Handle different methods
  if (event.httpMethod === 'GET') {
    return await getPayouts(event);
  } else if (event.httpMethod === 'POST') {
    return await createPayout(event);
  } else {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }
};

async function getPayouts(event) {
  try {
    const businessId = event.queryStringParameters.business_id;
    const status = event.queryStringParameters.status; // pending, processed, paid

    let query = supabase
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payouts, error } = await query;

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch payouts' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ payouts })
    };

  } catch (error) {
    console.error('Get payouts error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

async function createPayout(event) {
  try {
    const { business_id, amount, notes, payment_method } = JSON.parse(event.body);

    if (!business_id || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Business ID and amount required' })
      };
    }

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    // Get booking details to calculate actual Stripe fees
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(
          price
        )
      `)
      .eq('business_id', business_id)
      .eq('status', 'confirmed');

    if (bookingError || !bookings) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch booking details' })
      };
    }

    // Calculate all fees
    const platformFeeRate = 0.50; // £0.50 per transaction
    const stripeFeeRate = 0.015; // 1.5% Stripe fee
    const stripeFixedFee = 0.20; // 20p fixed Stripe fee
    
    let totalPlatformFees = 0;
    let totalStripeFees = 0;
    let totalGrossRevenue = 0;

    bookings.forEach(booking => {
      const servicePrice = parseFloat(booking.services.price);
      const platformFee = platformFeeRate;
      const stripeFee = (servicePrice * stripeFeeRate) + stripeFixedFee;
      
      totalPlatformFees += platformFee;
      totalStripeFees += stripeFee;
      totalGrossRevenue += servicePrice;
    });

    const totalFees = totalPlatformFees + totalStripeFees;
    const netAmount = totalGrossRevenue - totalFees;

    // Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        business_id: business_id,
        business_name: business.name,
        business_email: business.email,
        amount: parseFloat(amount),
        platform_fee: totalPlatformFees,
        stripe_fee: totalStripeFees,
        total_fees: totalFees,
        net_amount: netAmount,
        transaction_count: bookings.length,
        status: 'pending',
        payment_method: payment_method || 'bank_transfer',
        notes: notes || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (payoutError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create payout' })
      };
    }

    // Send notification to business
    await sendPayoutNotification(business, payout);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Payout created successfully',
        payout
      })
    };

  } catch (error) {
    console.error('Create payout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

async function sendPayoutNotification(business, payout) {
  try {
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payout Notification - Show Up Media</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
          .payout-details { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>?? Payout Processing</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${business.name}</strong>,</p>
            <p>We're processing a payout for your recent earnings. Here are the details:</p>
            <div class="payout-details">
              <div class="detail-row">
                <span><strong>Total Revenue:</strong></span>
                <span>£${payout.amount.toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span><strong>Platform Fee:</strong></span>
                <span>£${payout.platform_fee.toFixed(2)} (£0.50 × ${payout.transaction_count || 0} transactions)</span>
              </div>
              <div class="detail-row">
                <span><strong>Stripe Processing Fees:</strong></span>
                <span>£${(payout.stripe_fee || 0).toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span><strong>Total Fees:</strong></span>
                <span>£${(payout.total_fees || 0).toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span><strong>Net Payout:</strong></span>
                <span><strong>£${payout.net_amount.toFixed(2)}</strong></span>
              </div>
              <div class="detail-row">
                <span><strong>Status:</strong></span>
                <span>${payout.status}</span>
              </div>
              <div class="detail-row">
                <span><strong>Payment Method:</strong></span>
                <span>${payout.payment_method.replace('_', ' ')}</span>
              </div>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>We'll process your payout within 3-5 business days</li>
              <li>You'll receive a confirmation email when payment is sent</li>
              <li>Contact support if you have any questions</li>
            </ol>
            ${payout.notes ? `<p><strong>Notes:</strong> ${payout.notes}</p>` : ''}
          </div>
          <div class="footer">
            <p>Thank you for using Show Up Media for your booking system.</p>
            <p>© 2024 Show Up Media. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email notification
    await fetch(`${process.env.URL}/.netlify/functions/email-service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: business.email,
        subject: `Payout Processing - £${payout.net_amount.toFixed(2)}`,
        html: emailContent
      })
    });

    console.log(`Payout notification sent to ${business.email}`);

  } catch (error) {
    console.error('Error sending payout notification:', error);
  }
}
