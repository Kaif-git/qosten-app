import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useQuestions } from '../../context/QuestionContext';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, setDeveloperAccess } = useQuestions();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dev');
    }
  }, [isAuthenticated, navigate]);

  const handleDeveloperBypass = () => {
    setDeveloperAccess();
    navigate('/dev');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dev'
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName,
            }
          }
        });
        if (error) throw error;
        if (data?.user && data?.session === null) {
          setMessage('Check your email for the confirmation link!');
        } else {
          navigate('/dev');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dev');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo">🔐</div>
        <h2>EdVenture Developer Portal</h2>
        <p>{isSignUp ? 'Create a new account' : 'Sign in to access developer tools'}</p>
        
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-message">{message}</div>}
        
        <form className="login-form" onSubmit={handleEmailAuth}>
          {isSignUp && (
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                required={isSignUp}
              />
            </div>
          )}
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button type="submit" className="primary-login-btn" disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="login-divider">
          <span>OR</span>
        </div>
        
        <button 
          className="google-login-btn" 
          onClick={handleGoogleLogin} 
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Continue with Google
        </button>
        
        <div className="login-toggle">
          {isSignUp ? (
            <p>Already have an account? <button onClick={() => setIsSignUp(false)}>Sign In</button></p>
          ) : (
            <p>Don't have an account? <button onClick={() => setIsSignUp(true)}>Sign Up</button></p>
          )}
        </div>

        <button 
          className="developer-bypass-btn" 
          onClick={handleDeveloperBypass}
          style={{
            marginTop: '20px',
            background: '#333',
            color: 'white',
            border: 'none',
            padding: '10px',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
            fontWeight: 'bold'
          }}
        >
          Developer Login (Bypass)
        </button>

        <div className="login-footer">
          <p>&copy; {new Date().getFullYear()} EdVenture Qosten</p>
        </div>
      </div>
    </div>
  );
}
