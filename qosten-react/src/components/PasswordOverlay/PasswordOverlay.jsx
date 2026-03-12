import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function PasswordOverlay() {
  const { isAuthenticated, setAuthenticated, setUser } = useQuestions();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const submit = (e) => {
    if (e) e.preventDefault();
    if (password === 'EdVenture') {
      sessionStorage.setItem('qosten_auth', 'true');
      const devUser = {
        user_id: '00000000-0000-0000-0000-000000000000',
        display_name: 'System Developer',
        username: 'developer',
        account_tier: 'premium'
      };
      setUser(devUser);
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="password-overlay" style={{
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      background: 'rgba(0,0,0,0.9)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 99999
    }}>
      <div className="password-prompt" style={{
        background: '#fff', 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
        textAlign: 'center',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔐</div>
        <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Restricted Access</h2>
        <p style={{ margin: '0 0 25px 0', color: '#666' }}>Please enter the password to enter EdVenture Qosten</p>
        
        <form onSubmit={submit}>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Enter password..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 15px',
              fontSize: '16px',
              borderRadius: '6px',
              border: error ? '2px solid #e74c3c' : '1px solid #ddd',
              marginBottom: '15px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
          {error && <p style={{ color: '#e74c3c', fontSize: '14px', marginTop: '-10px', marginBottom: '15px' }}>Incorrect password. Please try again.</p>}
          <button 
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            Enter Website
          </button>
        </form>
        <p style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
          &copy; {new Date().getFullYear()} EdVenture
        </p>
      </div>
    </div>
  );
}