-- Migration: Add image columns to lab_problems table
ALTER TABLE lab_problems 
ADD COLUMN IF NOT EXISTS stem_image TEXT,
ADD COLUMN IF NOT EXISTS answerimage1 TEXT,
ADD COLUMN IF NOT EXISTS answerimage2 TEXT,
ADD COLUMN IF NOT EXISTS answerimage3 TEXT,
ADD COLUMN IF NOT EXISTS answerimage4 TEXT;

-- Add comment to explain the columns
COMMENT ON COLUMN lab_problems.stem_image IS 'URL or base64 of the stem/question image';
COMMENT ON COLUMN lab_problems.answerimage1 IS 'URL or base64 of the first answer image (e.g. for part c)';
COMMENT ON COLUMN lab_problems.answerimage2 IS 'URL or base64 of the second answer image (e.g. for part d)';
COMMENT ON COLUMN lab_problems.answerimage3 IS 'URL or base64 of the third answer image (e.g. for part a)';
COMMENT ON COLUMN lab_problems.answerimage4 IS 'URL or base64 of the fourth answer image (e.g. for part b)';
