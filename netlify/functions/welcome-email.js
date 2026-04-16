const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { businessId, plan, email } = JSON.parse(event.body);

    if (!businessId || !plan || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get business details
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    // Send welcome email
    await sendWelcomeEmail(business, plan);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Welcome email sent successfully',
        business: business
      })
    };

  } catch (error) {
    console.error('Welcome email error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendWelcomeEmail(business, plan) {
  try {
    // Call the real email service
    const response = await fetch(`${process.env.URL}/.netlify/functions/email-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NETLIFY_DEV_TOKEN || ''}`
      },
      body: JSON.stringify({
        to: business.email,
        subject: `Welcome to Show Up Media - Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan is Active!`,
        html: generateWelcomeEmail(business, plan)
      })
    });

    if (!response.ok) {
      throw new Error('Email service failed');
    }

    const result = await response.json();
    console.log(`Welcome email sent successfully to ${business.email}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}

function generateWelcomeEmail(business, plan) {
  const planFeatures = {
    basic: {
      name: 'Basic Plan',
      price: '£6.99/month',
      features: [
        'Online booking system',
        'Customer management',
        'Basic analytics',
        'Email support'
      ]
    },
    pro: {
      name: 'Pro Plan', 
      price: '£9.99/month',
      features: [
        'Everything in Basic',
        'Staff management',
        'Advanced analytics',
        'Priority support',
        'Custom branding'
      ]
    },
    premium: {
      name: 'Premium Plan',
      price: '£14.99/month',
      features: [
        'Everything in Pro',
        'Online payment processing',
        'Bank transfer payouts',
        'Dedicated account manager',
        '24/7 phone support',
        'Custom domain support'
      ]
    }
  };

  const features = planFeatures[plan] || planFeatures.basic;
  const loginUrl = `https://showupmedia.org/crm?business=${business.id}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Show Up Media - Your Booking System is Ready!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 18px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .plan-info { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6; }
        .plan-name { font-size: 20px; font-weight: bold; color: #3b82f6; margin-bottom: 15px; }
        .plan-price { font-size: 24px; font-weight: bold; color: #10b981; margin-bottom: 15px; }
        .features { margin-bottom: 20px; }
        .feature { display: flex; align-items: center; margin-bottom: 10px; }
        .feature-icon { color: #10b981; margin-right: 10px; }
        .cta { background: #2563eb; color: white; padding: 20px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: inline-block; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎉 Show Up Media</div>
          <div class="title">Your Booking System is Ready!</div>
        </div>

        <div class="content">
          <p>Hi <strong>${business.name}</strong>,</p>
          <p>Congratulations! Your booking system is now live and ready to accept customers.</p>
          <p>You've successfully subscribed to our <strong>${features.name}</strong>.</p>

          <div class="plan-info">
            <div class="plan-name">${features.name}</div>
            <div class="plan-price">${features.price}</div>
            
            <div class="features">
              <h3>What's Included:</h3>
              ${features.features.map(feature => `
                <div class="feature">
                  <span class="feature-icon">✓</span>
                  <span>${feature}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <h3>🚀 Get Started Now:</h3>
          <p>Your admin dashboard is ready. Here's what to do next:</p>
          
          <ol>
            <li><strong>Access Your Dashboard:</strong> <a href="${loginUrl}" style="color: #2563eb;">Login to your CRM</a> to manage your business</li>
            <li><strong>Add Your Services:</strong> Create the services you offer (haircuts, consultations, etc.)</li>
            <li><strong>Set Your Availability:</strong> Configure your business hours and when you're available</li>
            <li><strong>Add Staff Members:</strong> Invite team members who can take bookings</li>
            <li><strong>Customize Your Brand:</strong> Update colors, logo, and business information</li>
          </ol>

          ${plan === 'premium' ? `
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px;">
              <h3 style="color: #d97706;">💳 Premium Payment Setup</h3>
              <p>As a Premium member, you can accept online payments directly from customers.</p>
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Go to CRM → Settings → Payment Configuration</li>
                <li>Add your bank details for payouts</li>
                <li>Enable online payments for your services</li>
              </ol>
            </div>
          ` : ''}

          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3>📞 Need Help?</h3>
            <p>Our support team is here to help you get started:</p>
            <ul>
              <li>📧 Email: <a href="mailto:support@showupmedia.org" style="color: #2563eb;">support@showupmedia.org</a></li>
              <li>📱 Phone: Available for Premium members</li>
              <li>📚 Knowledge Base: <a href="https://showupmedia.org/help" style="color: #2563eb;">showupmedia.org/help</a></li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for choosing Show Up Media for your booking system needs.</p>
          <p>© 2024 Show Up Media. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
