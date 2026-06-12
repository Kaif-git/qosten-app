# AI Agent Roadmap

This document outlines the long-term vision for the AI Agent integration in Qosten.

## Future Features

### 1. Persistent AI Assistant
- Floating chat bubble or sidebar.
- Context-aware conversation (remembers previous actions).
- Voice commands for mobile users.

### 2. Autonomous Function Calling
- AI can directly call `search_questions`, `get_question`, and `update_question`.
- Proactive monitoring: AI flags suspicious questions in the background.

### 3. Subject Matter Expert Personalities
- Specialized agents for Physics, Math, Chemistry, etc.
- Different "tones" for primary vs. high school content.

### 4. Image Analysis
- Using Multimodal LLMs (Gemini Pro Vision) to analyze question images.
- Automatically generating ALT text or transcribing text from images.

## Current Implementation (Phase 1)
- Bulk actions on selected questions.
- Single-turn AI tasks: LaTeX fixing, fact-checking, expanding answers.
- Human-in-the-loop: AI proposes changes, user clicks "Apply".
