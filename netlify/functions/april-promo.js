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
      type, 
      businessId, 
      promoCode,
      email 
    } = JSON.parse(event.body);

    if (!type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    let result;

    switch (type) {
      case 'validate-promo':
        result = await validateAprilPromo(promoCode, email);
        break;

      case 'apply-promo':
        result = await applyAprilPromo(businessId, promoCode);
        break;

      case 'get-promo-stats':
        result = await getPromoStats();
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid operation type' })
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('April promo error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function validateAprilPromo(promoCode, email) {
  try {
    const currentMonth = new Date().getMonth(); // 3 for April
    const currentYear = new Date().getFullYear();
    
    // Check if it's April 2026
    if (currentMonth !== 3 || currentYear !== 2026) {
      return {
        valid: false,
        message: 'This promotion is only valid in April 2026',
        discount: 0
      };
    }

    // Check promo code
    const validCodes = ['SHOWUPFREE', 'SHOWUP24', 'LAUNCH26'];
    if (!validCodes.includes(promoCode?.toUpperCase())) {
      return {
        valid: false,
        message: 'Invalid promo code',
        discount: 0
      };
    }

    // Check if email already used this promo
    const { data: existingUsage, error: usageError } = await supabase
      .from('promo_usage')
      .select('*')
      .eq('promo_code', promoCode.toUpperCase())
      .eq('email', email)
      .eq('promo_type', 'april_launch')
      .single();

    if (existingUsage) {
      return {
        valid: false,
        message: 'This promo code has already been used with this email',
        discount: 0
      };
    }

    // Insert sample April promotion data (for testing)
    await supabase
      .from('business_promotions')
      .insert([
        {
          promo_code: 'SHOWUPFREE',
          promo_type: 'show_up_launch',
          discount_percentage: 100,
          discount_amount: 0,
          discount_duration_months: 1,
          start_date: '2026-04-01T00:00:00Z',
          end_date: '2026-05-01T00:00:00Z',
          status: 'active'
        },
        {
          promo_code: 'SHOWUP24',
          promo_type: 'show_up_launch',
          discount_percentage: 100,
          discount_amount: 0,
          discount_duration_months: 1,
          start_date: '2026-04-01T00:00:00Z',
          end_date: '2026-05-01T00:00:00Z',
          status: 'active'
        },
        {
          promo_code: 'LAUNCH26',
          promo_type: 'show_up_launch',
          discount_percentage: 100,
          discount_amount: 0,
          discount_duration_months: 1,
          start_date: '2026-04-01T00:00:00Z',
          end_date: '2026-05-01T00:00:00Z',
          status: 'active'
        }
      ])
      .onConflict('promo_code')
      .doNothing();

    return {
      valid: true,
      message: 'Promo code valid! First month free.',
      discount: 100, // 100% discount for first month
      plans: ['basic', 'pro', 'premium']
    };
  } catch (error) {
    console.error('Validate promo error:', error);
    throw error;
  }
}

async function applyAprilPromo(businessId, promoCode) {
  try {
    // Validate promo first
    const validation = await validateAprilPromo(promoCode, null);
    
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return {
        success: false,
        message: 'Business not found'
      };
    }

    // Check if business already has active promo
    const { data: existingPromo, error: promoError } = await supabase
      .from('business_promotions')
      .select('*')
      .eq('business_id', businessId)
      .eq('promo_code', promoCode.toUpperCase())
      .eq('status', 'active')
      .single();

    if (existingPromo) {
      return {
        success: false,
        message: 'This promotion is already applied to your business'
      };
    }

    // Apply the promotion
    const promoStartDate = new Date().toISOString();
    const promoEndDate = new Date('2024-05-01T00:00:00').toISOString();

    const { data: appliedPromo, error: applyError } = await supabase
      .from('business_promotions')
      .insert([
        {
          business_id: businessId,
          promo_code: promoCode.toUpperCase(),
          promo_type: 'april_launch',
          discount_percentage: 100,
          discount_amount: 0,
          start_date: promoStartDate,
          end_date: promoEndDate,
          status: 'active',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (applyError) {
      throw applyError;
    }

    // Update business plan to show promo applied
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        promo_applied: true,
        promo_code: promoCode.toUpperCase(),
        promo_end_date: promoEndDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId);

    if (updateError) {
      throw updateError;
    }

    // Track promo usage
    await supabase
      .from('promo_usage')
      .insert([
        {
          business_id: businessId,
          email: business.email,
          promo_code: promoCode.toUpperCase(),
          promo_type: 'april_launch',
          used_at: new Date().toISOString()
        }
      ]);

    console.log(`April promo applied to business ${businessId}: ${promoCode}`);

    return {
      success: true,
      message: 'April launch promotion applied successfully!',
      promotion: {
        code: promoCode.toUpperCase(),
        discount: '100%',
        duration: 'First month free',
        validUntil: promoEndDate,
        savings: business.plan === 'basic' ? '£6.99' : 
                 business.plan === 'pro' ? '£9.99' : '£14.99'
      }
    };
  } catch (error) {
    console.error('Apply promo error:', error);
    throw error;
  }
}

async function getPromoStats() {
  try {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Get total promo usage
    const { data: promoUsage, error: usageError } = await supabase
      .from('promo_usage')
      .select('*')
      .eq('promo_type', 'april_launch');

    if (usageError) {
      throw usageError;
    }

    // Get active promotions
    const { data: activePromos, error: activeError } = await supabase
      .from('business_promotions')
      .select('*')
      .eq('promo_type', 'april_launch')
      .eq('status', 'active');

    if (activeError) {
      throw activeError;
    }

    // Calculate conversion rate
    const totalViews = 1500; // This would come from analytics
    const conversionRate = totalViews > 0 ? (promoUsage.length / totalViews * 100).toFixed(1) : 0;

    // Calculate total savings
    const totalSavings = promoUsage.reduce((sum, usage) => {
      // This would be calculated based on the plan they signed up for
      return sum + 6.99; // Average savings
    }, 0);

    // Plan breakdown
    const planBreakdown = promoUsage.reduce((acc, usage) => {
      // This would be enhanced with actual plan data
      acc.basic = (acc.basic || 0) + 1;
      return acc;
    }, { basic: 0, pro: 0, premium: 0 });

    return {
      message: 'April promotion statistics retrieved successfully',
      stats: {
        totalUsage: promoUsage.length,
        activePromotions: activePromos.length,
        conversionRate: parseFloat(conversionRate),
        totalSavings: totalSavings.toFixed(2),
        planBreakdown,
        period: {
          month: 'April',
          year: currentYear,
          daysRemaining: Math.max(0, 30 - new Date().getDate())
        }
      }
    };
  } catch (error) {
    console.error('Get promo stats error:', error);
    throw error;
  }
}
