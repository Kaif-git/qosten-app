-- RPC function to insert dev chat messages bypassing RLS for the dev dashboard
CREATE OR REPLACE FUNCTION send_dev_chat_message(
  p_user_id UUID,
  p_message TEXT,
  p_sender_type TEXT DEFAULT 'developer',
  p_sender_id UUID DEFAULT NULL,
  p_is_read BOOLEAN DEFAULT false
)
RETURNS SETOF dev_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO dev_chats (user_id, message, sender_type, sender_id, is_read)
  VALUES (p_user_id, p_message, p_sender_type, COALESCE(p_sender_id, p_user_id), p_is_read)
  RETURNING *;
END;
$$;
