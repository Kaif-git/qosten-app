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

      // Get max order index for this chapter to append
      const { data: existingTopics } = await supabase
        .from('learn_topics')
        .select('order_index')
        .eq('subject', subject)
        .eq('chapter', chapter)
        .order('order_index', { ascending: false })
        .limit(1);
      
      let nextOrder = (existingTopics && existingTopics[0]?.order_index !== undefined) 
        ? existingTopics[0].order_index + 1 
        : 0;

      for (const topicData of topics) {
        try {
          // 1. Insert Topic
          const { data: topic, error: topicError } = await supabase
            .from('learn_topics')
            .insert([{
              subject,
              chapter,
              title: topicData.title,
              order_index: nextOrder++
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

    const { data: topics, error: topicsError } = await supabase
      .from('learn_topics')
      .select(`
        *,
        subtopics:learn_subtopics(*),
        questions:learn_questions(*)
      `)
      .order('subject', { ascending: true })
      .order('chapter', { ascending: true })
      .order('order_index', { ascending: true })
      .order('order_index', { foreignTable: 'learn_subtopics', ascending: true })
      .order('order_index', { foreignTable: 'learn_questions', ascending: true });

    if (topicsError) throw topicsError;

    // Map questions to include options array for frontend compatibility
    return topics.map(topic => ({
      ...topic,
      subtopics: topic.subtopics || [],
      questions: (topic.questions || []).map(q => ({
        ...q,
        options: [
          { label: 'a', text: q.option_a },
          { label: 'b', text: q.option_b },
          { label: 'c', text: q.option_c },
          { label: 'd', text: q.option_d }
        ].filter(opt => opt.text) // Only include options that have text
      }))
    }));
  },

  /**
   * Creates a new topic at a specific position and shifts subsequent topics.
   */
  async createTopicAtPosition(topicData, position) {
    if (!supabase) throw new Error('Supabase client is not initialized');

    const { subject, chapter, title, subtopics, questions } = topicData;

    // 1. Shift existing topics with order_index >= position
    const { error: shiftError } = await supabase.rpc('increment_topic_orders', {
      p_subject: subject,
      p_chapter: chapter,
      p_min_order: position
    });

    // If RPC doesn't exist, we'll have to do it manually (less efficient)
    if (shiftError) {
      console.warn('RPC increment_topic_orders failed or not found, falling back to manual shift:', shiftError);
      const { data: toShift, error: fetchError } = await supabase
        .from('learn_topics')
        .select('id, order_index')
        .eq('subject', subject)
        .eq('chapter', chapter)
        .gte('order_index', position);

      if (fetchError) throw fetchError;

      for (const t of toShift) {
        await supabase
          .from('learn_topics')
          .update({ order_index: t.order_index + 1 })
          .eq('id', t.id);
      }
    }

    // 2. Insert the new topic
    const { data: topic, error: topicError } = await supabase
      .from('learn_topics')
      .insert([{
        subject,
        chapter,
        title,
        order_index: position
      }])
      .select()
      .single();

    if (topicError) throw topicError;

    // 3. Insert Subtopics
    if (subtopics && subtopics.length > 0) {
      const subtopicsToInsert = subtopics.map((st, index) => ({
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
    }

    // 4. Insert Questions
    if (questions && questions.length > 0) {
      const questionsToInsert = questions.map((q, index) => {
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
    }

    return topic;
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
   * Renames a subject across all chapters and topics.
   */
  async renameSubject(oldSubjectName, newSubjectName) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase
      .from('learn_topics')
      .update({ subject: newSubjectName })
      .eq('subject', oldSubjectName);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Renames a chapter within a subject.
   */
  async renameChapter(subject, oldChapterName, newChapterName) {
    if (!supabase) throw new Error('Supabase client is not initialized');
    const { error } = await supabase
      .from('learn_topics')
      .update({ chapter: newChapterName })
      .eq('subject', subject)
      .eq('chapter', oldChapterName);
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
