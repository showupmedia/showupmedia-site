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
      type, 
      businessId, 
      userId,
      bookingId,
      data 
    } = JSON.parse(event.body);

    if (!type || !businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Verify user has access to this business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Business not found' })
      };
    }

    // Check user permissions
    const hasAccess = await checkUserBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    let result;

    switch (type) {
      case 'subscribe':
        result = await subscribeToBusinessUpdates(businessId, userId);
        break;

      case 'unsubscribe':
        result = await unsubscribeFromBusinessUpdates(businessId, userId);
        break;

      case 'booking-update':
        result = await handleBookingUpdate(businessId, bookingId, data, userId);
        break;

      case 'availability-update':
        result = await handleAvailabilityUpdate(businessId, data, userId);
        break;

      case 'staff-update':
        result = await handleStaffUpdate(businessId, data, userId);
        break;

      case 'service-update':
        result = await handleServiceUpdate(businessId, data, userId);
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid update type' })
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Realtime update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function checkUserBusinessAccess(userId, businessId) {
  try {
    // Check if user is business owner or staff
    const { data: ownerCheck } = await supabase
      .from('business_settings')
      .select('setting_value')
      .eq('business_id', businessId)
      .eq('setting_key', 'owner_uid')
      .eq('setting_value', userId)
      .single();

    const { data: staffCheck } = await supabase
      .from('staff')
      .select('id')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single();

    return !!(ownerCheck.error && staffCheck.error);
  } catch (error) {
    console.error('Access check error:', error);
    return false;
  }
}

async function subscribeToBusinessUpdates(businessId, userId) {
  try {
    // Create subscription record for real-time updates
    const { data, error } = await supabase
      .from('realtime_subscriptions')
      .insert([
        {
          business_id: businessId,
          user_id: userId,
          subscription_type: 'business_updates',
          created_at: new Date().toISOString(),
          status: 'active'
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Subscribe to Supabase Realtime channels
    const channel = `business_${businessId}`;
    
    console.log(`User ${userId} subscribed to ${channel}`);

    return {
      message: 'Successfully subscribed to business updates',
      channel,
      subscriptionId: data.id
    };
  } catch (error) {
    console.error('Subscription error:', error);
    throw error;
  }
}

async function unsubscribeFromBusinessUpdates(businessId, userId) {
  try {
    // Remove subscription record
    const { error } = await supabase
      .from('realtime_subscriptions')
      .update({ status: 'inactive', unsubscribed_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('subscription_type', 'business_updates');

    if (error) {
      throw error;
    }

    console.log(`User ${userId} unsubscribed from business_${businessId}`);

    return {
      message: 'Successfully unsubscribed from business updates'
    };
  } catch (error) {
    console.error('Unsubscription error:', error);
    throw error;
  }
}

async function handleBookingUpdate(businessId, bookingId, data, userId) {
  try {
    // Update booking record
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'booking_updated', {
      bookingId,
      booking,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    console.log(`Booking ${bookingId} updated in business ${businessId}`);

    return {
      message: 'Booking updated successfully',
      booking
    };
  } catch (error) {
    console.error('Booking update error:', error);
    throw error;
  }
}

async function handleAvailabilityUpdate(businessId, data, userId) {
  try {
    // Update availability record
    const { error } = await supabase
      .from('availability')
      .upsert({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'availability_updated', {
      businessId,
      availability: data,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    console.log(`Availability updated in business ${businessId}`);

    return {
      message: 'Availability updated successfully',
      availability: data
    };
  } catch (error) {
    console.error('Availability update error:', error);
    throw error;
  }
}

async function handleStaffUpdate(businessId, data, userId) {
  try {
    // Update staff record
    const { error } = await supabase
      .from('staff')
      .upsert({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'staff_updated', {
      businessId,
      staff: data,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    console.log(`Staff updated in business ${businessId}`);

    return {
      message: 'Staff updated successfully',
      staff: data
    };
  } catch (error) {
    console.error('Staff update error:', error);
    throw error;
  }
}

async function handleServiceUpdate(businessId, data, userId) {
  try {
    // Update service record
    const { error } = await supabase
      .from('services')
      .upsert({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'service_updated', {
      businessId,
      service: data,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    console.log(`Service updated in business ${businessId}`);

    return {
      message: 'Service updated successfully',
      service: data
    };
  } catch (error) {
    console.error('Service update error:', error);
    throw error;
  }
}

async function triggerRealtimeNotification(businessId, eventType, payload) {
  try {
    // Store notification in database for history
    await supabase
      .from('realtime_notifications')
      .insert([
        {
          business_id: businessId,
          event_type: eventType,
          payload: JSON.stringify(payload),
          created_at: new Date().toISOString()
        }
      ]);

    console.log(`Real-time notification triggered: ${eventType} for business ${businessId}`);

    return true;
  } catch (error) {
    console.error('Real-time notification error:', error);
    return false;
  }
}
