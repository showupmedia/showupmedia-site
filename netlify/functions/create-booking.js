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
    const { 
      serviceId, 
      businessId, 
      staffId, 
      customerName, 
      customerEmail, 
      customerPhone,
      bookingDate,
      bookingTime,
      durationMinutes,
      notes
    } = JSON.parse(event.body);

    // Validate required fields
    if (!serviceId || !businessId || !customerName || !bookingDate || !bookingTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .single();

    if (serviceError || !service) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Service not found' })
      };
    }

    // Validate staff availability (if staff specified)
    let staffAvailable = true;
    if (staffId) {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .eq('business_id', businessId)
        .single();

      if (staffError || !staff) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Staff member not found' })
        };
      }

      // Check staff availability for the booking date/time
      const dayOfWeek = new Date(bookingDate).getDay(); // 0 = Sunday, 6 = Saturday
      const { data: availability, error: availabilityError } = await supabase
        .from('availability')
        .select('*')
        .eq('staff_id', staffId)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (!availabilityError && availability) {
        const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
        const startTime = new Date();
        startTime.setHours(bookingDateTime.getHours());
        startTime.setMinutes(bookingDateTime.getMinutes());
        
        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + durationMinutes);

        // Check if booking time is within available hours
        const isWithinHours = (
          bookingDateTime.getHours() >= availability.start_time.getHours() &&
          bookingDateTime.getHours() < availability.end_time.getHours()
        );

        staffAvailable = isWithinHours;
      }
    }

    if (!staffAvailable) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Staff member not available at requested time' })
      };
    }

    // Create booking
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const endTime = new Date(bookingDateTime);
    endTime.setMinutes(bookingDateTime.getMinutes() + durationMinutes);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          business_id: businessId,
          service_id: serviceId,
          staff_id: staffId || null,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          booking_date: bookingDate,
          booking_time: bookingTime,
          duration_minutes: durationMinutes,
          service_price: service.price,
          total_paid: service.price, // Will be updated by payment system
          payment_method: 'cash', // Default, can be updated by payment system
          status: 'confirmed',
          notes: notes || null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (bookingError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create booking' })
      };
    }

    // Trigger email confirmation
    await sendBookingConfirmationEmail(booking, service, customerEmail);

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        message: 'Booking created successfully',
        booking: booking
      })
    };

  } catch (error) {
    console.error('Booking creation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendBookingConfirmationEmail(booking, service, customerEmail) {
  try {
    console.log(`Sending booking confirmation to ${customerEmail}`);
    
    const bookingDate = new Date(booking.booking_date + 'T' + booking.booking_time).toLocaleDateString();
    const endTime = new Date(booking.booking_date + 'T' + booking.booking_time);
    endTime.setMinutes(endTime.getMinutes() + booking.duration_minutes);

    const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation - ${service.name}</title>
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
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎉 ${booking.businesses?.name || 'Show Up Media'}</div>
              <div class="title">Booking Confirmed!</div>
            </div>

            <div class="content">
              <p>Hi <strong>${booking.customer_name}</strong>,</p>
              <p>Your booking has been confirmed! Here are the details:</p>

              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${service.name}</span>
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
                  <span class="detail-label">End Time:</span>
                  <span class="detail-value">${endTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">£${service.price}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${booking.businesses?.name || 'Show Up Media'}</span>
                </div>
              </div>

              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin-top: 20px;">
                <h3 style="color: #d97706;">📅 What's Next?</h3>
                <p>Please arrive 5 minutes early for your appointment.</p>
                <p>Need to make changes? Contact us at least 24 hours before your appointment.</p>
                <p>We look forward to seeing you!</p>
              </div>
            </div>

            <div class="footer">
              <p>© 2024 ${booking.businesses?.name || 'Show Up Media'}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    console.log('Booking confirmation email content generated');
    
    // In real implementation, you'd call your Resend function here
    // For now, we'll just log the content
    console.log('Email content:', emailContent);
    
    return true;
  } catch (error) {
    console.error('Error sending booking confirmation:', error);
    return false;
  }
}
