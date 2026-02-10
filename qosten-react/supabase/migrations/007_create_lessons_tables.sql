-- Drop existing tables if they exist to ensure a clean state
DROP TABLE IF EXISTS lesson_questions;
DROP TABLE IF EXISTS lesson_subtopics;
DROP TABLE IF EXISTS lesson_topics;

-- Create lesson_topics table
CREATE TABLE IF NOT EXISTS lesson_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lesson_subtopics table
CREATE TABLE IF NOT EXISTS lesson_subtopics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES lesson_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    definition TEXT,
    explanation TEXT,
    shortcut TEXT,
    mistakes TEXT,
    difficulty TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lesson_questions table
CREATE TABLE IF NOT EXISTS lesson_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES lesson_topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lesson_topics_subject_chapter ON lesson_topics(subject, chapter);
CREATE INDEX IF NOT EXISTS idx_lesson_subtopics_topic_id ON lesson_subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_topic_id ON lesson_questions(topic_id);

-- Enable RLS
ALTER TABLE lesson_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_questions ENABLE ROW LEVEL SECURITY;

-- Create simple public access policies (following project pattern)
CREATE POLICY "Allow read access to all users for lesson_topics" ON lesson_topics FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users for lesson_subtopics" ON lesson_subtopics FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users for lesson_questions" ON lesson_questions FOR SELECT USING (true);

-- Allow all for now (matching dev environment)
CREATE POLICY "Allow all for lesson_topics" ON lesson_topics FOR ALL USING (true);
CREATE POLICY "Allow all for lesson_subtopics" ON lesson_subtopics FOR ALL USING (true);
CREATE POLICY "Allow all for lesson_questions" ON lesson_questions FOR ALL USING (true);