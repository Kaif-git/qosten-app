import React, { useState } from 'react';
import { translateEnglishWordsToBangla, autoTranslateToBangla } from '../../utils/translateToBangla';

export default function TranslationTest() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      alert('Please enter some text to translate.');
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateEnglishWordsToBangla(inputText);
      setTranslatedText(translated);
    } catch (error) {
      console.error('Translation error:', error);
      alert('❌ Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAutoTranslate = async () => {
    if (!inputText.trim()) {
      alert('Please enter some text to translate.');
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await autoTranslateToBangla(inputText);
      setTranslatedText(translated);
    } catch (error) {
      console.error('Translation error:', error);
      alert('❌ Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const clearAll = () => {
    setInputText('');
    setTranslatedText('');
  };

  const copyTranslation = () => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText);
      alert('✅ Translated text copied to clipboard!');
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '1000px', margin: '20px auto' }}>
      <h2>🌐 Translation Testing Tool</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Test the Google Translate integration. Enter text with mixed English-Bangla and see it translated.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Input Section */}
        <div>
          <label htmlFor="inputText" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
            Input Text (English or Mixed):
          </label>
          <textarea
            id="inputText"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter text here... e.g., 'আমি book পড়ছি' or 'What is Newton's First Law?'"
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '12px',
              fontSize: '16px',
              fontFamily: 'Arial, sans-serif',
              border: '2px solid #ddd',
              borderRadius: '8px',
              resize: 'vertical'
            }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Characters: {inputText.length}
          </div>
        </div>

        {/* Output Section */}
        <div>
          <label htmlFor="outputText" style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
            Translated Text (Bangla):
          </label>
          <textarea
            id="outputText"
            value={translatedText}
            readOnly
            placeholder="Translation will appear here..."
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '12px',
              fontSize: '16px',
              fontFamily: 'Arial, sans-serif',
              border: '2px solid #28a745',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa',
              resize: 'vertical'
            }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Characters: {translatedText.length}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: isTranslating || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: isTranslating || !inputText.trim() ? 0.6 : 1
          }}
        >
          {isTranslating ? '⏳ Translating...' : '🌐 Translate English Words → Bangla'}
        </button>

        <button
          onClick={handleAutoTranslate}
          disabled={isTranslating || !inputText.trim()}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            cursor: isTranslating || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: isTranslating || !inputText.trim() ? 0.6 : 1
          }}
        >
          {isTranslating ? '⏳ Translating...' : '🔄 Auto-Translate All'}
        </button>

        <button
          onClick={copyTranslation}
          disabled={!translatedText}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            padding: '12px 24px',
            fontSize: '16px',
            border: 'none',
            borderRadius: '6px',
            cursor: !translatedText ? 'not-allowed' : 'pointer',
            opacity: !translatedText ? 0.6 : 1
          }}
        >
          📋 Copy Translation
        </button>

        <button
          onClick={clearAll}
          className="danger"
          style={{
            padding: '12px 24px',
            fontSize: '16px'
          }}
        >
          🗑️ Clear All
        </button>
      </div>

      {/* Info Box */}
      <div style={{
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '8px',
        padding: '15px',
        marginTop: '20px'
      }}>
        <h3 style={{ marginTop: 0, color: '#0056b3' }}>ℹ️ How to Use:</h3>
        <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
          <li><strong>Translate English Words → Bangla:</strong> Only translates English words in mixed text, keeps existing Bangla words unchanged.</li>
          <li><strong>Auto-Translate All:</strong> Translates the entire text to Bangla, regardless of the source language.</li>
          <li>Free Google Translate API - No API key required!</li>
          <li>Works best with complete sentences for better context.</li>
        </ul>
      </div>

      {/* Examples */}
      <div style={{ marginTop: '30px' }}>
        <h3>📝 Example Inputs to Try:</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => setInputText('আমি book পড়ছি এবং coffee খাচ্ছি')}
            style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              padding: '10px',
              textAlign: 'left',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <strong>Mixed:</strong> আমি book পড়ছি এবং coffee খাচ্ছি
          </button>
          <button
            onClick={() => setInputText('What is Newton\'s First Law of Motion?')}
            style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              padding: '10px',
              textAlign: 'left',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <strong>English:</strong> What is Newton's First Law of Motion?
          </button>
          <button
            onClick={() => setInputText('The mitochondria is the powerhouse of the cell.')}
            style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              padding: '10px',
              textAlign: 'left',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <strong>Science:</strong> The mitochondria is the powerhouse of the cell.
          </button>
        </div>
      </div>
    </div>
  );
}
