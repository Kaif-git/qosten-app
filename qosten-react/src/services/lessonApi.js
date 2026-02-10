import { supabase } from './supabaseClient';

export const lessonApi = {
  /**
   * Uploads parsed lesson data (topics, subtopics, and questions) to Supabase.
   */
  async uploadLesson(lessonData) {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const { subject, chapter, topics } = lessonData;
    const results = {
      topicsCreated: 0,
      subtopicsCreated: 0,
      questionsCreated: 0,
      errors: []
    };

    for (const topicData of topics) {
      try {
        // 1. Insert Topic
        const { data: topic, error: topicError } = await supabase
          .from('lesson_topics')
          .insert([{
            subject,
            chapter,
            title: topicData.title
          }])
          .select()
          .single();

        if (topicError) throw topicError;
        results.topicsCreated++;

        // 2. Insert Subtopics
        if (topicData.subtopics && topicData.subtopics.length > 0) {
          const subtopicsToInsert = topicData.subtopics.map((st, index) => ({
            topic_id: topic.id,
            title: st.title,
            definition: st.definition,
            explanation: st.explanation,
            shortcut: st.shortcut,
            mistakes: st.mistakes,
            difficulty: st.difficulty,
            order_index: index
          }));

          const { error: stError } = await supabase
            .from('lesson_subtopics')
            .insert(subtopicsToInsert);

          if (stError) throw stError;
          results.subtopicsCreated += subtopicsToInsert.length;
        }

        // 3. Insert Questions
        if (topicData.questions && topicData.questions.length > 0) {
          const questionsToInsert = topicData.questions.map((q, index) => ({
            topic_id: topic.id,
            question: q.question,
            answer: q.answer,
            order_index: index
          }));

          const { error: qError } = await supabase
            .from('lesson_questions')
            .insert(questionsToInsert);

          if (qError) throw qError;
          results.questionsCreated += questionsToInsert.length;
        }
      } catch (err) {
        console.error(`Error uploading topic "${topicData.title}":`, err);
        results.errors.push(`Topic "${topicData.title}": ${err.message}`);
      }
    }

    return results;
  },

  /**
   * Fetches all lesson topics with their subtopics and questions.
   */
  async fetchLessons() {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    // Fetch topics
    const { data: topics, error: topicsError } = await supabase
      .from('lesson_topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (topicsError) throw topicsError;

    // Fetch all subtopics and questions for these topics
    // In a large app, we might do this per-topic, but for now we'll fetch all and group them
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('lesson_subtopics')
      .select('*')
      .order('order_index', { ascending: true });

    if (subtopicsError) throw subtopicsError;

    const { data: questions, error: questionsError } = await supabase
      .from('lesson_questions')
      .select('*')
      .order('order_index', { ascending: true });

    if (questionsError) throw questionsError;

    // Grouping
    return topics.map(topic => ({
      ...topic,
      subtopics: subtopics.filter(st => st.topic_id === topic.id),
      questions: questions.filter(q => q.topic_id === topic.id)
    }));
  }
};
