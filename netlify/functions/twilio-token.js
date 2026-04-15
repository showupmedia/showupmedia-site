const twilio = require('twilio');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { identity } = JSON.parse(event.body);

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true
    });

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: identity || 'agent' }
    );

    token.addGrant(voiceGrant);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: token.toJwt() })
    };

  } catch (error) {
    console.error('Error generating Twilio token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate token', message: error.message })
    };
  }
};
