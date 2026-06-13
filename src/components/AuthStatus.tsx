import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function AuthStatus() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <div className="top-auth-bar">
      <div className="auth-status">
        {!user ? (
          <>
            <span className="auth-status-hint">Progress saved on this browser</span>
            <Link to="/login" className="auth-link">
              Sign in to sync
            </Link>
          </>
        ) : (
          <>
            <span className="auth-status-email">{user.email}</span>
            <button
              type="button"
              className="auth-link auth-signout-btn"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
