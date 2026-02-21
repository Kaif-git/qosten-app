-- Migration: Add questionimage and answerimage columns to lab_problems table
-- To match the questions table from the worker API
ALTER TABLE lab_problems 
ADD COLUMN IF NOT EXISTS questionimage TEXT,
ADD COLUMN IF NOT EXISTS answerimage1 TEXT,
ADD COLUMN IF NOT EXISTS answerimage2 TEXT,
ADD COLUMN IF NOT EXISTS answerimage3 TEXT,
ADD COLUMN IF NOT EXISTS answerimage4 TEXT;

-- Add comments for documentation
COMMENT ON COLUMN lab_problems.questionimage IS 'URL or base64 of the main question image (matches the worker api)';
COMMENT ON COLUMN lab_problems.answerimage1 IS 'URL or base64 of the first answer image (matches the worker api)';
COMMENT ON COLUMN lab_problems.answerimage2 IS 'URL or base64 of the second answer image (matches the worker api)';
COMMENT ON COLUMN lab_problems.answerimage3 IS 'URL or base64 of the third answer image (matches the worker api)';
COMMENT ON COLUMN lab_problems.answerimage4 IS 'URL or base64 of the fourth answer image (matches the worker api)';
