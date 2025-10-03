-- Create prompts table for storing AI prompts by type and subject
CREATE TABLE IF NOT EXISTS prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_type VARCHAR(100) NOT NULL, -- e.g., 'question_generation', 'explanation', 'summary', 'evaluation'
  subject VARCHAR(100), -- e.g., 'Mathematics', 'Science', 'English'
  grade_level VARCHAR(50), -- e.g., 'Grade 10', 'High School'
  language VARCHAR(50) DEFAULT 'English',
  tags TEXT[], -- Array of tags for additional categorization
  ai_model VARCHAR(100), -- e.g., 'gpt-4', 'claude-3', 'gemini-pro'
  temperature DECIMAL(3,2) DEFAULT 0.7, -- AI temperature setting (0.0 to 1.0)
  max_tokens INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  notes TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_prompts_type ON prompts(prompt_type);
CREATE INDEX idx_prompts_subject ON prompts(subject);
CREATE INDEX idx_prompts_active ON prompts(is_active);
CREATE INDEX idx_prompts_tags ON prompts USING GIN(tags);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some example prompts
INSERT INTO prompts (title, prompt_text, prompt_type, subject, grade_level, tags) VALUES
(
  'Generate MCQ Questions',
  'Generate {count} multiple-choice questions on the topic of {topic} for {grade_level} students. Each question should have 4 options with only one correct answer. Format: Question, Options (A-D), Correct Answer, Explanation.',
  'question_generation',
  'General',
  'All Levels',
  ARRAY['mcq', 'multiple-choice', 'assessment']
),
(
  'Generate True/False Questions',
  'Create {count} true or false questions about {topic} suitable for {grade_level} students. Include the correct answer and a brief explanation for each question.',
  'question_generation',
  'General',
  'All Levels',
  ARRAY['true-false', 'boolean', 'assessment']
),
(
  'Explain Concept',
  'Explain the concept of {concept} in {subject} to {grade_level} students. Use simple language and provide practical examples.',
  'explanation',
  'General',
  'All Levels',
  ARRAY['explanation', 'teaching', 'concept']
),
(
  'Generate Fill in the Blanks',
  'Create {count} fill-in-the-blank questions on {topic} for {grade_level} students. Provide the complete sentence with the blank, the correct answer, and an alternative acceptable answer if applicable.',
  'question_generation',
  'General',
  'All Levels',
  ARRAY['fill-blanks', 'completion', 'assessment']
),
(
  'Summarize Topic',
  'Provide a concise summary of {topic} in {subject} appropriate for {grade_level} students. Include key points and important takeaways.',
  'summary',
  'General',
  'All Levels',
  ARRAY['summary', 'overview', 'revision']
);

-- Enable Row Level Security (RLS)
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON prompts
  FOR SELECT
  USING (true);

-- Create policy to allow insert/update/delete for authenticated users only
CREATE POLICY "Allow insert for authenticated users" ON prompts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON prompts
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete for authenticated users" ON prompts
  FOR DELETE
  USING (auth.role() = 'authenticated');
