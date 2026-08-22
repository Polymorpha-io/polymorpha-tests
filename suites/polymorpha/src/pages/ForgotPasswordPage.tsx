import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { isFirebaseEnabled } from "@/config/firebase";
import "./AuthPage.css";

export function ForgotPasswordPage() {
  const { resetPassword, loading, error, resetError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      useAuthStore.setState({ error: "Please enter a valid email address." });
      return;
    }
    await resetPassword(email);
    if (!useAuthStore.getState().error) {
      setSent(true);
    }
  };

  if (!isFirebaseEnabled()) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Unavailable</h2>
          <p>Authentication is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Reset password</h2>
        {!sent ? (
          <>
            <p className="auth-subtitle">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    resetError();
                  }}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button
                type="submit"
                className="btn-primary auth-submit"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        ) : (
          <div className="auth-success-block">
            <p className="auth-hint auth-hint--primary">
              Password reset email sent to <strong>{email}</strong>. Check your
              inbox (and spam folder).
            </p>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Send again
            </button>
          </div>
        )}
        <div className="auth-footer">
          <p>
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
