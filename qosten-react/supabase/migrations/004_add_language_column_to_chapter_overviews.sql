-- Add language column to chapter_overviews table
ALTER TABLE chapter_overviews
ADD COLUMN language VARCHAR(2) NOT NULL DEFAULT 'en';

-- Add check constraint to ensure only 'en' or 'bn' values
ALTER TABLE chapter_overviews
ADD CONSTRAINT check_language_values CHECK (language IN ('en', 'bn'));

-- Create index for language column for better query performance
CREATE INDEX idx_chapter_overviews_language ON chapter_overviews(language);

-- Add comment to the language column
COMMENT ON COLUMN chapter_overviews.language IS 'Language of the chapter overview: en (English) or bn (Bangla)';
