import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, saveAuthSession, signupUser } from '../api'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ngo',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(field) {
    return (event) => {
      setForm((currentForm) => ({
        ...currentForm,
        [field]: event.target.value,
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const validationError = validateForm(form, mode)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
      }
      const response = mode === 'signup'
        ? await signupUser({
          ...payload,
          name: form.name.trim(),
          role: form.role,
        })
        : await loginUser(payload)

      saveAuthSession(response)
      navigate(getPostAuthPath(response), { replace: true })
    } catch (authError) {
      setError(authError.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={`auth-theme-shell auth-theme-${mode}`}>
      <section className="auth-visual-panel">
        <div className="auth-beam" aria-hidden="true" />
        <strong className="auth-ghost-word" aria-hidden="true">
          {mode === 'login' ? 'Welcome back.' : 'Create.'}
        </strong>
        <div className="auth-highlight-list">
          {(mode === 'login'
            ? ['Secure login', 'Your data, private', 'Always in sync']
            : ['Free to start', 'No credit card', 'Invite your team']
          ).map((highlight) => (
            <span key={highlight}>✦ {highlight}</span>
          ))}
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-brand-row">
          <span className="auth-logo-mark">CL</span>
          <strong>CivicLens</strong>
        </div>

        <div className="auth-header">
          <h1>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h1>
          <p className="muted-copy">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="auth-inline-link"
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        <div className="auth-toggle" aria-label="Authentication mode">
          <button
            className={mode === 'login' ? 'auth-toggle-active' : ''}
            type="button"
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            className={mode === 'signup' ? 'auth-toggle-active' : ''}
            type="button"
            onClick={() => setMode('signup')}
          >
            Signup
          </button>
        </div>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <label className="input-label">
              Name
              <input
                className="input-control"
                type="text"
                placeholder="Your full name"
                value={form.name}
                onChange={handleChange('name')}
              />
            </label>
          ) : null}

          <label className="input-label">
            Email
            <input
              className="input-control"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange('email')}
            />
          </label>

          <label className="input-label">
            Password
            <input
              className="input-control"
              type="password"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={handleChange('password')}
              />
            </label>
          {mode === 'signup' ? (
            <div className={`password-strength strength-${getPasswordStrength(form.password)}`} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {mode === 'signup' ? (
            <label className="input-label">
              Role
              <select className="input-control" value={form.role} onChange={handleChange('role')}>
                <option value="ngo">NGO</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </label>
          ) : null}

          {mode === 'login' ? (
            <a className="forgot-link" href="#forgot-password">Forgot password?</a>
          ) : (
            <label className="terms-row">
              <input type="checkbox" defaultChecked />
              <span>I agree to the CivicLens terms and privacy policy.</span>
            </label>
          )}

          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>
        <div className="oauth-grid">
          <button type="button"><span aria-hidden="true">G</span> Google</button>
          <button type="button"><span aria-hidden="true">GH</span> GitHub</button>
        </div>
      </section>
    </main>
  )
}

function validateForm(form, mode) {
  if (mode === 'signup' && !form.name.trim()) {
    return 'Name is required'
  }

  if (!EMAIL_PATTERN.test(form.email.trim())) {
    return 'Enter a valid email address'
  }

  if (!form.password) {
    return 'Password cannot be empty'
  }

  if (form.password.length < 6) {
    return 'Password must be at least 6 characters'
  }

  return ''
}

function getPostAuthPath(response) {
  if (response.role === 'ngo') {
    return '/ngo'
  }

  return response.user?.onboarding_completed ? '/volunteer' : '/volunteer/onboarding'
}

function getPasswordStrength(password) {
  if (password.length >= 12) {
    return 4
  }
  if (password.length >= 8) {
    return 3
  }
  if (password.length >= 4) {
    return 2
  }
  if (password.length > 0) {
    return 1
  }
  return 0
}

export default LoginPage
