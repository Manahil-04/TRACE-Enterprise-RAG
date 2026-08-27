import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api";
import { LogoMark } from "../components/icons";
import { Notice } from "../components/Notice";

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password);
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <div className="auth-intro-brand">
          <span className="auth-intro-brand-mark">
            <LogoMark />
          </span>
          <span className="auth-intro-brand-text">TRACE</span>
        </div>
        <div className="auth-intro-copy">
          <span className="eyebrow">Knowledge workspace</span>
          <h2 className="heading-display">Knowledge, connected.</h2>
          <p>
            Explore what your organization already knows, with every answer traced back to the
            document it came from.
          </p>
        </div>
        <p className="auth-intro-foot">Self-hosted. Your documents never leave your infrastructure.</p>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <h1>Create an account</h1>
              <p className="auth-subtitle">Join your organization's private knowledge base.</p>
            </div>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error && (
              <Notice type="error" title="Registration failed" message={error} onDismiss={() => setError(null)} />
            )}
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? <span className="spinner" /> : "Create account"}
            </button>
          </form>
          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
