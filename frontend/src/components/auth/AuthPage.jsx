import { useState } from 'react';
import { ArrowRight, BookOpen, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';

function AuthPage({ auth }) {
  const [mode, setMode] = useState('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  function switchMode(nextMode) {
    setMode(nextMode);
    setFormError('');
    auth.clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (isSignUp && password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await auth.signUp({ name, email, password });
      } else {
        await auth.signIn({ email, password });
      }
    } catch {
      // The hook provides the server's safe message below the form.
    } finally {
      setSubmitting(false);
    }
  }

  const visibleError = formError || auth.error;

  return (
    <main className="auth-shell">
      <section className="auth-hero" aria-label="About CloudMentor">
        <div className="auth-hero__brand">
          <img src="/assets/cloud_mentor.png" alt="CloudMentor" />
          <span>CloudMentor</span>
        </div>

        <div className="auth-hero__content">
          <span className="auth-hero__eyebrow"><Sparkles size={15} /> Your calm study space</span>
          <h1>Learn with a little more clarity every day.</h1>
          <p>Turn your notes and questions into explanations, interactive quizzes, flashcards, and study plans.</p>
        </div>

        <div className="auth-hero__features" aria-label="CloudMentor features">
          <div><BookOpen size={19} /><span>Guided explanations</span></div>
          <div><Sparkles size={19} /><span>Personal learning assets</span></div>
          <div><LockKeyhole size={19} /><span>Your workspace stays yours</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card__mobile-brand">
            <img src="/assets/cloud_mentor.png" alt="CloudMentor" />
            <span>CloudMentor</span>
          </div>
          <span className="auth-card__eyebrow">Welcome to your workspace</span>
          <h2>{isSignUp ? 'Create your account' : 'Sign in to CloudMentor'}</h2>
          <p>{isSignUp ? 'Start saving your study work in one private place.' : 'Pick up right where you left off.'}</p>

          <div className="auth-mode-switch" role="tablist" aria-label="Account action">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignUp}
              className={!isSignUp ? 'is-active' : ''}
              onClick={() => switchMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignUp}
              className={isSignUp ? 'is-active' : ''}
              onClick={() => switchMode('sign-up')}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <label>
                <span>Your name</span>
                <div className="auth-input">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we call you?"
                    autoComplete="name"
                    maxLength="60"
                  />
                </div>
              </label>
            )}

            <label>
              <span>Email address</span>
              <div className="auth-input">
                <Mail size={18} aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="auth-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength="8"
                  required
                />
              </div>
            </label>

            {isSignUp && (
              <label>
                <span>Confirm password</span>
                <div className="auth-input">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                </div>
              </label>
            )}

            {visibleError && <p className="auth-form__error" role="alert">{visibleError}</p>}

            <button type="submit" className="auth-submit" disabled={submitting}>
              <span>{submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</span>
              {!submitting && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <p className="auth-card__fine-print">Your access token stays short lived. A secure HTTP-only refresh cookie keeps your session active.</p>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;
