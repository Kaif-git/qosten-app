# Qosten - Advanced Question Bank with React

A comprehensive question management system supporting multiple question types (MCQ, CQ, SQ) in both English and Bangla languages.

## 🚀 Recent Refactoring (October 2025)

This project has been **completely refactored** from a monolithic 2,846-line HTML file to a modern React application with proper component architecture.

### Before vs After
- **Before**: Single HTML file with inline CSS and JavaScript
- **After**: Modular React components with proper separation of concerns

## 📁 Project Structure

```
qosten/
├── index.html              # Original monolithic application
├── server.js               # Express backend server
├── package.json            # Node.js dependencies
├── qosten-react/           # New React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # State management
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Helper functions
│   └── package.json        # React app dependencies
└── README.md              # This file
```

## 🎯 Features

### Question Types Supported
- **MCQ (Multiple Choice Questions)**: With options, correct answers, and explanations
- **CQ (Constructive Questions)**: Multi-part questions with individual marks
- **SQ (Short Questions)**: Simple question-answer format

### Languages Supported
- **English**: Full support for all question types
- **Bangla**: Complete bilingual support

### Core Functionality
- ✅ **8 Import Tabs**: Different formats for each question type and language
- ✅ **Advanced Filtering**: Search by subject, chapter, lesson, board, type
- ✅ **CRUD Operations**: Create, Read, Update, Delete questions
- ✅ **Statistics**: Real-time analytics and question counts
- ✅ **Export/Import**: JSON format for data portability
- ✅ **Local Storage**: Automatic persistence
- ✅ **Supabase Integration**: Cloud database ready

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Qosten
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install React frontend dependencies**
   ```bash
   cd qosten-react
   npm install
   ```

4. **Start the applications**
   
   **Terminal 1 - Backend Server:**
   ```bash
   # From root directory
   npm start
   # Runs on http://localhost:3000
   ```
   
   **Terminal 2 - React Frontend:**
   ```bash
   # From qosten-react directory
   cd qosten-react
   npm start
   # Runs on http://localhost:3001
   ```

## 🎮 Usage

### Using the React Version (Recommended)
1. Navigate to `http://localhost:3001`
2. Use the tab navigation to access different features:
   - **Import Questions**: Bulk import MCQ questions
   - **Question Bank**: View and manage all questions
   - **Add New Question**: Create individual questions
   - **Import CQ/SQ**: Import constructive and short questions
   - **Import Bangla**: Import questions in Bangla language

### Question Format Examples

#### MCQ Format
```
[Subject: Math]
[Chapter: Algebra]
[Lesson: Linear Equations]
[Board: CBSE]
[isQuizzable: true]
[Tags: easy, calculation]
1. What is the solution to 2x + 3 = 7?
a) 1
b) 2
c) 3
d) 4
Correct: b
Explanation: To solve 2x + 3 = 7, subtract 3 from both sides...
```

#### CQ Format
```
Question 1
Organelle M and N are marked in the diagram.
a. What is plasmalemma? (1)
b. Why are plastids called colour forming organs? (2)
c. Why is the organelle marked with N important? (3)
d. What problems will appear if part M is absent? (4)

Answer:
a. The protoplasm of the living cell...
b. The coloured organelles present...
[Additional metadata]
```

## 🏗️ Architecture

### React Components
- **Header**: Export/Import functionality
- **TabContainer**: Navigation between different views
- **QuestionBank**: Main question display with filtering
- **QuestionCard**: Individual question rendering
- **QuestionForm**: Add/Edit question form
- **ImportTabs**: Bulk import functionality for all types
- **SearchFilters**: Advanced filtering options
- **Statistics**: Analytics and question counts
- **PasswordOverlay**: Security layer

### State Management
- **React Context**: Global state for questions, filters, and app state
- **LocalStorage**: Automatic persistence
- **Supabase**: Cloud database integration (optional)

## 🔧 Technical Details

### Dependencies
- **Frontend**: React, React Router, Supabase Client
- **Backend**: Express, MongoDB, Mongoose, Supabase

### Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge

## 📈 Performance Improvements

### React Refactoring Benefits
- **Component Reusability**: Shared components across the application
- **State Management**: Efficient React Context for global state
- **Code Splitting**: Better loading performance
- **Hot Reload**: Instant development feedback
- **TypeScript Ready**: Easy to migrate to TypeScript if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs

---

**Note**: Both the original monolithic version (`index.html`) and the new React version are available in this repository. The React version is recommended for new development and maintenance.