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

    console.log('Voicemail received:', JSON.stringify(formData));

    const { 
      From, 
      To, 
      RecordingUrl, 
      RecordingSid, 
      TranscriptionText,
      CallSid 
    } = formData;

    // Log the voicemail details
    console.log(`🎙️ New voicemail from ${From} to ${To}`);
    console.log(`📞 Call SID: ${CallSid}`);
    console.log(`🔗 Recording URL: ${RecordingUrl}.mp3`);
    console.log(`📝 Transcription: ${TranscriptionText || 'No transcription available'}`);

    // Send email notification about new voicemail
    try {
      const emailResponse = await fetch(`${process.env.SITE_URL}/.netlify/functions/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'hello@showupmedia.org',
          subject: `🎙️ New Voicemail from ${From}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">🎙️ New Voicemail Received</h2>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${From}</p>
                <p><strong>To:</strong> ${To}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB')}</p>
                <p><strong>Call SID:</strong> ${CallSid}</p>
              </div>
              
              ${TranscriptionText ? `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #1976d2; margin-top: 0;">📝 Transcription:</h3>
                  <p style="font-style: italic;">"${TranscriptionText}"</p>
                </div>
              ` : ''}
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">🎧 Listen to Recording:</h3>
                <p><a href="${RecordingUrl}.mp3" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Play Voicemail</a></p>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                  Note: This link will expire after a few hours. Download it if you need to keep it.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #666; font-size: 14px;">
                  This voicemail was left on your Show Up Media business line: ${To}
                </p>
              </div>
            </div>
          `
        })
      });

      console.log('Voicemail email notification sent:', emailResponse.ok);
    } catch (emailError) {
      console.error('Failed to send voicemail email:', emailError);
    }

    // Return TwiML response to end the call
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say({ voice: 'alice', language: 'en-GB' }, 'Thank you for your message. We will get back to you soon. Goodbye.');
    response.hangup();

    return { statusCode: 200, headers, body: response.toString() };

  } catch (error) {
    console.error('Voicemail callback error:', error);
    return {
      statusCode: 500,
      headers,
      body: '<Response><Say>Error processing voicemail.</Say></Response>'
    };
  }
};
