exports.handler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  try {
    // Handle OPTIONS requests for CORS
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'CORS preflight' })
      };
    }

    // Log all requests for debugging
    console.log(`Error Handler - ${method} ${path}`, {
      body: event.body,
      headers: event.headers,
      queryString: event.queryStringParameters
    });

    // Return helpful error information
    const errorResponse = {
      error: true,
      message: 'Endpoint not found or method not allowed',
      path: path,
      method: method,
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        '/.netlify/functions/email-service',
        '/.netlify/functions/email-confirmations', 
        '/.netlify/functions/welcome-email',
        '/.netlify/functions/stripe-webhook',
        '/.netlify/functions/api-business',
        '/.netlify/functions/api-services',
        '/.netlify/functions/api-booking',
        '/.netlify/functions/create-booking',
        '/.netlify/functions/cancel-booking',
        '/.netlify/functions/staff-management'
      ]
    };

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify(errorResponse)
    };

  } catch (error) {
    console.error('Error handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: true,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
};
