import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function AuthStatus() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="auth-status">
        <Link to="/login" className="auth-status-link">
          Sign in to sync progress
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-status auth-status-signed-in">
      <span className="auth-status-email">{user.email}</span>
      <button
        type="button"
        className="auth-status-signout"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
