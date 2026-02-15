-- Create lab_problems table
CREATE TABLE IF NOT EXISTS lab_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_problem_id TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    lesson TEXT,
    board TEXT,
    stem TEXT NOT NULL,
    parts JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lab_problems_subject_chapter ON lab_problems(subject, chapter);
CREATE INDEX IF NOT EXISTS idx_lab_problems_lab_problem_id ON lab_problems(lab_problem_id);

-- Enable RLS
ALTER TABLE lab_problems ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow read access to all users for lab_problems" ON lab_problems FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users for lab_problems" ON lab_problems FOR ALL USING (true); -- Adjust this if you have specific auth requirements
