import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import TabContainer from './components/TabContainer/TabContainer';
import QuestionBank from './components/QuestionBank/QuestionBank';
import QuestionForm from './components/QuestionForm/QuestionForm';
import ImportTabs from './components/ImportTabs/ImportTabs';
import PasswordOverlay from './components/PasswordOverlay/PasswordOverlay';
import { QuestionProvider } from './context/QuestionContext';
import { PromptProvider } from './context/SimplePromptContext';
import { ShopProvider } from './context/ShopContext';
import SimplePromptManager from './components/SimplePromptManager/SimplePromptManager';
import MathQuestionImport from './components/MathQuestionImport/MathQuestionImport';
import MCQImport from './components/MCQImport/MCQImport';
import Shop from './components/Shop/Shop';
import Roadmap from './components/Roadmap/Roadmap';
import BatchSizeTest from './components/BatchSizeTest/BatchSizeTest';
import TranslationTest from './components/TranslationTest/TranslationTest';
import ChapterOverview from './components/ChapterOverview/ChapterOverview';
import OverviewUpload from './components/OverviewUpload/OverviewUpload';

function App() {
  return (
    <QuestionProvider>
      <PromptProvider>
        <ShopProvider>
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
                <Route path="/import-math" element={<MathQuestionImport />} />
                <Route path="/import-mcq" element={<MCQImport />} />
                <Route path="/prompts" element={<SimplePromptManager />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/batch-test" element={<BatchSizeTest />} />
                <Route path="/translate-test" element={<TranslationTest />} />
                <Route path="/overview" element={<ChapterOverview />} />
                <Route path="/overview-upload" element={<OverviewUpload />} />
              </Routes>
            </div>
          </BrowserRouter>
        </ShopProvider>
      </PromptProvider>
    </QuestionProvider>
  );
}

export default App;
