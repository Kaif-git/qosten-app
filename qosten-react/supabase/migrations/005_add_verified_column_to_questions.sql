-- Migration: Add verified column to questions_duplicate table
ALTER TABLE questions_duplicate ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Create index for performance when filtering by verification status
CREATE INDEX IF NOT EXISTS idx_questions_duplicate_verified ON questions_duplicate(is_verified);
