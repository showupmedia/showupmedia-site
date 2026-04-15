const fetch = require('node-fetch');

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
    const { to, subject, html, fromEmail, fromName } = JSON.parse(event.body);

    if (!to || !subject || !html) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: to, subject, html' })
      };
    }

    const fromAddress = fromEmail && fromName
      ? `${fromName} <${fromEmail}>`
      : process.env.RESEND_FROM_EMAIL;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify(data) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    console.error('Email send error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to send email', message: error.message })
    };
  }
};
