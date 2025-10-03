import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import TabContainer from './components/TabContainer/TabContainer';
import QuestionBank from './components/QuestionBank/QuestionBank';
import QuestionForm from './components/QuestionForm/QuestionForm';
import ImportTabs from './components/ImportTabs/ImportTabs';
import PasswordOverlay from './components/PasswordOverlay/PasswordOverlay';
import { QuestionProvider } from './context/QuestionContext';

function App() {
  return (
    <QuestionProvider>
      <BrowserRouter>
        <div className="App">
          <PasswordOverlay />
          <Header />
          <TabContainer />
        <Routes>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportTabs type="mcq" language="en" />} />
          <Route path="/bank" element={<QuestionBank />} />
          <Route path="/add" element={<QuestionForm />} />
          <Route path="/import-cq" element={<ImportTabs type="cq" language="en" />} />
          <Route path="/import-sq" element={<ImportTabs type="sq" language="en" />} />
          <Route path="/import-bn" element={<ImportTabs type="mcq" language="bn" />} />
          <Route path="/import-cq-bn" element={<ImportTabs type="cq" language="bn" />} />
          <Route path="/import-sq-bn" element={<ImportTabs type="sq" language="bn" />} />
        </Routes>
        </div>
      </BrowserRouter>
    </QuestionProvider>
  );
}

export default App;
