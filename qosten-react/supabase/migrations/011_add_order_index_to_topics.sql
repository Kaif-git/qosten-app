-- Add order_index to learn_topics table
ALTER TABLE learn_topics ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Set default order_index based on created_at for existing records
WITH OrderedTopics AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY subject, chapter ORDER BY created_at ASC) - 1 as new_order
  FROM learn_topics
)
UPDATE learn_topics
SET order_index = OrderedTopics.new_order
FROM OrderedTopics
WHERE learn_topics.id = OrderedTopics.id;

-- Create RPC for shifting orders
CREATE OR REPLACE FUNCTION increment_topic_orders(p_subject TEXT, p_chapter TEXT, p_min_order INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE learn_topics
  SET order_index = order_index + 1
  WHERE subject = p_subject AND chapter = p_chapter AND order_index >= p_min_order;
END;
$$ LANGUAGE plpgsql;
