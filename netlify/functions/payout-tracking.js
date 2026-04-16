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
    const businessId = event.queryStringParameters.business_id;
    const period = event.queryStringParameters.period || 'month'; // week, month, year

    if (!businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Business ID required' })
      };
    }

    // Get completed bookings for the business
    const startDate = getStartDate(period);
    
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(
          name,
          price
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (bookingError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch bookings' })
      };
    }

    // Calculate financial metrics
    const platformFeeRate = 0.50; // £0.50 fixed platform fee per transaction
    const stripeFeeRate = 0.015; // 1.5% Stripe fee (European cards average)
    const stripeFixedFee = 0.20; // 20p fixed Stripe fee
    let grossRevenue = 0;
    let platformFees = 0;
    let stripeFees = 0;
    let totalFees = 0;
    let netPayout = 0;
    let totalBookings = bookings.length;

    const transactions = bookings.map(booking => {
      const servicePrice = parseFloat(booking.services.price);
      const platformFee = platformFeeRate; // Fixed £0.50 fee
      const stripeFee = (servicePrice * stripeFeeRate) + stripeFixedFee; // Stripe processing fee
      const totalTransactionFee = platformFee + stripeFee;
      const businessEarnings = servicePrice - totalTransactionFee;

      grossRevenue += servicePrice;
      platformFees += platformFee;
      stripeFees += stripeFee;
      totalFees += totalTransactionFee;
      netPayout += businessEarnings;

      return {
        booking_id: booking.id,
        service_name: booking.services.name,
        customer_name: booking.customer_name,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        gross_amount: servicePrice,
        platform_fee: platformFee,
        stripe_fee: stripeFee,
        total_fees: totalTransactionFee,
        net_amount: businessEarnings,
        status: booking.status,
        created_at: booking.created_at
      };
    });

    // Get payout history
    const { data: payouts, error: payoutError } = await supabase
      .from('payouts')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (payoutError) {
      console.error('Error fetching payouts:', payoutError);
    }

    // Calculate accumulated earnings (not yet paid out)
    const totalPaidOut = payouts?.reduce((sum, payout) => sum + payout.amount, 0) || 0;
    const accumulatedEarnings = netPayout - totalPaidOut;

    const summary = {
      period: period,
      start_date: startDate.toISOString(),
      end_date: new Date().toISOString(),
      total_bookings: totalBookings,
      gross_revenue: grossRevenue,
      platform_fees: platformFees,
      stripe_fees: stripeFees,
      total_fees: totalFees,
      net_payout: netPayout,
      accumulated_earnings: accumulatedEarnings,
      total_paid_out: totalPaidOut,
      platform_fee_per_transaction: platformFeeRate,
      stripe_fee_rate: stripeFeeRate,
      stripe_fixed_fee: stripeFixedFee
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        summary,
        transactions,
        payouts: payouts || []
      })
    };

  } catch (error) {
    console.error('Payout tracking error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

function getStartDate(period) {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }

  return startDate;
}
