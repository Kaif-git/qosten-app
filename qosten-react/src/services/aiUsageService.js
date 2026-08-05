const WORKER_BASE_URL = 'https://questions-api.edventure.workers.dev';

class AIUsageService {
  constructor() {
    this.keys = [];
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(cb => cb(this.keys));
  }

  async loadKeys() {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/keys`);
      
      if (!response.ok) {
        console.error('Failed to load keys from Worker API');
        return this.getFallbackKeys();
      }
      
      this.keys = await response.json();
      this.notifyListeners();
      return this.keys;
    } catch (err) {
      console.error('Exception loading keys:', err);
      return this.getFallbackKeys();
    }
  }

  getFallbackKeys() {
    const envKeys = (process.env.REACT_APP_GEMINI_API_KEYS || '').split(',').filter(Boolean);
    return envKeys.map((key, i) => ({
      id: `fallback-${i}`,
      key_name: `Fallback Key ${i + 1}`,
      api_key: key,
      provider: 'google_genai',
      model: 'gemma-4-31b-it',
      is_active: true,
      daily_limit: 1500,
      current_usage_today: 0,
      remaining_today: 1500,
      rpm_limit: 15,
      requests_last_minute: 0,
      total_requests: 0,
      usage_percentage: 0
    }));
  }

  async getAllAvailableKeys() {
    try {
      const keys = this.keys.length > 0 ? this.keys : await this.loadKeys();

      let available = keys.filter(k =>
        k.is_active !== false && k.current_usage_today < k.daily_limit
      );

      if (available.length === 0) {
        available = this.getFallbackKeys().filter(k =>
          k.is_active !== false && k.current_usage_today < k.daily_limit
        );
      }

      return available;
    } catch (err) {
      console.error('Error getting all available keys:', err);
      return this.getFallbackKeys();
    }
  }

  async getBestKey() {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/keys/best`);
      
      if (!response.ok) {
        console.warn('No available keys from Worker API, using fallback');
        return this.getFallbackKeys()[0];
      }
      
      const data = await response.json();
      
      return {
        id: data.id,
        api_key: data.api_key,
        key_name: data.key_name,
        provider: data.provider,
        model: data.model,
        current_usage_today: data.current_usage_today,
        daily_limit: data.daily_limit
      };
    } catch (err) {
      console.error('Error getting best key:', err);
      return this.getFallbackKeys()[0];
    }
  }

  async logUsage(params) {
    const {
      apiKeyId,
      requestType,
      model = 'gemma-4-31b-it',
      inputTokens,
      outputTokens,
      responseTimeMs,
      success = true,
      errorMessage,
      metadata
    } = params;

    try {
      await fetch(`${WORKER_BASE_URL}/api/ai/usage/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key_id: apiKeyId,
          request_type: requestType,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          response_time_ms: responseTimeMs,
          success,
          error_message: errorMessage,
          metadata
        })
      });
    } catch (err) {
      console.error('Exception logging usage:', err);
    }
  }

  async getDashboardStats() {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/dashboard/stats`);
      
      if (!response.ok) return null;
      
      return await response.json();
    } catch (err) {
      console.error('Exception getting dashboard stats:', err);
      return null;
    }
  }

  async getUsageLogs(limit = 100, offset = 0) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/usage/logs?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) return [];
      
      return await response.json();
    } catch (err) {
      console.error('Exception getting usage logs:', err);
      return [];
    }
  }

  async addApiKey(params) {
    const { keyName, apiKey, provider = 'google_genai', model = 'gemma-4-31b-it', dailyLimit = 1500, rpmLimit = 15, priority = 0, notes } = params;

    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_name: keyName,
          api_key: apiKey,
          provider,
          model,
          daily_limit: dailyLimit,
          rpm_limit: rpmLimit,
          priority,
          notes
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to add key' };
      }
      
      await this.loadKeys();
      return { success: true, data };
    } catch (err) {
      console.error('Exception adding key:', err);
      return { success: false, error: err.message };
    }
  }

  async updateApiKey(id, updates) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error };
      }
      
      await this.loadKeys();
      return { success: true };
    } catch (err) {
      console.error('Exception updating key:', err);
      return { success: false, error: err.message };
    }
  }

  async deleteApiKey(id) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/keys/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        return { success: false };
      }
      
      await this.loadKeys();
      return { success: true };
    } catch (err) {
      console.error('Exception deleting key:', err);
      return { success: false, error: err.message };
    }
  }

  async resetDailyUsage() {
    try {
      await fetch(`${WORKER_BASE_URL}/api/ai/usage/reset-daily`, {
        method: 'POST'
      });
      await this.loadKeys();
    } catch (err) {
      console.error('Exception resetting daily usage:', err);
    }
  }

  async logKeyError(params) {
    const {
      apiKeyId,
      errorType = 'unknown',
      errorCode,
      errorMessage,
      httpStatus,
      requestType,
      model,
      retryCount = 0,
      metadata
    } = params;

    try {
      await fetch(`${WORKER_BASE_URL}/api/ai/errors/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key_id: apiKeyId,
          error_type: errorType,
          error_code: errorCode,
          error_message: errorMessage,
          http_status: httpStatus,
          request_type: requestType,
          model,
          retry_count: retryCount,
          metadata
        })
      });
    } catch (err) {
      console.error('Exception logging key error:', err);
    }
  }

  async getKeyErrors(limit = 100, offset = 0, apiKeyId = null) {
    try {
      let url = `${WORKER_BASE_URL}/api/ai/errors?limit=${limit}&offset=${offset}`;
      if (apiKeyId) url += `&api_key_id=${apiKeyId}`;
      
      const response = await fetch(url);
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Exception getting key errors:', err);
      return [];
    }
  }

  async getKeyErrorStats(days = 7) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/errors/stats?days=${days}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('Exception getting key error stats:', err);
      return null;
    }
  }

  async getUsageAnalysis(days = 14) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/usage/analysis?days=${days}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('Exception getting usage analysis:', err);
      return null;
    }
  }

  async getBatches(limit = 20) {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/batches?limit=${limit}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Exception getting batches:', err);
      return [];
    }
  }

  async getCacheStats() {
    try {
      const response = await fetch(`${WORKER_BASE_URL}/api/ai/cache/stats`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('Exception getting cache stats:', err);
      return null;
    }
  }
}

export const aiUsageService = new AIUsageService();
