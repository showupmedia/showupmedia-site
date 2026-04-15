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
      startDate,
      endDate,
      period
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
      case 'revenue-overview':
        result = await getRevenueOverview(businessId, startDate, endDate);
        break;

      case 'revenue-trends':
        result = await getRevenueTrends(businessId, period);
        break;

      case 'service-performance':
        result = await getServicePerformance(businessId, startDate, endDate);
        break;

      case 'staff-performance':
        result = await getStaffRevenuePerformance(businessId, startDate, endDate);
        break;

      case 'customer-analytics':
        result = await getCustomerAnalytics(businessId, startDate, endDate);
        break;

      case 'booking-analytics':
        result = await getBookingAnalytics(businessId, startDate, endDate);
        break;

      case 'financial-summary':
        result = await getFinancialSummary(businessId, startDate, endDate);
        break;

      case 'revenue-forecast':
        result = await getRevenueForecast(businessId);
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
    console.error('Revenue analytics error:', error);
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

async function getRevenueOverview(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // Get total revenue
    const { data: revenueData, error: revenueError } = await supabase
      .from('bookings')
      .select('total_paid, service_price')
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0])
      .eq('status', 'completed');

    if (revenueError) {
      throw revenueError;
    }

    const totalRevenue = revenueData.reduce((sum, booking) => sum + (booking.total_paid || booking.service_price || 0), 0);

    // Get previous period for comparison
    const previousStart = new Date(start).getTime() - (new Date(end).getTime() - new Date(start).getTime());
    const previousEnd = start;

    const { data: previousRevenueData, error: previousError } = await supabase
      .from('bookings')
      .select('total_paid, service_price')
      .eq('business_id', businessId)
      .gte('booking_date', new Date(previousStart).toISOString().split('T')[0])
      .lte('booking_date', previousEnd.split('T')[0])
      .eq('status', 'completed');

    const previousRevenue = previousRevenueData ? 
      previousRevenueData.reduce((sum, booking) => sum + (booking.total_paid || booking.service_price || 0), 0) : 0;

    const revenueGrowth = previousRevenue > 0 ? 
      ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1) : 0;

    // Get booking metrics
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('status, total_paid, service_price')
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0]);

    const totalBookings = bookingsData.length;
    const completedBookings = bookingsData.filter(b => b.status === 'completed').length;
    const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled').length;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0;

    // Calculate average booking value
    const averageBookingValue = completedBookings > 0 ? 
      (totalRevenue / completedBookings).toFixed(2) : 0;

    return {
      message: 'Revenue overview retrieved successfully',
      overview: {
        totalRevenue,
        revenueGrowth: parseFloat(revenueGrowth),
        totalBookings,
        completedBookings,
        cancelledBookings,
        completionRate: parseFloat(completionRate),
        averageBookingValue: parseFloat(averageBookingValue),
        period: {
          start: start.split('T')[0],
          end: end.split('T')[0]
        }
      }
    };
  } catch (error) {
    console.error('Get revenue overview error:', error);
    throw error;
  }
}

async function getRevenueTrends(businessId, period = '30days') {
  try {
    let daysBack = 30;
    if (period === '7days') daysBack = 7;
    if (period === '90days') daysBack = 90;
    if (period === '1year') daysBack = 365;

    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    // Group revenue by day
    const { data: dailyRevenue, error: dailyError } = await supabase
      .from('bookings')
      .select('booking_date, total_paid, service_price, status')
      .eq('business_id', businessId)
      .gte('booking_date', startDate.split('T')[0])
      .lte('booking_date', endDate.split('T')[0])
      .eq('status', 'completed')
      .order('booking_date', { ascending: true });

    if (dailyError) {
      throw dailyError;
    }

    // Process daily revenue data
    const revenueByDay = {};
    dailyRevenue.forEach(booking => {
      const date = booking.booking_date;
      if (!revenueByDay[date]) {
        revenueByDay[date] = 0;
      }
      revenueByDay[date] += booking.total_paid || booking.service_price || 0;
    });

    // Convert to array format for charts
    const trends = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date,
      revenue,
      bookings: dailyRevenue.filter(b => b.booking_date === date).length
    }));

    // Calculate moving average
    const movingAverage = calculateMovingAverage(trends.map(t => t.revenue), 7);

    return {
      message: 'Revenue trends retrieved successfully',
      trends: trends.map((trend, index) => ({
        ...trend,
        movingAverage: movingAverage[index] || trend.revenue
      })),
      period,
      totalDays: daysBack
    };
  } catch (error) {
    console.error('Get revenue trends error:', error);
    throw error;
  }
}

async function getServicePerformance(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    const { data: serviceData, error: serviceError } = await supabase
      .from('bookings')
      .select(`
        services!inner(name, price),
        total_paid,
        service_price,
        status,
        booking_date
      `)
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0]);

    if (serviceError) {
      throw serviceError;
    }

    // Group by service
    const servicePerformance = {};
    serviceData.forEach(booking => {
      const serviceName = booking.services.name;
      if (!servicePerformance[serviceName]) {
        servicePerformance[serviceName] = {
          name: serviceName,
          price: booking.services.price,
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalRevenue: 0
        };
      }
      
      const perf = servicePerformance[serviceName];
      perf.totalBookings += 1;
      
      if (booking.status === 'completed') {
        perf.completedBookings += 1;
        perf.totalRevenue += booking.total_paid || booking.service_price || 0;
      } else if (booking.status === 'cancelled') {
        perf.cancelledBookings += 1;
      }
    });

    // Calculate completion rates and sort by revenue
    const services = Object.values(servicePerformance).map(service => ({
      ...service,
      completionRate: service.totalBookings > 0 ? 
        (service.completedBookings / service.totalBookings * 100).toFixed(1) : 0,
      averageRevenue: service.completedBookings > 0 ? 
        (service.totalRevenue / service.completedBookings).toFixed(2) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      message: 'Service performance retrieved successfully',
      services,
      period: {
        start: start.split('T')[0],
        end: end.split('T')[0]
      }
    };
  } catch (error) {
    console.error('Get service performance error:', error);
    throw error;
  }
}

async function getStaffRevenuePerformance(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    const { data: staffData, error: staffError } = await supabase
      .from('bookings')
      .select(`
        staff!inner(name, role),
        total_paid,
        service_price,
        status,
        booking_date
      `)
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0])
      .not('staff_id', 'is', null);

    if (staffError) {
      throw staffError;
    }

    // Group by staff member
    const staffPerformance = {};
    staffData.forEach(booking => {
      const staffName = booking.staff.name;
      if (!staffPerformance[staffName]) {
        staffPerformance[staffName] = {
          name: staffName,
          role: booking.staff.role,
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalRevenue: 0
        };
      }
      
      const perf = staffPerformance[staffName];
      perf.totalBookings += 1;
      
      if (booking.status === 'completed') {
        perf.completedBookings += 1;
        perf.totalRevenue += booking.total_paid || booking.service_price || 0;
      } else if (booking.status === 'cancelled') {
        perf.cancelledBookings += 1;
      }
    });

    // Calculate metrics and sort by revenue
    const staff = Object.values(staffPerformance).map(member => ({
      ...member,
      completionRate: member.totalBookings > 0 ? 
        (member.completedBookings / member.totalBookings * 100).toFixed(1) : 0,
      averageRevenue: member.completedBookings > 0 ? 
        (member.totalRevenue / member.completedBookings).toFixed(2) : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      message: 'Staff performance retrieved successfully',
      staff,
      period: {
        start: start.split('T')[0],
        end: end.split('T')[0]
      }
    };
  } catch (error) {
    console.error('Get staff performance error:', error);
    throw error;
  }
}

async function getCustomerAnalytics(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // Get customer booking data
    const { data: customerData, error: customerError } = await supabase
      .from('bookings')
      .select(`
        customer_name,
        customer_email,
        total_paid,
        service_price,
        status,
        booking_date,
        services!inner(name)
      `)
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0]);

    if (customerError) {
      throw customerError;
    }

    // Group by customer
    const customerAnalytics = {};
    customerData.forEach(booking => {
      const customerEmail = booking.customer_email || 'walk-in';
      if (!customerAnalytics[customerEmail]) {
        customerAnalytics[customerEmail] = {
          name: booking.customer_name || 'Walk-in Customer',
          email: customerEmail,
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalSpent: 0,
          services: new Set()
        };
      }
      
      const customer = customerAnalytics[customerEmail];
      customer.totalBookings += 1;
      customer.services.add(booking.services.name);
      
      if (booking.status === 'completed') {
        customer.completedBookings += 1;
        customer.totalSpent += booking.total_paid || booking.service_price || 0;
      } else if (booking.status === 'cancelled') {
        customer.cancelledBookings += 1;
      }
    });

    // Convert to array and calculate metrics
    const customers = Object.values(customerAnalytics).map(customer => ({
      ...customer,
      services: Array.from(customer.services),
      completionRate: customer.totalBookings > 0 ? 
        (customer.completedBookings / customer.totalBookings * 100).toFixed(1) : 0,
      averageSpent: customer.completedBookings > 0 ? 
        (customer.totalSpent / customer.completedBookings).toFixed(2) : 0
    })).sort((a, b) => b.totalSpent - a.totalSpent);

    // Calculate summary metrics
    const totalCustomers = customers.length;
    const repeatCustomers = customers.filter(c => c.totalBookings > 1).length;
    const customerRetentionRate = totalCustomers > 0 ? 
      (repeatCustomers / totalCustomers * 100).toFixed(1) : 0;

    return {
      message: 'Customer analytics retrieved successfully',
      customers,
      summary: {
        totalCustomers,
        repeatCustomers,
        customerRetentionRate: parseFloat(customerRetentionRate),
        period: {
          start: start.split('T')[0],
          end: end.split('T')[0]
        }
      }
    };
  } catch (error) {
    console.error('Get customer analytics error:', error);
    throw error;
  }
}

async function getBookingAnalytics(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        status,
        booking_date,
        booking_time,
        total_paid,
        service_price,
        services!inner(name),
        staff!inner(name)
      `)
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0]);

    if (bookingError) {
      throw bookingError;
    }

    // Status breakdown
    const statusBreakdown = {
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending: 0
    };

    // Peak booking times
    const hourBreakdown = {};
    const dayBreakdown = {};

    bookingData.forEach(booking => {
      // Status breakdown
      statusBreakdown[booking.status] = (statusBreakdown[booking.status] || 0) + 1;

      // Hour breakdown
      const hour = parseInt(booking.booking_time.split(':')[0]);
      hourBreakdown[hour] = (hourBreakdown[hour] || 0) + 1;

      // Day breakdown
      const dayOfWeek = new Date(booking.booking_date).getDay();
      dayBreakdown[dayOfWeek] = (dayBreakdown[dayOfWeek] || 0) + 1;
    });

    // Find peak hours and days
    const peakHour = Object.entries(hourBreakdown)
      .sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(dayBreakdown)
      .sort((a, b) => b[1] - a[1])[0];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      message: 'Booking analytics retrieved successfully',
      analytics: {
        statusBreakdown,
        peakHour: peakHour ? `${peakHour[0]}:00 (${peakHour[1]} bookings)` : 'No data',
        peakDay: peakDay ? `${dayNames[peakDay[0]]} (${peakDay[1]} bookings)` : 'No data',
        totalBookings: bookingData.length,
        period: {
          start: start.split('T')[0],
          end: end.split('T')[0]
        }
      }
    };
  } catch (error) {
    console.error('Get booking analytics error:', error);
    throw error;
  }
}

async function getFinancialSummary(businessId, startDate, endDate) {
  try {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // Get all financial data
    const { data: financialData, error: financialError } = await supabase
      .from('bookings')
      .select(`
        total_paid,
        service_price,
        cancellation_fee,
        refund_amount,
        status,
        booking_date,
        services!inner(name),
        staff!inner(name)
      `)
      .eq('business_id', businessId)
      .gte('booking_date', start.split('T')[0])
      .lte('booking_date', end.split('T')[0]);

    if (financialError) {
      throw financialError;
    }

    // Calculate financial metrics
    const grossRevenue = financialData
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_paid || b.service_price || 0), 0);

    const cancellationFees = financialData
      .filter(b => b.status === 'cancelled')
      .reduce((sum, b) => sum + (b.cancellation_fee || 0), 0);

    const refunds = financialData
      .reduce((sum, b) => sum + (b.refund_amount || 0), 0);

    const netRevenue = grossRevenue + cancellationFees - refunds;

    // Calculate daily averages
    const days = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
    const dailyAverage = days > 0 ? (netRevenue / days).toFixed(2) : 0;

    return {
      message: 'Financial summary retrieved successfully',
      summary: {
        grossRevenue,
        cancellationFees,
        refunds,
        netRevenue,
        dailyAverage: parseFloat(dailyAverage),
        totalBookings: financialData.length,
        period: {
          start: start.split('T')[0],
          end: end.split('T')[0],
          days
        }
      }
    };
  } catch (error) {
    console.error('Get financial summary error:', error);
    throw error;
  }
}

async function getRevenueForecast(businessId) {
  try {
    // Get last 90 days of data for forecasting
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();

    const { data: historicalData, error: historicalError } = await supabase
      .from('bookings')
      .select('booking_date, total_paid, service_price, status')
      .eq('business_id', businessId)
      .gte('booking_date', startDate.split('T')[0])
      .lte('booking_date', endDate.split('T')[0])
      .eq('status', 'completed')
      .order('booking_date', { ascending: true });

    if (historicalError) {
      throw historicalError;
    }

    // Calculate daily revenue
    const dailyRevenue = {};
    historicalData.forEach(booking => {
      const date = booking.booking_date;
      if (!dailyRevenue[date]) {
        dailyRevenue[date] = 0;
      }
      dailyRevenue[date] += booking.total_paid || booking.service_price || 0;
    });

    // Simple linear regression for forecasting
    const revenues = Object.values(dailyRevenue);
    const forecast = calculateLinearForecast(revenues, 30); // 30 day forecast

    return {
      message: 'Revenue forecast retrieved successfully',
      forecast: {
        next30Days: forecast,
        averageDaily: forecast / 30,
        confidence: 'Based on historical trends',
        period: 'Next 30 days'
      }
    };
  } catch (error) {
    console.error('Get revenue forecast error:', error);
    throw error;
  }
}

function calculateMovingAverage(data, windowSize) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const end = i + 1;
    const window = data.slice(start, end);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }
  return result;
}

function calculateLinearForecast(data, periods) {
  if (data.length < 2) return 0;

  // Calculate trend
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = data.length;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Forecast next periods
  const lastValue = data[data.length - 1];
  const forecast = lastValue + (slope * periods);

  return Math.max(0, forecast); // Ensure non-negative forecast
}
