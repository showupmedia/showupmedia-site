exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const formData = event.body
      ? Object.fromEntries(new URLSearchParams(event.body))
      : {};

    const { RecordingUrl, RecordingSid, CallSid, RecordingDuration } = formData;

    console.log('📼 Recording ready:', {
      RecordingSid,
      CallSid,
      RecordingDuration,
      RecordingUrl
    });

    // Recording URL is available as RecordingUrl + '.mp3'
    // You can store this in your database here if needed in future

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };

  } catch (error) {
    console.error('Recording callback error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
