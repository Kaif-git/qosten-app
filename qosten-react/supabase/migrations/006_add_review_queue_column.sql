-- Migration: Add in_review_queue column to questions_duplicate table
ALTER TABLE questions_duplicate ADD COLUMN IF NOT EXISTS in_review_queue BOOLEAN DEFAULT false;

-- Create index for performance when filtering or fetching the review queue
CREATE INDEX IF NOT EXISTS idx_questions_duplicate_review_queue ON questions_duplicate(in_review_queue);
