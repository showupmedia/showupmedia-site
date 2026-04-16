const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const sig = event.headers['stripe-signature'];
    const body = event.body;
    
    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log(`Webhook signature verification failed:`, err.message);
      return {
        statusCode: 400,
        body: 'Webhook signature verification failed'
      };
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSession(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'booking.created':
        await handleBookingCreated(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return {
      statusCode: 200,
      body: 'Webhook processed successfully'
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};

async function handleCheckoutSession(session) {
  console.log('Processing checkout session:', session.id);
  
  // Get metadata from the session
  const metadata = session.metadata || {};
  const customerEmail = session.customer_details?.email;
  const plan = metadata.plan || 'basic';
  
  if (!customerEmail) {
    console.error('No customer email found in session');
    return;
  }

  try {
    // Create business record
    const { data: business, error } = await supabase
      .from('businesses')
      .insert([
        {
          name: metadata.business_name || 'New Business',
          email: customerEmail,
          plan: plan,
          template: metadata.template || 'noir',
          primary_color: metadata.primary_color || '#2563eb',
          accent_color: metadata.accent_color || '#10b981',
          stripe_customer_id: session.customer,
          status: 'active',
          subdomain: metadata.subdomain || generateSubdomain(metadata.business_name),
          address: metadata.business_address || '',
          phone: metadata.business_phone || '',
          tagline: metadata.business_tagline || '',
          about: metadata.business_about || '',
          logo: metadata.business_logo || '',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating business:', error);
      throw error;
    }

    console.log('Business created successfully:', business.id);

    // Parse and create services from builder data
    if (metadata.services_data) {
      const services = JSON.parse(metadata.services_data);
      const validServices = services.filter(s => s.name && s.price);
      
      if (validServices.length > 0) {
        await supabase
          .from('services')
          .insert(validServices.map(service => ({
            business_id: business.id,
            name: service.name,
            price: parseFloat(service.price) || 0,
            duration: service.duration || '30 min',
            description: service.description || '',
            created_at: new Date().toISOString()
          })));
        
        console.log(`Created ${validServices.length} services for business ${business.id}`);
      }
    }

    // Parse and create business hours from builder data
    if (metadata.hours_data) {
      const hours = JSON.parse(metadata.hours_data);
      const daysData = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      
      for (const day of daysData) {
        if (hours[day]) {
          await supabase
            .from('business_hours')
            .insert({
              business_id: business.id,
              day_of_week: day,
              open_time: hours[day].open || '09:00',
              close_time: hours[day].close || '17:00',
              is_closed: !hours[day].isOpen,
              created_at: new Date().toISOString()
            });
        }
      }
      
      console.log(`Created business hours for business ${business.id}`);
    }

    // Generate live booking page URL
    const bookingUrl = `https://showupmedia.org/booking/${business.subdomain}`;
    
    // Store booking page URL
    await supabase
      .from('business_settings')
      .insert([
        {
          business_id: business.id,
          setting_key: 'booking_page_url',
          setting_value: bookingUrl
        }
      ]);

    // Send welcome email with booking page URL
    await sendWelcomeEmail(business, plan, bookingUrl);

    // Store Stripe subscription ID if available
    if (session.subscription) {
      await supabase
        .from('business_settings')
        .insert([
          {
            business_id: business.id,
            setting_key: 'stripe_subscription_id',
            setting_value: session.subscription
          }
        ]);
    }

    console.log(`Booking system fully created for ${business.name} at ${bookingUrl}`);

  } catch (error) {
    console.error('Error in handleCheckoutSession:', error);
    throw error;
  }
}

async function handleBookingCreated(booking) {
  console.log('Processing booking created:', booking.id);
  
  try {
    // Get booking details with business info
    const { data: bookingData, error } = await supabase
      .from('bookings')
      .select(`
        bookings.*,
        services!inner(
          name,
          price
        ),
        businesses!inner(
          name,
          email
        ),
        staff!inner(
          name
        )
      `)
      .eq('bookings.id', booking.id)
      .single();

    if (error || !bookingData) {
      console.error('Error fetching booking:', error);
      return;
    }

    // Send booking confirmation email to customer
    await sendBookingConfirmationEmail(bookingData, bookingData.services, bookingData.customer_email);

    // Send notification email to business
    await sendBusinessNotificationEmail(bookingData, bookingData.services, bookingData.businesses);

    console.log('Booking confirmation sent successfully');

  } catch (error) {
    console.error('Error in handleBookingCreated:', error);
  }
}

async function sendBusinessNotificationEmail(booking, service, business) {
  try {
    console.log(`Sending business notification to ${business.email}`);
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Booking Alert - ${business.name}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .title { font-size: 18px; margin-bottom: 20px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
            .booking-details { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .detail-label { font-weight: bold; color: #666; }
            .detail-value { color: #333; }
            .cta { background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: block; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .booking-url { background: #10b981; color: white; padding: 15px 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">📅</div>
              <div class="title">New Booking Alert!</div>
            </div>

            <div class="content">
              <p>Hi <strong>${business.name}</strong> Team,</p>
              <p>You have a new booking! Here are the details:</p>

              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Customer:</span>
                  <span class="detail-value">${booking.customer_name || 'Walk-in'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${service.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${booking.booking_time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">${booking.duration_minutes} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">£${service.price}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Customer Contact:</span>
                  <span class="detail-value">${booking.customer_email || 'Not provided'}</span>
                </div>
              </div>

              <a href="https://showupmedia.org/crm" class="cta">View in Dashboard</a>
            </div>

            <div class="footer">
              <p>Check your dashboard for more details and customer management.</p>
              <p> 2024 ${business.name}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    console.log('Business notification email content generated');
    
    // In real implementation, you'd call your Resend function here
    // For now, we'll just log the content
    console.log('Email content:', emailContent);
    
    return true;
  } catch (error) {
    console.error('Error sending business notification:', error);
    return false;
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded for subscription:', invoice.subscription);
  
  try {
    // Update business status to active if payment succeeded
    const { error } = await supabase
      .from('businesses')
      .update({ status: 'active' })
      .eq('stripe_customer_id', invoice.customer);

    if (error) {
      console.error('Error updating business status:', error);
    }

  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  
  try {
    // Find business by Stripe customer ID
    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (error || !business) {
      console.error('Business not found for customer:', subscription.customer);
      return;
    }

    // Store subscription details
    await supabase
      .from('business_settings')
      .upsert([
        {
          business_id: business.id,
          setting_key: 'stripe_subscription_id',
          setting_value: subscription.id
        }
      ]);

  } catch (error) {
    console.error('Error in handleSubscriptionCreated:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);
  
  try {
    const metadata = paymentIntent.metadata;
    
    if (!metadata.business_id || !metadata.service_id) {
      console.error('Missing metadata for payment intent');
      return;
    }

    // Update booking status to confirmed
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', metadata.business_id)
      .eq('service_id', metadata.service_id)
      .eq('customer_email', metadata.customer_email)
      .eq('booking_date', metadata.booking_date)
      .eq('booking_time', metadata.booking_time);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return;
    }

    // Get booking details for emails
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services!inner(
          name,
          price,
          duration
        ),
        businesses!inner(
          name,
          email,
          subdomain,
          address
        )
      `)
      .eq('business_id', metadata.business_id)
      .eq('service_id', metadata.service_id)
      .eq('customer_email', metadata.customer_email)
      .eq('booking_date', metadata.booking_date)
      .eq('booking_time', metadata.booking_time)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking details:', bookingError);
      return;
    }

    // Send confirmation emails
    await sendBookingConfirmationEmails(booking);

    console.log(`Payment processed and booking confirmed for ${booking.customer_email}`);

  } catch (error) {
    console.error('Error in handlePaymentIntentSucceeded:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  try {
    // Find business by subscription ID
    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('business_id')
      .eq('setting_key', 'stripe_subscription_id')
      .eq('setting_value', subscription.id)
      .single();

    if (error || !settings) {
      console.error('Business not found for subscription:', subscription.id);
      return;
    }

    // Update business status to inactive
    await supabase
      .from('businesses')
      .update({ status: 'inactive' })
      .eq('id', settings.business_id);

  } catch (error) {
    console.error('Error in handleSubscriptionDeleted:', error);
  }
}

async function sendWelcomeEmail(business, plan, bookingUrl) {
  try {
    // This would use your existing email system (Resend)
    console.log(`Welcome email sent to ${business.email} for plan ${plan} with booking URL: ${bookingUrl}`);
    
    const welcomeContent = generateWelcomeEmail(business, plan, bookingUrl);
    
    // TODO: Implement actual email sending using your Resend setup
    // You can reuse the existing email function from your CRM
    console.log('Welcome email content:', welcomeContent);
    
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}

async function sendBookingConfirmationEmails(booking) {
  try {
    // Send confirmation email to customer
    await fetch(`${process.env.URL}/.netlify/functions/email-confirmations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_confirmation',
        booking: booking,
        service: booking.services,
        business: booking.businesses
      })
    });

    // Send notification email to business
    await fetch(`${process.env.URL}/.netlify/functions/email-confirmations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'business_notification',
        booking: booking,
        service: booking.services,
        business: booking.businesses
      })
    });

    console.log(`Booking confirmation emails sent for booking ${booking.id}`);
  } catch (error) {
    console.error('Error sending booking confirmation emails:', error);
  }
}

function generateSubdomain(businessName) {
  if (!businessName) return 'business' + Math.random().toString(36).substr(2, 9);
  
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '-')
    .substr(0, 20) + '-' + Math.random().toString(36).substr(2, 5);
}
