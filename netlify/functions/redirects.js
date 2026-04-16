exports.handler = async (event, context) => {
  const path = event.path;
  
  // API routing for booking pages
  if (path.startsWith('/api/business/')) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: 'API endpoint - use api-business function',
        endpoint: '/.netlify/functions/api-business'
      })
    };
  }
  
  if (path.startsWith('/api/services/')) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: 'API endpoint - use api-services function',
        endpoint: '/.netlify/functions/api-services'
      })
    };
  }
  
  if (path.startsWith('/api/booking')) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: 'API endpoint - use api-booking function',
        endpoint: '/.netlify/functions/api-booking'
      })
    };
  }
  
  // Default redirect for booking pages
  if (path.startsWith('/booking/')) {
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Booking page route - serves booking.html',
        file: 'booking.html'
      })
    };
  }
  
  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' })
  };
};
