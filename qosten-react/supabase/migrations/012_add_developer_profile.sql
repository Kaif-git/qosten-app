-- Add Developer Profile for System Actions
-- This ensures that the Nil UUID used by the developer dashboard exists in user_profiles
-- to avoid foreign key constraint violations in dev_chats.

INSERT INTO user_profiles (user_id, display_name, username, account_tier, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'System Developer', 
    'developer', 
    'premium', 
    NOW()
)
ON CONFLICT (user_id) DO NOTHING;
