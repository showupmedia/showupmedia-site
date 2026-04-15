// Netlify Function for user authentication
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, email, password } = JSON.parse(event.body);

    if (action === 'signup') {
      // Handle user signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          user: data.user
        })
      };

    } else if (action === 'login') {
      // Handle user login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          session: data.session,
          user: data.user
        })
      };

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Authentication failed',
        details: error.message 
      })
    };
  }
};
