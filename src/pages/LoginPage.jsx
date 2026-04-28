import { Link } from 'react-router-dom'

function LoginPage() {
  return (
    <main className="page-shell choice-layout">
      <section className="page-frame choice-card">
        <span className="eyebrow">Choose Role</span>
        <h1>Sign in to your workspace</h1>
        <p className="muted-copy">
          Pick the experience you want to continue with. This structure is ready for
          real authentication later.
        </p>
        <div className="choice-actions">
          <Link className="button" to="/ngo">
            NGO
          </Link>
          <Link className="ghost-button" to="/volunteer">
            Volunteer
          </Link>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
