import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  parseOverviewText, 
  validateOverview, 
  overviewToJSON 
} from '../../utils/overviewParser';
import MarkdownContent from '../MarkdownContent/MarkdownContent';

export default function OverviewUpload() {
  const [inputText, setInputText] = useState('');
  const [subject, setSubject] = useState('');
  const [parsedChapters, setParsedChapters] = useState([]); // Array of { name, data }
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = () => {
    try {
      setValidationErrors([]);
      setUploadStatus('');
      
      if (!inputText.trim()) {
        setValidationErrors(['Input text is empty']);
        return;
      }

      const lines = inputText.split('\n');
      const chapters = [];
      
      // Global state for current logical block
      let currentHeader = '';
      let buckets = {
        en: { topics: [], lastNum: 0, titleFallback: '' },
        bn: { topics: [], lastNum: 0, titleFallback: '' }
      };

      const flushBuckets = () => {
        const hasEN = buckets.en.topics.length > 0;
        const hasBN = buckets.bn.topics.length > 0;
        const subjectPrefix = subject.trim() ? `${subject.trim()}: ` : '';

        if (hasEN) {
          const baseName = currentHeader || `Chapter: ${buckets.en.titleFallback}`;
          chapters.push({
            name: hasBN ? `${subjectPrefix}${baseName} (English)` : `${subjectPrefix}${baseName}`,
            data: { topics: [...buckets.en.topics] }
          });
        }
        if (hasBN) {
          const baseName = currentHeader || `Chapter: ${buckets.bn.titleFallback}`;
          chapters.push({
            name: hasEN ? `${subjectPrefix}${baseName} (Bangla)` : `${subjectPrefix}${baseName}`,
            data: { topics: [...buckets.bn.topics] }
          });
        }
        
        // Reset buckets
        buckets = {
          en: { topics: [], lastNum: 0, titleFallback: '' },
          bn: { topics: [], lastNum: 0, titleFallback: '' }
        };
      };

      let activeTopic = null;
      let activeContent = [];

      const saveActiveTopicToBucket = () => {
        if (activeTopic) {
          activeTopic.content = activeContent.join('\n').trim();
          const lang = activeTopic.lang; // 'en' or 'bn'
          buckets[lang].topics.push({
            id: activeTopic.id,
            title: activeTopic.title,
            content: activeTopic.content
          });
          if (!buckets[lang].titleFallback) {
            buckets[lang].titleFallback = activeTopic.title;
          }
          activeTopic = null;
          activeContent = [];
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (!trimmed) continue;

        // 1. Explicit Header Detection (resilient to hashes and bolding)
        // Supports Chapter 1, অধ্যায় ১, অধ্যায় ১, English Version, বাংলা সংস্করণ
        const headerMatch = trimmed.match(/^(?:[#\s*]*)(Chapter\s*[\d০-৯]+|অধ্যায়\s*[\d০-৯]+|অধ্যায়\s*[\d০-৯]+|English\s*Version|বাংলা\s*সংস্করণ)(.*)$/i);
        
        // 2. Topic Marker Detection (T-01, টি-০১, T-01 & T-02)
        // Matches T-01 or টি-০১ with optional ### and **
        const topicMatch = trimmed.match(/^(?:[#\s*]*)((?:T|টি)-[০-৯\d]+(?:\s*&\s*(?:T|টি)-[০-৯\d]+)?)\s*[:：ঃ]\s*(.+)$/i);
        
        // 3. Hard Split Rule
        const isHardSplit = /^[\s\-*#=]{3,}$/.test(trimmed);

        if (headerMatch || isHardSplit) {
          saveActiveTopicToBucket();
          if (headerMatch) {
            // Check if we already have topics in buckets before flushing
            if (buckets.en.topics.length > 0 || buckets.bn.topics.length > 0) {
                flushBuckets();
            }
            const mainHeader = headerMatch[1].replace(/\*+/g, '').trim();
            const subHeader = headerMatch[2].replace(/[#\s*:]+/g, ' ').trim();
            currentHeader = subHeader ? `${mainHeader}: ${subHeader}` : mainHeader;
          } else {
            saveActiveTopicToBucket();
            flushBuckets();
            currentHeader = '';
          }
          continue;
        }

        if (topicMatch) {
          saveActiveTopicToBucket();

          const fullId = topicMatch[1].trim();
          const isBengali = fullId.includes('টি');
          const lang = isBengali ? 'bn' : 'en';
          
          // Extract the first number for restart detection
          const numMatch = fullId.match(/[০-৯\d]+/);
          const numStr = numMatch ? numMatch[0] : '0';
          const bengaliMap = {'০':0,'১':1,'২':2,'৩':3,'৪':4,'৫':5,'৬':6,'৭':7,'৮':8,'৯':9};
          const num = isBengali ? parseInt(numStr.split('').map(c => bengaliMap[c] ?? c).join('')) : parseInt(numStr);

          // Check for Topic Number Restart in the same bucket
          if (buckets[lang].topics.length > 0 && num <= buckets[lang].lastNum && num > 0) {
            flushBuckets();
          }

          activeTopic = {
            id: fullId,
            title: topicMatch[2].replace(/\*+/g, '').trim().replace(/[:：ঃ]$/, ''),
            lang: lang
          };
          buckets[lang].lastNum = num;
          continue;
        }

        // Collect content for the active topic
        if (activeTopic) {
          activeContent.push(line);
        }
      }

      // Final wrap up
      saveActiveTopicToBucket();
      flushBuckets();

      if (chapters.length === 0) {
        setValidationErrors(['No valid chapter overviews found. Ensure topics start with "T-01:" or "টি-০১:"']);
        setParsedChapters([]);
        return;
      }

      setParsedChapters(chapters);
      setShowPreview(true);
      setUploadStatus(`✅ Parsed ${chapters.length} chapter(s) successfully! Review below.`);
    } catch (error) {
      console.error('Parse error:', error);
      setValidationErrors([error.message]);
      setParsedChapters([]);
    }
  };

  const handleUpload = async () => {
    if (parsedChapters.length === 0) {
      setUploadStatus('❌ No data to upload. Please parse the text first.');
      return;
    }

    if (!supabase) {
      setUploadStatus('❌ Supabase is not configured.');
      return;
    }

    try {
      setUploadStatus(`⏳ Uploading ${parsedChapters.length} chapter(s)...`);
      
      const uploadResults = await Promise.all(parsedChapters.map(async (chapter) => {
        const { error } = await supabase
          .from('chapter_overviews')
          .insert([
            {
              name: chapter.name,
              overview_data: chapter.data
            }
          ]);
        return { name: chapter.name, success: !error, error };
      }));

      const failures = uploadResults.filter(r => !r.success);
      
      if (failures.length > 0) {
        const failNames = failures.map(f => f.name).join(', ');
        setUploadStatus(`⚠️ Uploaded with issues. Failed: ${failNames}`);
      } else {
        setUploadStatus(`✅ Successfully uploaded ${parsedChapters.length} chapter(s)!`);
        
        setTimeout(() => {
          setInputText('');
          setParsedChapters([]);
          setShowPreview(false);
          setUploadStatus('');
        }, 3000);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Upload failed: ${error.message}`);
    }
  };

  const handleClear = () => {
    setInputText('');
    setSubject('');
    setParsedChapters([]);
    setValidationErrors([]);
    setUploadStatus('');
    setShowPreview(false);
  };

  const handleNameChange = (index, newName) => {
    setParsedChapters(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: newName };
      return updated;
    });
  };

  const loadExample = () => {
    setInputText(`**English Version (Motion)**
T-01: Types of Motion
Linear, Rotational, Periodic.

T-02: Equations
v = u + at

**বাংলা সংস্করণ (অধ্যায় ২: গতি)**
টি-০১: গতির প্রকারভেদ
রৈখিক, ঘূর্ণন, পর্যায়বৃত্ত।

টি-০২: সমীকরণ
v = u + at`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '10px' }}>📚 Bulk Chapter Overview Upload</h2>
      <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
        Paste multiple chapter overviews. Headers like "English Version" or "Chapter 3" will be used as the overview name.
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth > 1200 ? '1fr 1fr' : '1fr',
        gap: '20px',
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* Left Column - Input */}
        <div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontWeight: '600', color: '#2c3e50', display: 'block', marginBottom: '8px' }}>
                Subject Name (Optional):
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Physics, Biology..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #3498db',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
              <small style={{ color: '#7f8c8d', marginTop: '4px', display: 'block' }}>
                This will be prefixed to each chapter name (e.g. "Biology: Chapter 02")
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontWeight: '600', color: '#2c3e50' }}>
                Paste Overview Text:
              </label>
              <button
                onClick={loadExample}
                style={{
                  padding: '5px 12px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Load Example
              </button>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your versioned chapter overview text here..."
              style={{
                width: '100%',
                minHeight: '400px',
                maxHeight: '600px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={handleParse}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              🔍 Parse & Preview
            </button>
            <button
              onClick={handleUpload}
              disabled={parsedChapters.length === 0}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: parsedChapters.length > 0 ? '#27ae60' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: parsedChapters.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              ⬆️ Upload {parsedChapters.length} Chapters
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '12px 20px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Clear
            </button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div style={{
              backgroundColor: '#ffe6e6',
              border: '1px solid #ffcccc',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#c0392b' }}>❌ Parsing Errors:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((error, index) => (
                  <li key={index} style={{ color: '#c0392b', marginBottom: '5px' }}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus && (
            <div style={{
              backgroundColor: uploadStatus.includes('❌') ? '#ffe6e6' : '#d5f4e6',
              border: `1px solid ${uploadStatus.includes('❌') ? '#ffcccc' : '#b8e6cc'}`, 
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '15px',
              color: uploadStatus.includes('❌') ? '#c0392b' : '#27ae60',
              fontWeight: '500'
            }}>
              {uploadStatus}
            </div>
          )}
        </div>

        {/* Right Column - Preview */}
        <div style={{ overflowY: 'auto', maxHeight: '800px' }}>
          {showPreview && parsedChapters.length > 0 ? (
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>👁️ Bulk Preview:</h3>
              {parsedChapters.map((chapter, cIdx) => (
                <div key={cIdx} style={{ 
                  marginBottom: '30px', 
                  border: '1px solid #3498db', 
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#f0f7ff'
                }}>
                  <div style={{ marginBottom: '15px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
                    <label style={{ fontWeight: 'bold', color: '#2980b9', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                      📦 Overview Name (Editable):
                    </label>
                    <input 
                      type="text" 
                      value={chapter.name} 
                      onChange={(e) => handleNameChange(cIdx, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #3498db',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: '#2c3e50',
                        backgroundColor: 'white',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  {chapter.data.topics.map((topic, tIdx) => (
                    <div key={tIdx} style={{
                      marginBottom: '15px',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <h4 style={{ color: '#2c3e50', marginTop: 0, marginBottom: '8px' }}>
                        {topic.id}: {topic.title}
                      </h4>
                      <MarkdownContent content={topic.content} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              border: '2px dashed #ddd',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              color: '#95a5a6',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📋</div>
                <p>Preview will appear here after parsing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}