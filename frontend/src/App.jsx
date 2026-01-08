// App.jsx
import { useState, useEffect } from 'react';
import { supabase, getSession } from './services/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './styles/App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session
    getSession().then((session) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!session) {
    return <Login />;  // Use Login.jsx, not RegisterPage.jsx
  }

  return <Dashboard session={session} />;
}

export default App;