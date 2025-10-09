import React, { useState } from 'react';
import { translateToBangla, translateEnglishWordsToBangla, autoTranslateToBangla } from '../utils/translateToBangla';

const TranslationExample = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);

  // Example: Translate entire text to Bangla
  const handleFullTranslation = async () => {
    setLoading(true);
    try {
      const result = await translateToBangla(inputText);
      setTranslatedText(result);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Example: Translate only English words within mixed text
  const handleMixedTranslation = async () => {
    setLoading(true);
    try {
      const result = await translateEnglishWordsToBangla(inputText);
      setTranslatedText(result);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Example: Auto-detect and translate
  const handleAutoTranslation = async () => {
    setLoading(true);
    try {
      const result = await autoTranslateToBangla(inputText);
      setTranslatedText(result);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Bangla Translation Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="input-text" style={{ display: 'block', marginBottom: '8px' }}>
          Enter text (mixed Bangla-English):
        </label>
        <textarea
          id="input-text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="e.g., আমি book পড়ছি"
          rows={4}
          style={{ 
            width: '100%', 
            padding: '10px',
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={handleFullTranslation} 
          disabled={loading || !inputText}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Full Translation
        </button>
        
        <button 
          onClick={handleMixedTranslation} 
          disabled={loading || !inputText}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Translate English Words Only
        </button>
        
        <button 
          onClick={handleAutoTranslation} 
          disabled={loading || !inputText}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Auto-Detect & Translate
        </button>
      </div>

      {loading && <p>Translating...</p>}

      {translatedText && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f0f0f0',
          borderRadius: '5px'
        }}>
          <h3>Translated Text:</h3>
          <p style={{ fontSize: '18px', fontFamily: 'Arial, sans-serif' }}>
            {translatedText}
          </p>
        </div>
      )}
    </div>
  );
};

export default TranslationExample;
