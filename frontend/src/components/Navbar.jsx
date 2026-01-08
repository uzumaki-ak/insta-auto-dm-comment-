/**
 * Navbar Component - COMPLETE
 */
import { signOut } from '../services/auth';

function Navbar({ session }) {
  const handleSignOut = async () => {
    if (confirm('Sign out?')) {
      try {
        await signOut();
        // App.jsx will handle redirect
      } catch (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out');
      }
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        IG AUTOMATION
      </div>
      
      <div className="navbar-actions">
        <span style={{ fontSize: '12px', opacity: 0.7 }}>
          {session?.user?.email}
        </span>
        <button onClick={handleSignOut} className="secondary">
          Sign Out
        </button>
      </div>
    </nav>
  );
}

export default Navbar;