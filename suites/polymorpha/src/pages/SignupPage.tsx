import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { isFirebaseEnabled } from "@/config/firebase";
import "./AuthPage.css";

const STORAGE_POLICY_TEXT = `Polymorpha Data Storage Policy (Beta)

By opting in to cloud storage, you agree to the following:

1. What we store — When you choose to save a file, we store the uploaded CSV or Excel dataset and any exported reports (PDF, Excel, CSV, DOCX) in your private Firebase Storage bucket tied to your account.

2. Storage limit — During beta each account may save up to 4 files total, split as 2 uploaded CSV datasets and 2 exported reports. If either category reaches its limit, delete an existing file in that category before saving a new one.

3. Your data stays yours — Your files are accessible only to you. We do not read, analyse, sell, or share your uploaded data with any third party.

4. No server-side processing — All statistical analysis runs entirely in your browser. Saving a file to the cloud is an optional convenience feature; the app works fully without it.

5. Deletion — You may delete any saved file at any time from your profile. Deleting your account removes all associated data permanently.

6. Security — Files are stored in Google Cloud (Firebase Storage) with owner-only access rules. Connections are encrypted in transit (TLS) and data is encrypted at rest.

7. Changes — We may update this policy as the product evolves. Material changes will be communicated through the app.

Last updated: May 2026`;

export function SignupPage() {
  const { user, signUp, signInWithGoogle, loading, error, resetError } =
    useAuthStore();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showSignupToast, setShowSignupToast] = useState(false);
  const [storageConsent, setStorageConsent] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const redirectAfterLogin = () => {
    const redirectUrl = sessionStorage.getItem("polymorpha-redirect");
    sessionStorage.removeItem("polymorpha-redirect");
    navigate(redirectUrl ?? "/");
  };

  useEffect(() => {
    if (!user) return;
    if (signupSuccess) return;
    redirectAfterLogin();
  }, [user, signupSuccess, navigate]);

  useEffect(() => {
    if (!signupSuccess) return;
    setShowSignupToast(true);
    const timer = window.setTimeout(() => setShowSignupToast(false), 6500);
    return () => window.clearTimeout(timer);
  }, [signupSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }

    // Password Policy Enforcement
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setLocalError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setLocalError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setLocalError("Password must contain at least one number.");
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(password)) {
      setLocalError("Password must contain at least one special character.");
      return;
    }

    await signUp(email, password, displayName, "", storageConsent, region);
    if (!useAuthStore.getState().error) {
      setSignupSuccess(true);
    }
  };

  const handleGoogle = async () => {
    await signInWithGoogle();
    if (!useAuthStore.getState().error) {
      redirectAfterLogin();
    }
  };

  if (!isFirebaseEnabled()) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Sign Up</h2>
          <p className="auth-hint">
            Authentication is not configured. Add Firebase credentials to
            appsettings.json to enable sign-up.
          </p>
          <Link to="/" className="back-btn">
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  if (signupSuccess) {
    return (
      <div className="auth-page">
        {showSignupToast && (
          <div
            className="auth-toast auth-toast--success"
            role="status"
            aria-live="polite"
          >
            Verification email sent. Check your inbox and spam/junk folder.
          </div>
        )}
        <div className="auth-card auth-success-card">
          <h2>Check Your Email</h2>
          <p className="auth-subtitle">
            We've sent a verification link to <strong>{email}</strong>. Please
            check your inbox to confirm your account.
          </p>
          <p className="auth-hint auth-hint--primary">
            <strong>Note:</strong> If you don't see the email within a few
            minutes, please check your <strong>spam or junk folder</strong>.
          </p>
          <Link to="/" className="btn-primary auth-cta-btn">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--signup">
        <img
          src="/favicon-blob.svg"
          className="auth-logo"
          alt="Polymorpha Logo"
        />
        <h2>Create your account</h2>
        <p className="auth-subtitle">
          Get started with Polymorpha — free forever with optional upgrades.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="signup-name">Display name</label>
            <input
              id="signup-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Your name"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
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
          <div className="auth-field">
            <label htmlFor="signup-region">Region</label>
            <select
              id="signup-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <option value="" disabled>
                Select your region
              </option>
              <option value="Africa">Africa</option>
              <option value="Asia">Asia</option>
              <option value="Europe">Europe</option>
              <option value="North America">North America</option>
              <option value="South America">South America</option>
              <option value="Oceania">Oceania</option>
              <option value="Middle East">Middle East</option>
            </select>
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError("");
              }}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {password.length > 0 && (
              <ul className="auth-pw-requirements">
                <li className={password.length >= 8 ? "met" : ""}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(password) ? "met" : ""}>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(password) ? "met" : ""}>
                  One lowercase letter
                </li>
                <li className={/[0-9]/.test(password) ? "met" : ""}>
                  One number
                </li>
                <li
                  className={
                    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
                      ? "met"
                      : ""
                  }
                >
                  One special character
                </li>
              </ul>
            )}
          </div>
          <div className="auth-field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setLocalError("");
              }}
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>

          <div className="auth-consent-block">
            <label className="auth-consent-label">
              <input
                type="checkbox"
                checked={storageConsent}
                onChange={(e) => setStorageConsent(e.target.checked)}
              />
              <span>
                I agree to let Polymorpha save up to <strong>4 files</strong> to
                my cloud account during beta (
                <strong>2 uploaded CSV files + 2 exports</strong>).{" "}
                <button
                  type="button"
                  className="auth-policy-toggle"
                  onClick={() => setShowPolicy(!showPolicy)}
                >
                  {showPolicy ? "Hide policy" : "Read data storage policy"}
                </button>
              </span>
            </label>
            {showPolicy && (
              <pre className="auth-policy-text">{STORAGE_POLICY_TEXT}</pre>
            )}
            <p className="auth-consent-note">
              You can use Polymorpha without saving files. Cloud storage is
              optional — all analysis runs locally in your browser.
            </p>
            {storageConsent && (
              <div
                className="auth-consent-preview"
                role="status"
                aria-live="polite"
              >
                <p>
                  Cloud storage enabled — up to 2 uploads + 2 exports. You can
                  delete files anytime from your profile.
                </p>
              </div>
            )}
          </div>

          {(error || localError) && (
            <p className="auth-error">{localError || error}</p>
          )}

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
          <p className="auth-hint">
            After signing up, check your inbox and spam/junk folder for the
            verification email.
          </p>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogle}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
