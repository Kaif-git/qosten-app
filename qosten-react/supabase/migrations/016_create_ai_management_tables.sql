-- AI Management Tables
-- Stores API keys in database, tracks usage, and manages AI resources

-- 1. AI API Keys Table
-- Stores API keys with metadata and daily limits
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL, -- Friendly name like "Key 1", "Backup Key"
  api_key TEXT NOT NULL UNIQUE, -- The actual API key
  provider VARCHAR(50) DEFAULT 'google_genai', -- google_genai, openai, anthropic
  model VARCHAR(100) DEFAULT 'gemma-4-31b-it',
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 1500, -- 1500 requests per day
  rpm_limit INTEGER DEFAULT 15, -- 15 requests per minute
  current_usage_today INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  total_requests BIGINT DEFAULT 0,
  priority INTEGER DEFAULT 0, -- Higher priority = used first
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- 2. AI Usage Logs Table
-- Detailed log of every API request
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES ai_api_keys(id) ON DELETE SET NULL,
  request_type VARCHAR(100), -- 'improve_question', 'fact_check', 'generate', etc.
  model VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  question_id INTEGER, -- Reference to question being processed
  batch_id UUID, -- Reference to batch if part of one
  user_id TEXT, -- User who initiated (if applicable)
  metadata JSONB, -- Additional metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Daily Usage Summary
-- Aggregated daily stats per key
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES ai_api_keys(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  avg_response_time_ms INTEGER,
  UNIQUE(api_key_id, usage_date)
);

-- 4. AI Chat History
-- Stores conversation history
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES ai_api_keys(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  model VARCHAR(100),
  tokens_used INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AI Batches
-- Stores batch processing information
CREATE TABLE IF NOT EXISTS ai_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255),
  task_type VARCHAR(100), -- 'improve_question', 'fact_check', etc.
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  api_key_id UUID REFERENCES ai_api_keys(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  metadata JSONB,
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AI Cache
-- Caches responses to avoid duplicate API calls
CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE, -- Hash of prompt + model + settings
  prompt_hash TEXT,
  model VARCHAR(100),
  response TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AI Rate Limit Tracker
-- Tracks per-minute requests for RPM enforcement
CREATE TABLE IF NOT EXISTS ai_rate_limit_tracker (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES ai_api_keys(id) ON DELETE CASCADE,
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX idx_ai_api_keys_active ON ai_api_keys(is_active, priority DESC);
CREATE INDEX idx_ai_usage_logs_key_id ON ai_usage_logs(api_key_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_question_id ON ai_usage_logs(question_id);
CREATE INDEX idx_ai_daily_usage_date ON ai_daily_usage(usage_date DESC);
CREATE INDEX idx_ai_chat_history_session ON ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_history_created ON ai_chat_history(created_at DESC);
CREATE INDEX idx_ai_batches_status ON ai_batches(status);
CREATE INDEX idx_ai_batches_created ON ai_batches(created_at DESC);
CREATE INDEX idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX idx_ai_rate_limit_key_time ON ai_rate_limit_tracker(api_key_id, request_timestamp);

-- Enable Row Level Security
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rate_limit_tracker ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - this is an internal tool)
CREATE POLICY "Allow all access to ai_api_keys" ON ai_api_keys FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_usage_logs" ON ai_usage_logs FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_daily_usage" ON ai_daily_usage FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_chat_history" ON ai_chat_history FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_batches" ON ai_batches FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_cache" ON ai_cache FOR ALL USING (true);
CREATE POLICY "Allow all access to ai_rate_limit_tracker" ON ai_rate_limit_tracker FOR ALL USING (true);

-- Function to reset daily usage
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
  UPDATE ai_api_keys
  SET current_usage_today = 0, last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to get best available key
CREATE OR REPLACE FUNCTION get_best_api_key()
RETURNS TABLE (
  id UUID,
  api_key TEXT,
  key_name VARCHAR(100),
  provider VARCHAR(50),
  model VARCHAR(100),
  current_usage_today INTEGER,
  daily_limit INTEGER
) AS $$
BEGIN
  -- First reset daily usage if needed
  PERFORM reset_daily_usage();
  
  -- Clean up old rate limit entries (older than 1 minute)
  DELETE FROM ai_rate_limit_tracker 
  WHERE request_timestamp < NOW() - INTERVAL '1 minute';
  
  -- Return the best key (highest priority, lowest usage, under RPM limit)
  RETURN QUERY
  SELECT 
    k.id,
    k.api_key,
    k.key_name,
    k.provider,
    k.model,
    k.current_usage_today,
    k.daily_limit
  FROM ai_api_keys k
  WHERE k.is_active = true
    AND k.current_usage_today < k.daily_limit
    AND (
      SELECT COUNT(*) 
      FROM ai_rate_limit_tracker r 
      WHERE r.api_key_id = k.id 
        AND r.request_timestamp > NOW() - INTERVAL '1 minute'
    ) < k.rpm_limit
  ORDER BY k.priority DESC, k.current_usage_today ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_ai_usage(
  p_api_key_id UUID,
  p_request_type VARCHAR(100),
  p_model VARCHAR(100),
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_question_id INTEGER DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Insert into usage logs
  INSERT INTO ai_usage_logs (
    api_key_id, request_type, model, input_tokens, output_tokens,
    total_tokens, response_time_ms, success, error_message,
    question_id, batch_id, user_id, metadata
  ) VALUES (
    p_api_key_id, p_request_type, p_model, p_input_tokens, p_output_tokens,
    COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0),
    p_response_time_ms, p_success, p_error_message,
    p_question_id, p_batch_id, p_user_id, p_metadata
  ) RETURNING id INTO log_id;
  
  -- Update key usage
  UPDATE ai_api_keys
  SET 
    current_usage_today = current_usage_today + 1,
    total_requests = total_requests + 1,
    last_used_at = NOW()
  WHERE id = p_api_key_id;
  
  -- Update daily summary
  INSERT INTO ai_daily_usage (api_key_id, usage_date, total_requests, 
    successful_requests, failed_requests, total_input_tokens, total_output_tokens)
  VALUES (
    p_api_key_id, CURRENT_DATE, 1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    COALESCE(p_input_tokens, 0), COALESCE(p_output_tokens, 0)
  )
  ON CONFLICT (api_key_id, usage_date) DO UPDATE SET
    total_requests = ai_daily_usage.total_requests + 1,
    successful_requests = ai_daily_usage.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_requests = ai_daily_usage.failed_requests + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    total_input_tokens = ai_daily_usage.total_input_tokens + COALESCE(p_input_tokens, 0),
    total_output_tokens = ai_daily_usage.total_output_tokens + COALESCE(p_output_tokens, 0);
  
  -- Track for RPM
  INSERT INTO ai_rate_limit_tracker (api_key_id, success)
  VALUES (p_api_key_id, p_success);
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard stats
CREATE OR REPLACE FUNCTION get_ai_dashboard_stats()
RETURNS TABLE (
  total_keys INTEGER,
  active_keys INTEGER,
  total_requests_today BIGINT,
  total_requests_all_time BIGINT,
  remaining_requests_today INTEGER,
  avg_response_time_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM ai_api_keys)::INTEGER,
    (SELECT COUNT(*) FROM ai_api_keys WHERE is_active = true)::INTEGER,
    COALESCE((SELECT SUM(current_usage_today) FROM ai_api_keys WHERE last_reset_date = CURRENT_DATE), 0)::BIGINT,
    COALESCE((SELECT SUM(total_requests) FROM ai_api_keys), 0)::BIGINT,
    COALESCE((SELECT SUM(daily_limit - current_usage_today) FROM ai_api_keys WHERE is_active = true AND last_reset_date = CURRENT_DATE), 0)::INTEGER,
    (SELECT AVG(response_time_ms)::INTEGER FROM ai_usage_logs WHERE created_at > CURRENT_DATE)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to get key usage stats
CREATE OR REPLACE FUNCTION get_key_usage_stats()
RETURNS TABLE (
  id UUID,
  key_name VARCHAR(100),
  provider VARCHAR(50),
  model VARCHAR(100),
  is_active BOOLEAN,
  daily_limit INTEGER,
  current_usage_today INTEGER,
  remaining_today INTEGER,
  rpm_limit INTEGER,
  requests_last_minute BIGINT,
  total_requests BIGINT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.key_name,
    k.provider,
    k.model,
    k.is_active,
    k.daily_limit,
    k.current_usage_today,
    GREATEST(0, k.daily_limit - k.current_usage_today),
    k.rpm_limit,
    (
      SELECT COUNT(*) 
      FROM ai_rate_limit_tracker r 
      WHERE r.api_key_id = k.id 
        AND r.request_timestamp > NOW() - INTERVAL '1 minute'
    ),
    k.total_requests,
    k.last_used_at,
    CASE 
      WHEN k.daily_limit > 0 THEN ROUND((k.current_usage_today::NUMERIC / k.daily_limit) * 100, 1)
      ELSE 0
    END
  FROM ai_api_keys k
  ORDER BY k.priority DESC, k.current_usage_today ASC;
END;
$$ LANGUAGE plpgsql;

-- Insert default keys from environment (migrate existing keys)
-- These will need to be inserted manually or via script

-- Trigger for updated_at
CREATE TRIGGER update_ai_api_keys_updated_at
  BEFORE UPDATE ON ai_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE ai_api_keys;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_usage_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_batches;
