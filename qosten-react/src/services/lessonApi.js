import { supabase } from './supabaseClient';

export const lessonApi = {
  /**
   * Uploads parsed lesson data (one or more chapters) to Supabase.
   */
  async uploadLesson(lessonData) {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }

    const chapters = Array.isArray(lessonData) ? lessonData : [lessonData];
    const results = {
      chaptersProcessed: 0,
      topicsCreated: 0,
      subtopicsCreated: 0,
      questionsCreated: 0,
      errors: []
    };

    for (const chapterData of chapters) {
      const { subject, chapter, topics } = chapterData;
      results.chaptersProcessed++;

      for (const topicData of topics) {
        try {
          // 1. Insert Topic
          const { data: topic, error: topicError } = await supabase
            .from('learn_topics')
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
              .from('learn_subtopics')
              .insert(subtopicsToInsert);

            if (stError) throw stError;
            results.subtopicsCreated += subtopicsToInsert.length;
          }

          // 3. Insert Questions (MCQ Format)
          if (topicData.questions && topicData.questions.length > 0) {
            const questionsToInsert = topicData.questions.map((q, index) => {
              const findOption = (label) => q.options.find(opt => opt.label === label)?.text || '';
              return {
                topic_id: topic.id,
                question: q.question,
                option_a: findOption('a') || findOption('ক'),
                option_b: findOption('b') || findOption('খ'),
                option_c: findOption('c') || findOption('গ'),
                option_d: findOption('d') || findOption('ঘ'),
                correct_answer: q.correct_answer,
                explanation: q.explanation,
                order_index: index,
                answer: q.correct_answer
              };
            });

            const { error: qError } = await supabase
              .from('learn_questions')
              .insert(questionsToInsert);

            if (qError) throw qError;
            results.questionsCreated += questionsToInsert.length;
          }
        } catch (err) {
          console.error(`Error uploading topic "${topicData.title}" in chapter "${chapter}":`, err);
          results.errors.push(`Chapter "${chapter}", Topic "${topicData.title}": ${err.message}`);
        }
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
      .from('learn_topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (topicsError) throw topicsError;

    // Fetch all subtopics and questions for these topics
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('learn_subtopics')
      .select('*')
      .order('order_index', { ascending: true });

    if (subtopicsError) throw subtopicsError;

    const { data: questions, error: questionsError } = await supabase
      .from('learn_questions')
      .select('*')
      .order('order_index', { ascending: true });

    if (questionsError) throw questionsError;

    // Map questions to include options array for frontend compatibility
    const formattedQuestions = questions.map(q => ({
      ...q,
      options: [
        { label: 'a', text: q.option_a },
        { label: 'b', text: q.option_b },
        { label: 'c', text: q.option_c },
        { label: 'd', text: q.option_d }
      ].filter(opt => opt.text) // Only include options that have text
    }));

    // Grouping
    return topics.map(topic => ({
      ...topic,
      subtopics: subtopics.filter(st => st.topic_id === topic.id),
      questions: formattedQuestions.filter(q => q.topic_id === topic.id)
    }));
  },

  /**
   * Updates an existing topic and its subtopics.
   */
  async updateTopic(topicId, topicData) {
    if (!supabase) throw new Error('Supabase client is not initialized');

    // 1. Update Topic Title
    const { error: topicError } = await supabase
      .from('learn_topics')
      .update({ title: topicData.title })
      .eq('id', topicId);

    if (topicError) throw topicError;

    // 2. Update Subtopics
    // For simplicity, we'll assume subtopics are passed with their IDs
    for (const st of topicData.subtopics) {
      if (st.id) {
        const { error: stError } = await supabase
          .from('learn_subtopics')
          .update({
            title: st.title,
            definition: st.definition,
            explanation: st.explanation,
            shortcut: st.shortcut,
            mistakes: st.mistakes,
            difficulty: st.difficulty
          })
          .eq('id', st.id);
        if (stError) throw stError;
      }
    }

    return { success: true };
  },

  /**
   * Deletes a question.
   */
  async deleteQuestion(questionId) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase
      .from('learn_questions')
      .delete()
      .eq('id', questionId);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Deletes a topic (lesson) and all its subtopics/questions.
   */
  async deleteTopic(topicId) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase
      .from('learn_topics')
      .delete()
      .eq('id', topicId);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Deletes an entire chapter (all topics within it).
   */
  async deleteChapter(subject, chapter) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase
      .from('learn_topics')
      .delete()
      .eq('subject', subject)
      .eq('chapter', chapter);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Adds a batch of questions to a topic.
   */
  async addQuestionsToTopic(topicId, questions, startOrderIndex) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    
    const questionsToInsert = questions.map((q, index) => {
      const findOption = (label) => q.options.find(opt => opt.label === label)?.text || '';
      return {
        topic_id: topicId,
        question: q.question,
        option_a: findOption('a') || findOption('ক'),
        option_b: findOption('b') || findOption('খ'),
        option_c: findOption('c') || findOption('গ'),
        option_d: findOption('d') || findOption('ঘ'),
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        order_index: startOrderIndex + index,
        answer: q.correct_answer
      };
    });

    const { error } = await supabase
      .from('learn_questions')
      .insert(questionsToInsert);
    
    if (error) throw error;
    return { success: true };
  }
};
