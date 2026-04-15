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
      staffId,
      staffData 
    } = JSON.parse(event.body);

    if (!type || !businessId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Verify user has access to this business
    const hasAccess = await checkUserBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' })
      };
    }

    let result;

    switch (type) {
      case 'get-staff':
        result = await getStaffList(businessId);
        break;

      case 'add-staff':
        result = await addStaffMember(businessId, staffData, userId);
        break;

      case 'update-staff':
        result = await updateStaffMember(businessId, staffId, staffData, userId);
        break;

      case 'delete-staff':
        result = await deleteStaffMember(businessId, staffId, userId);
        break;

      case 'get-staff-availability':
        result = await getStaffAvailability(businessId, staffId);
        break;

      case 'update-staff-availability':
        result = await updateStaffAvailability(businessId, staffId, staffData, userId);
        break;

      case 'get-staff-performance':
        result = await getStaffPerformance(businessId, staffId);
        break;

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid operation type' })
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Staff management error:', error);
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

async function getStaffList(businessId) {
  try {
    const { data: staff, error } = await supabase
      .from('staff')
      .select(`
        *,
        availability!inner(
          day_of_week,
          start_time,
          end_time,
          is_available
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Get performance metrics for each staff member
    const staffWithPerformance = await Promise.all(
      staff.map(async (member) => {
        const performance = await getStaffPerformanceMetrics(businessId, member.id);
        return {
          ...member,
          performance
        };
      })
    );

    return {
      message: 'Staff list retrieved successfully',
      staff: staffWithPerformance
    };
  } catch (error) {
    console.error('Get staff list error:', error);
    throw error;
  }
}

async function addStaffMember(businessId, staffData, userId) {
  try {
    // Validate required fields
    if (!staffData.name || !staffData.email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name and email are required' })
      };
    }

    // Check if email already exists
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('business_id', businessId)
      .eq('email', staffData.email)
      .single();

    if (existingStaff) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Staff member with this email already exists' })
      };
    }

    // Create new staff member
    const { data: newStaff, error } = await supabase
      .from('staff')
      .insert([
        {
          business_id: businessId,
          name: staffData.name,
          email: staffData.email,
          phone: staffData.phone || null,
          role: staffData.role || 'staff',
          bio: staffData.bio || null,
          avatar_url: staffData.avatar_url || null,
          hire_date: staffData.hire_date || new Date().toISOString(),
          status: 'active',
          created_at: new Date().toISOString(),
          created_by: userId
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Send welcome email to new staff member
    await sendStaffWelcomeEmail(newStaff, businessId);

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'staff_added', {
      staff: newStaff,
      addedBy: userId,
      timestamp: new Date().toISOString()
    });

    return {
      message: 'Staff member added successfully',
      staff: newStaff
    };
  } catch (error) {
    console.error('Add staff member error:', error);
    throw error;
  }
}

async function updateStaffMember(businessId, staffId, staffData, userId) {
  try {
    // Update staff member
    const { data: updatedStaff, error } = await supabase
      .from('staff')
      .update({
        ...staffData,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', staffId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'staff_updated', {
      staffId,
      staff: updatedStaff,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    return {
      message: 'Staff member updated successfully',
      staff: updatedStaff
    };
  } catch (error) {
    console.error('Update staff member error:', error);
    throw error;
  }
}

async function deleteStaffMember(businessId, staffId, userId) {
  try {
    // Get staff member details before deletion
    const { data: staffToDelete, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .eq('business_id', businessId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete staff member
    const { error: deleteError } = await supabase
      .from('staff')
      .update({
        status: 'inactive',
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', staffId)
      .eq('business_id', businessId);

    if (deleteError) {
      throw deleteError;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'staff_removed', {
      staff: staffToDelete,
      deletedBy: userId,
      timestamp: new Date().toISOString()
    });

    return {
      message: 'Staff member deleted successfully',
      staff: staffToDelete
    };
  } catch (error) {
    console.error('Delete staff member error:', error);
    throw error;
  }
}

async function getStaffAvailability(businessId, staffId) {
  try {
    const { data: availability, error } = await supabase
      .from('availability')
      .select('*')
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw error;
    }

    return {
      message: 'Staff availability retrieved successfully',
      availability
    };
  } catch (error) {
    console.error('Get staff availability error:', error);
    throw error;
  }
}

async function updateStaffAvailability(businessId, staffId, availabilityData, userId) {
  try {
    const { error } = await supabase
      .from('availability')
      .upsert({
        business_id: businessId,
        staff_id: staffId,
        ...availabilityData,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trigger real-time notification
    await triggerRealtimeNotification(businessId, 'availability_updated', {
      staffId,
      availability: availabilityData,
      updatedBy: userId,
      timestamp: new Date().toISOString()
    });

    return {
      message: 'Staff availability updated successfully',
      availability: availabilityData
    };
  } catch (error) {
    console.error('Update staff availability error:', error);
    throw error;
  }
}

async function getStaffPerformance(businessId, staffId) {
  try {
    // Get performance metrics for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .gte('booking_date', thirtyDaysAgo)
      .order('booking_date', { ascending: false });

    if (bookingsError) {
      throw bookingsError;
    }

    // Calculate performance metrics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const totalRevenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_paid || 0), 0);

    // Calculate average rating (placeholder for future rating system)
    const averageRating = 4.5; // This would come from a ratings table

    const performance = {
      total_bookings: totalBookings,
      completed_bookings: completedBookings,
      cancelled_bookings: cancelledBookings,
      completion_rate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0,
      total_revenue: totalRevenue,
      average_rating: averageRating,
      period: '30_days'
    };

    return {
      message: 'Staff performance retrieved successfully',
      performance
    };
  } catch (error) {
    console.error('Get staff performance error:', error);
    throw error;
  }
}

async function getStaffPerformanceMetrics(businessId, staffId) {
  try {
    // This would be expanded to include more detailed metrics
    // For now, return basic performance data
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('status, total_paid')
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .gte('booking_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw error;
    }

    return {
      bookings,
      total_bookings: bookings.length,
      completed_bookings: bookings.filter(b => b.status === 'completed').length,
      total_revenue: bookings.reduce((sum, b) => sum + (b.total_paid || 0), 0)
    };
  } catch (error) {
    console.error('Get staff performance metrics error:', error);
    throw error;
  }
}

async function sendStaffWelcomeEmail(staff, businessId) {
  try {
    // Get business details for email
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('name, email')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Failed to get business details for welcome email');
      return;
    }

    console.log(`Sending welcome email to staff member: ${staff.email}`);
    
    // In real implementation, you'd call your Resend function here
    // For now, we'll just log the content
    const emailContent = `
      Subject: Welcome to ${business.name} Team!
      
      Hi ${staff.name},
      
      Welcome to the ${business.name} team! Your account has been created successfully.
      
      You can now:
      - View your schedule and availability
      - Manage your bookings
      - Update your profile information
      - Access team communication tools
      
      Login to your dashboard at: https://showupmedia.org/crm
      
      If you have any questions, please contact your manager.
      
      Best regards,
      The ${business.name} Team
    `;
    
    console.log('Staff welcome email content:', emailContent);
    
    return true;
  } catch (error) {
    console.error('Send staff welcome email error:', error);
    return false;
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
