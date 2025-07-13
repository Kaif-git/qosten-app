const express = require('express');
const router = express.Router();
const Question = require('../models/Question');

// Get all questions
router.get('/', async (req, res) => {
    try {
        const questions = await Question.find();
        res.json(questions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get single question
router.get('/:id', async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json(question);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new question
router.post('/', async (req, res) => {
    const question = new Question(req.body);
    try {
        const newQuestion = await question.save();
        res.status(201).json(newQuestion);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update question
router.put('/:id', async (req, res) => {
    try {
        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedQuestion) return res.status(404).json({ message: 'Question not found' });
        res.json(updatedQuestion);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete question
router.delete('/:id', async (req, res) => {
    try {
        const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
        if (!deletedQuestion) return res.status(404).json({ message: 'Question not found' });
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk import questions
router.post('/import', async (req, res) => {
    try {
        const importedQuestions = req.body;
        if (!Array.isArray(importedQuestions)) {
            return res.status(400).json({ message: 'Expected an array of questions' });
        }

        // Clear existing questions (optional - you might want to merge instead)
        // await Question.deleteMany({});

        // Insert new questions
        const result = await Question.insertMany(importedQuestions);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Sync entire question bank (for client-side state management)
router.post('/sync', async (req, res) => {
    try {
        const questions = req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({ message: 'Expected an array of questions' });
        }

        // Clear existing questions
        await Question.deleteMany({});

        // Insert new questions
        const result = await Question.insertMany(questions);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;