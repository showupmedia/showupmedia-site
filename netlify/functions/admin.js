// Netlify Function for admin dashboard data
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Only allow GET requests for admin data
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { businessId, action } = event.queryStringParameters;

    if (!businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Business ID required' })
      };
    }

    if (action === 'bookings') {
      // Get bookings for this business
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          bookings: data
        })
      };

    } else if (action === 'stats') {
      // Get booking statistics
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('status, created_at')
        .eq('business_id', businessId);

      if (error) throw error;

      const stats = {
        total: bookings.length,
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        thisMonth: bookings.filter(b => {
          const bookingDate = new Date(b.created_at);
          const now = new Date();
          return bookingDate.getMonth() === now.getMonth() && 
                 bookingDate.getFullYear() === now.getFullYear();
        }).length
      };

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          stats
        })
      };

    } else if (action === 'staff') {
      // Get staff members for this business
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          staff: data
        })
      };

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }

  } catch (error) {
    console.error('Admin API error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch admin data',
        details: error.message 
      })
    };
  }
};
