const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { to, subject, html, from } = JSON.parse(event.body);

    if (!to || !subject || !html) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: to, subject, html' })
      };
    }

    const { data, error } = await resend.emails.send({
      from: from || 'Show Up Media <noreply@showupmedia.org>',
      to: to,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Email send error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send email' })
      };
    }

    console.log(`Email sent successfully to ${to}: ${subject}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Email sent successfully',
        id: data.id
      })
    };

  } catch (error) {
    console.error('Email service error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
