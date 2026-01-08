/**
 * Login Component - FINAL WORKING VERSION
 * Uses Supabase Auth directly (no backend routes needed)
 */
import { useState } from 'react';
import { signIn, signUp } from '../services/auth';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up new user
        const result = await signUp(email, password);
        
        if (result.user) {
          // Check if email confirmation is required
          if (result.user.identities && result.user.identities.length === 0) {
            setSuccess('Check your email to confirm your account!');
          } else {
            setSuccess('Account created! You can now sign in.');
          }
          
          // Clear form
          setEmail('');
          setPassword('');
          
          // Switch to login after 2 seconds
          setTimeout(() => {
            setIsSignUp(false);
            setSuccess('');
          }, 2000);
        }
      } else {
        // Sign in existing user
        await signIn(email, password);
        // App.jsx will handle redirect
      }
    } catch (err) {
      console.error('Auth error:', err);
      
      // Better error messages
      let errorMessage = 'Authentication failed';
      
      if (err.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (err.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email first';
      } else if (err.message.includes('User already registered')) {
        errorMessage = 'Email already registered. Try signing in.';
      } else {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>INSTAGRAM AUTOMATION</h1>
        <p style={{ 
          marginBottom: '30px', 
          opacity: 0.7, 
          textAlign: 'center',
          fontSize: '14px'
        }}>
          {isSignUp ? 'Create your account' : 'Sign in to continue'}
        </p>
        
        {error && (
          <div className="error-message">{error}</div>
        )}

        {success && (
          <div style={{
            background: '#fff',
            color: '#000',
            padding: '15px',
            marginBottom: '20px',
            border: '2px solid #fff',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            {isSignUp && (
              <small style={{ opacity: 0.6, fontSize: '11px', marginTop: '5px', display: 'block' }}>
                At least 6 characters
              </small>
            )}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'LOADING...' : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
          </button>
        </form>

        <div className="toggle-auth">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccess('');
            }}
            disabled={loading}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

        {/* Debug info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            border: '1px solid #fff',
            fontSize: '11px',
            opacity: 0.5
          }}>
            <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅' : '❌'}</div>
            <div>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅' : '❌'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;