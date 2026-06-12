-- RPC function to insert notifications bypassing RLS for the dev dashboard
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_type TEXT DEFAULT 'system',
  p_title TEXT DEFAULT '',
  p_message TEXT DEFAULT '',
  p_read BOOLEAN DEFAULT false,
  p_action_url TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO notifications (user_id, type, title, message, read, action_url, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_read, p_action_url, p_data)
  RETURNING *;
END;
$$;
