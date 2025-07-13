const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    label: { type: String, required: true },
    text: { type: String, required: true },
    image: String
});

const partSchema = new mongoose.Schema({
    letter: { type: String, required: true },
    text: { type: String, required: true },
    marks: { type: Number, required: true },
    answer: { type: String, required: true },
    image: String
});

const questionSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ['mcq', 'cq'] },
    subject: String,
    chapter: String,
    lesson: String,
    board: String,
    isQuizzable: { type: Boolean, default: true },
    tags: [String],
    image: String,

    // MCQ specific fields
    question: String,
    options: [optionSchema],
    correctAnswer: String,

    // CQ specific fields
    questionText: String,
    parts: [partSchema]
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);