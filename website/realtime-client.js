// Show Up Media Realtime Client
// Handles real-time updates for booking system

class ShowUpMediaRealtime {
  constructor(businessId, userId, options = {}) {
    this.businessId = businessId;
    this.userId = userId;
    this.options = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...options
    };
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.subscriptions = new Map();
    this.callbacks = new Map();
    
    this.init();
  }

  async init() {
    try {
      // Initialize WebSocket connection
      await this.connect();
      
      // Set up periodic connection check
      setInterval(() => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.reconnect();
        }
      }, 30000); // Check every 30 seconds
      
    } catch (error) {
      console.error('Realtime initialization error:', error);
    }
  }

  async connect() {
    try {
      const wsUrl = `wss://${window.location.host}/.netlify/functions/websocket`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Realtime connected');
        this.reconnectAttempts = 0;
        
        // Subscribe to business updates
        this.subscribe('business_updates', {
          businessId: this.businessId,
          userId: this.userId
        });
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('Realtime disconnected');
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}`);
    
    setTimeout(async () => {
      await this.connect();
    }, this.options.reconnectInterval);
  }

  subscribe(channel, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return false;
    }

    const subscription = {
      id: this.generateId(),
      channel,
      params,
      createdAt: new Date().toISOString()
    };

    this.subscriptions.set(channel, subscription);

    const message = {
      type: 'subscribe',
      subscription
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Subscribed to ${channel}:`, subscription);
    
    return subscription.id;
  }

  unsubscribe(channel, subscriptionId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return false;
    }

    const message = {
      type: 'unsubscribe',
      channelId,
      subscriptionId
    };

    this.ws.send(JSON.stringify(message));
    
    this.subscriptions.delete(channel);
    console.log(`Unsubscribed from ${channel}`);
    
    return true;
  }

  on(eventType, callback) {
    this.callbacks.set(eventType, callback);
  }

  off(eventType, callback) {
    this.callbacks.delete(eventType);
  }

  handleMessage(message) {
    const { type, data, subscriptionId } = message;
    
    switch (type) {
      case 'booking_updated':
        this.triggerCallback('booking_updated', data);
        break;
        
      case 'booking_created':
        this.triggerCallback('booking_created', data);
        break;
        
      case 'booking_cancelled':
        this.triggerCallback('booking_cancelled', data);
        break;
        
      case 'availability_updated':
        this.triggerCallback('availability_updated', data);
        break;
        
      case 'staff_updated':
        this.triggerCallback('staff_updated', data);
        break;
        
      case 'service_updated':
        this.triggerCallback('service_updated', data);
        break;
        
      case 'subscription_confirmed':
        this.triggerCallback('subscription_confirmed', data);
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  }

  triggerCallback(eventType, data) {
    const callback = this.callbacks.get(eventType);
    if (callback) {
      callback(data);
    }
  }

  generateId() {
    return 'sub_' + Math.random().toString(36).substr(2, 9);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear all subscriptions
    this.subscriptions.clear();
    this.callbacks.clear();
  }

  // Utility methods for common operations
  async updateBooking(bookingId, updates) {
    const response = await fetch('/.netlify/functions/realtime-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        type: 'booking-update',
        businessId: this.businessId,
        bookingId,
        data: updates,
        userId: this.userId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update booking');
    }

    return await response.json();
  }

  async updateAvailability(updates) {
    const response = await fetch('/.netlify/functions/realtime-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        type: 'availability-update',
        businessId: this.businessId,
        data: updates,
        userId: this.userId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update availability');
    }

    return await response.json();
  }

  async updateStaff(staffId, updates) {
    const response = await fetch('/.netlify/functions/realtime-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        type: 'staff-update',
        businessId: this.businessId,
        data: { id: staffId, ...updates },
        userId: this.userId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update staff');
    }

    return await response.json();
  }

  async updateService(serviceId, updates) {
    const response = await fetch('/.netlify/functions/realtime-updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        type: 'service-update',
        businessId: this.businessId,
        data: { id: serviceId, ...updates },
        userId: this.userId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update service');
    }

    return await response.json();
  }

  getAuthToken() {
    // Get auth token from localStorage or other storage
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  // Static method to create instance
  static create(businessId, userId, options = {}) {
    return new ShowUpMediaRealtime(businessId, userId, options);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShowUpMediaRealtime;
} else if (typeof window !== 'undefined') {
  window.ShowUpMediaRealtime = ShowUpMediaRealtime;
}
