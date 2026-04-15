const twilio = require('twilio');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/xml',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: '<Response><Say>Method not allowed.</Say></Response>' };
  }

  try {
    const formData = event.body
      ? Object.fromEntries(new URLSearchParams(event.body))
      : {};

    console.log('TwiML received params:', JSON.stringify(formData));

    const To = formData.To || formData.to;

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (To && !To.startsWith('client:')) {
      const dial = response.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        record: 'record-from-answer-dual',
        recordingStatusCallback: `${process.env.SITE_URL}/.netlify/functions/recording-callback`,
        recordingStatusCallbackMethod: 'POST',
        timeout: 20, // Ring for 20 seconds
        action: `${process.env.SITE_URL}/.netlify/functions/voicemail-callback`
      });
      dial.number(To);
    } else {
      // Voicemail for direct calls to your Twilio number
      response.say({ voice: 'alice', language: 'en-GB' }, 'Hello and welcome to Show Up Media. All our agents are currently busy. Please leave a message after the tone with your name, company name, and phone number, and we will get back to you as soon as possible.');
      
      response.record({
        action: `${process.env.SITE_URL}/.netlify/functions/voicemail-callback`,
        method: 'POST',
        maxLength: 60,
        transcribe: true,
        playBeep: true,
        recordingStatusCallback: `${process.env.SITE_URL}/.netlify/functions/recording-callback`,
        recordingStatusCallbackMethod: 'POST'
      });
      
      response.say({ voice: 'alice', language: 'en-GB' }, 'Thank you for your message. We will get back to you soon. Goodbye.');
    }

    return { statusCode: 200, headers, body: response.toString() };

  } catch (error) {
    console.error('TwiML error:', error);
    return {
      statusCode: 500,
      headers,
      body: '<Response><Say>Error processing call.</Say></Response>'
    };
  }
};
