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
    const { type, bookingId, businessId, customerEmail } = JSON.parse(event.body);

    if (!type || !bookingId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get booking details with business info
    const { data: booking, error } = await supabase
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
      .eq('bookings.id', bookingId)
      .single();

    if (error || !booking) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    let emailContent, subject, recipient;

    switch (type) {
      case 'booking-confirmation':
        emailContent = generateBookingConfirmationEmail(booking);
        subject = `Booking Confirmation - ${booking.services.name}`;
        recipient = customerEmail;
        break;

      case 'booking-reminder-24h':
        emailContent = generateBookingReminderEmail(booking, '24h');
        subject = `Reminder: ${booking.services.name} tomorrow`;
        recipient = customerEmail;
        break;

      case 'booking-reminder-1h':
        emailContent = generateBookingReminderEmail(booking, '1h');
        subject = `Reminder: ${booking.services.name} in 1 hour`;
        recipient = customerEmail;
        break;

      case 'business-booking-notification':
        emailContent = generateBusinessNotificationEmail(booking);
        subject = `New Booking: ${booking.services.name}`;
        recipient = booking.businesses.email;
        break;

      case 'booking-cancellation':
        emailContent = generateBookingCancellationEmail(booking);
        subject = `Booking Cancelled: ${booking.services.name}`;
        recipient = [customerEmail, booking.businesses.email];
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid email type' })
        };
    }

    // Send email
    const emailSent = await sendEmail(recipient, subject, emailContent);

    if (EmailSent) {
      // Log email sent for tracking
      await supabase
        .from('booking_notifications')
        .insert([
          {
            booking_id: bookingId,
            type: type,
            sent_at: new Date().toISOString(),
            recipient: recipient
          }
        ]);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Email sent successfully',
          type: type,
          booking: bookingId
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send email' })
      };
    }

  } catch (error) {
    console.error('Email confirmation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendEmail(to, subject, html) {
  try {
    // Call the real email service
    const response = await fetch(`${process.env.URL}/.netlify/functions/email-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NETLIFY_DEV_TOKEN || ''}`
      },
      body: JSON.stringify({
        to: to,
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      throw new Error('Email service failed');
    }

    const result = await response.json();
    console.log(`Email sent successfully to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

function generateBookingConfirmationEmail(booking) {
  const bookingDate = new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString();
  const endTime = new Date(booking.booking_date + 'T' + booking.booking_time);
  endTime.setMinutes(endTime.getMinutes() + booking.duration_minutes);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - ${booking.services.name}</title>
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🎉 ${booking.businesses.name}</div>
          <div class="title">Booking Confirmed!</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.customer_name || 'Valued Customer'}</strong>,</p>
          <p>Your booking has been confirmed! Here are the details:</p>

          <div class="booking-details">
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${bookingDate}</span>
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
              <span class="detail-label">Staff:</span>
              <span class="detail-value">${booking.staff?.name || 'Available'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Price:</span>
              <span class="detail-value">£${booking.services.price}</span>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px;">
            <h3 style="color: #d97706;">📍 Location Information</h3>
            <p><strong>Address:</strong> ${booking.businesses.name}</p>
            <p><strong>Phone:</strong> ${booking.businesses.phone || 'Contact for details'}</p>
          </div>

          <a href="#" class="cta">Add to Calendar</a>
        </div>

        <div class="footer">
          <p>Need to make changes? Contact us at least 24 hours before your appointment.</p>
          <p>© 2024 ${booking.businesses.name}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateBookingReminderEmail(booking, reminderType) {
  const bookingDate = new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString();
  const reminderText = reminderType === '24h' ? 'tomorrow' : 'in 1 hour';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Reminder - ${booking.services.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #fbbf24; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .reminder { font-size: 48px; margin-bottom: 10px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
        .booking-info { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .cta { background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: block; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="reminder">⏰</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.customer_name || 'Valued Customer'}</strong>,</p>
          <p>This is a friendly reminder that you have an appointment <strong>${reminderText}</strong>:</p>

          <div class="booking-info">
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${bookingDate}</span>
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
              <span class="detail-value">£${booking.services.price}</span>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px;">
            <h3 style="color: #d97706;">📍 Location</h3>
            <p><strong>${booking.businesses.name}</strong></p>
            <p>${booking.businesses.phone || 'Contact for address'}</p>
          </div>

          <a href="#" class="cta">View Booking Details</a>
        </div>

        <div class="footer">
          <p>Looking forward to seeing you!</p>
          <p>© 2024 ${booking.businesses.name}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateBusinessNotificationEmail(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Booking - ${booking.services.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 18px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .booking-details { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .new-booking { background: #dcfce7; color: #065f46; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .cta { background: #2563eb; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; text-decoration: none; display: block; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📅</div>
          <div class="title">New Booking Alert!</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.businesses.name}</strong> Team,</p>
          <p>You have a new booking! Here are the details:</p>

          <div class="booking-details">
            <div class="new-booking">🆕 NEW BOOKING</div>
            <div class="detail-row">
              <span class="detail-label">Customer:</span>
              <span class="detail-value">${booking.customer_name || 'Walk-in'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
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
              <span class="detail-value">£${booking.services.price}</span>
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
          <p>© 2024 Show Up Media. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateBookingCancellationEmail(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancelled - ${booking.services.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 18px; margin-bottom: 20px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .cancelled-info { background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .detail-value { color: #333; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">❌</div>
          <div class="title">Booking Cancelled</div>
        </div>

        <div class="content">
          <p>Hi <strong>${booking.customer_name || 'Valued Customer'}</strong>,</p>
          <p>Your booking for <strong>${booking.services.name}</strong> has been cancelled.</p>

          <div class="cancelled-info">
            <h3>Cancelled Booking Details:</h3>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${booking.services.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${booking.booking_time}</span>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px;">
            <h3 style="color: #d97706;">💡 What's Next?</h3>
            <p>We're sorry to see your booking cancelled. Would you like to:</p>
            <ul>
              <li>📅 Book a new appointment</li>
              <li>💬 Contact us with questions</li>
              <li>📞 Check our other services</li>
            </ul>
          </div>

          <a href="https://showupmedia.org/booking" class="cta">Book New Appointment</a>
        </div>

        <div class="footer">
          <p>Hope to see you again soon!</p>
          <p>© 2024 ${booking.businesses.name}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
