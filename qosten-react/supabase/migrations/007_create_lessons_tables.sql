-- Drop existing tables if they exist to ensure a clean state
DROP TABLE IF EXISTS learn_questions;
DROP TABLE IF EXISTS learn_subtopics;
DROP TABLE IF EXISTS learn_topics;

-- Create learn_topics table
CREATE TABLE IF NOT EXISTS learn_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create learn_subtopics table
CREATE TABLE IF NOT EXISTS learn_subtopics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    definition TEXT,
    explanation TEXT,
    shortcut TEXT,
    mistakes TEXT,
    difficulty TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create learn_questions table
CREATE TABLE IF NOT EXISTS learn_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT, -- Kept for compatibility
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT,
    explanation TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learn_topics_subject_chapter ON learn_topics(subject, chapter);
CREATE INDEX IF NOT EXISTS idx_learn_subtopics_topic_id ON learn_subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_learn_questions_topic_id ON learn_questions(topic_id);

-- Enable RLS
ALTER TABLE learn_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_questions ENABLE ROW LEVEL SECURITY;

-- Create simple public access policies
CREATE POLICY "Allow read access to all users for learn_topics" ON learn_topics FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users for learn_subtopics" ON learn_subtopics FOR SELECT USING (true);
CREATE POLICY "Allow read access to all users for learn_questions" ON learn_questions FOR SELECT USING (true);

-- Allow all for now
CREATE POLICY "Allow all for learn_topics" ON learn_topics FOR ALL USING (true);
CREATE POLICY "Allow all for learn_subtopics" ON learn_subtopics FOR ALL USING (true);
CREATE POLICY "Allow all for learn_questions" ON learn_questions FOR ALL USING (true);
