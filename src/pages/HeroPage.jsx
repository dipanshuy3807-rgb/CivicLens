import { Link } from 'react-router-dom'

function HeroPage() {
  return (
    <main className="page-shell hero-page">
      <section className="page-frame hero-card">
        <span className="eyebrow">CivicLens</span>
        <h1>Turn local reports into coordinated action.</h1>
        <p>
          CivicLens helps NGOs and volunteers track civic issues, understand hotspots,
          and organize field response from one simple dashboard.
        </p>
        <div className="hero-actions">
          <Link className="button" to="/login">
            Login
          </Link>
          <Link className="ghost-button" to="/login">
            Sign Up
          </Link>
        </div>
      </section>
    </main>
  )
}

export default HeroPage
