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
    const subdomain = event.path.split('/').pop();
    
    if (!subdomain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Business subdomain required' })
      };
    }

    // Get business data with services and hours
    const { data: business, error } = await supabase
      .from('businesses')
      .select(`
        *,
        services!inner(
          id,
          name,
          price,
          duration,
          description
        ),
        business_hours!inner(
          day_of_week,
          open_time,
          close_time,
          is_closed
        )
      `)
      .eq('subdomain', subdomain)
      .eq('status', 'active')
      .single();

    if (error || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(business)
    };

  } catch (error) {
    console.error('API business error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
