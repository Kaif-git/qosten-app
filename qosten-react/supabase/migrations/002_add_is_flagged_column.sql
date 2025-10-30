-- Add is_flagged column to questions_duplicate table for flagging questions that need review/fixing
ALTER TABLE questions_duplicate 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

-- Create index for better query performance when filtering by flagged status
CREATE INDEX IF NOT EXISTS idx_questions_flagged ON questions_duplicate(is_flagged);

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN questions_duplicate.is_flagged IS 'Flag to mark questions that need review or fixing';
