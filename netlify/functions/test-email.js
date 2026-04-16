exports.handler = async (event, context) => {
  try {
    // Test email service
    const response = await fetch(`${process.env.URL}/.netlify/functions/email-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NETLIFY_DEV_TOKEN || ''}`
      },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Test Email - Show Up Media',
        html: `
          <h1>Test Email Successful</h1>
          <p>This is a test email from Show Up Media booking system.</p>
          <p>If you received this, the email service is working correctly.</p>
          <p>Sent: ${new Date().toLocaleString()}</p>
        `
      })
    });

    const result = await response.json();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Test email sent successfully',
        result: result,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Test email error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to send test email',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
