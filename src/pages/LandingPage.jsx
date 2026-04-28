import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Boxes,
  FileText,
  GitBranch,
  Inbox,
  MessageSquareText,
  Radar,
  ShieldCheck,
} from 'lucide-react'
import styles from './LandingPage.module.css'

const FEATURES = [
  {
    icon: Radar,
    title: 'Task Tracking',
    description: 'Prioritize civic reports, assign owners, and keep every response moving from intake to resolution.',
  },
  {
    icon: MessageSquareText,
    title: 'Real-time Chat',
    description: 'Coordinate NGOs, field teams, and volunteers with context-rich updates around active issues.',
  },
  {
    icon: FileText,
    title: 'Document Management',
    description: 'Upload reports, OCR scans, and field notes so teams can turn messy documents into structured action.',
  },
  {
    icon: ShieldCheck,
    title: 'Issue Tracker',
    description: 'Map severity, impact, and location data into a clean operational view for faster decisions.',
  },
  {
    icon: Inbox,
    title: 'Team Inbox',
    description: 'Centralize incoming reports and triage the most urgent community needs before they get lost.',
  },
  {
    icon: GitBranch,
    title: 'Integrations',
    description: 'Connect civic workflows with maps, NLP, geocoding, volunteer matching, and your existing stack.',
  },
]

const TRUSTED_TEAMS = ['UrbanAid', 'ReliefGrid', 'OpenWard', 'CivicOps', 'FieldSync', 'MetroCare']

function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll('[data-reveal]'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.18 },
    )

    revealTargets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  return (
    <main className={styles.page}>
      <nav className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`}>
        <Link className={styles.logo} to="/">
          <span className={styles.logoMark}>CL</span>
          <span>CivicLens</span>
        </Link>

        <div className={styles.navLinks} aria-label="Primary navigation">
          <a href="#pricing">Pricing</a>
          <a href="#features">Features</a>
          <a href="#community">Community</a>
          <a href="#download">Download</a>
        </div>

        <div className={styles.navActions}>
          <Link className={styles.signInButton} to="/login">Sign In</Link>
          <Link className={styles.signUpButton} to="/login">Sign Up</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.beam} aria-hidden="true" />
        <div className={styles.heroAtmosphere} aria-hidden="true" />

        <div className={styles.heroContent}>
          <p className={`${styles.eyebrow} ${styles.heroIntro}`}>Civic command center</p>
          <h1 className={styles.heroTitle}>
            Everything civic teams need to move from report to response.
          </h1>
          <p className={styles.heroText}>
            CivicLens unifies issue intake, OCR, geocoding, heatmaps, volunteer matching, and field task tracking
            in one focused platform for NGOs and response teams.
          </p>
          <Link className={styles.primaryCta} to="/login">
            See in action
            <span aria-hidden="true">{'->'}</span>
          </Link>
        </div>

        <div className={styles.previewShell} data-reveal>
          <div className={styles.previewChrome}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.appPreview}>
            <aside className={styles.previewSidebar}>
              <div className={styles.previewIcon}>CL</div>
              <strong>Tracker</strong>
              <span>Issues</span>
              <span>Inbox</span>
              <span>Teams</span>
            </aside>
            <section className={styles.previewMain}>
              <div className={styles.previewHeader}>
                <div>
                  <span>Your projects / City Response</span>
                  <strong>Live Issues</strong>
                </div>
                <div className={styles.previewAvatars}>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className={styles.previewGrid}>
                <article>
                  <small>Priority</small>
                  <strong>42</strong>
                  <span>active reports</span>
                </article>
                <article>
                  <small>Heatmap</small>
                  <strong>18</strong>
                  <span>mapped hotspots</span>
                </article>
                <article>
                  <small>Volunteers</small>
                  <strong>9</strong>
                  <span>best matches</span>
                </article>
              </div>
            </section>
            <aside className={styles.previewInbox}>
              <strong>Inbox</strong>
              <span>Flood report parsed</span>
              <span>Cleanup crew accepted</span>
              <span>New field note uploaded</span>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.socialProof} id="community" data-reveal>
        <p>Trusted by teams at...</p>
        <div className={styles.marquee} aria-label="Trusted team names">
          <div className={styles.marqueeTrack}>
            {[...TRUSTED_TEAMS, ...TRUSTED_TEAMS].map((team, index) => (
              <span key={`${team}-${index}`}>{team}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionHeader} data-reveal>
          <p className={styles.eyebrow}>One workspace</p>
          <h2>Built for coordinated civic operations.</h2>
          <span>
            Replace disconnected spreadsheets, message threads, and one-off reports with a workflow your whole team can trust.
          </span>
        </div>

        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article className={styles.featureCard} data-reveal key={feature.title}>
                <div className={styles.featureIcon}>
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.bottomCta} id="download" data-reveal>
        <Boxes className={styles.ctaIcon} size={38} strokeWidth={1.5} />
        <h2>Start building with your team today</h2>
        <p>
          Launch a guided civic response workflow for reports, maps, volunteers, and assignments.
        </p>
        <div className={styles.ctaActions}>
          <Link className={styles.primaryCta} to="/login">
            Get Started Free
            <span aria-hidden="true">{'->'}</span>
          </Link>
          <a className={styles.secondaryCta} href="https://github.com" rel="noreferrer" target="_blank">
            View on GitHub
          </a>
        </div>
      </section>

      <footer className={styles.footer} id="pricing">
        <Link className={styles.logo} to="/">
          <span className={styles.logoMark}>CL</span>
          <span>CivicLens</span>
        </Link>
        <div>
          <a href="#features">Features</a>
          <a href="#community">Community</a>
          <Link to="/login">Sign In</Link>
        </div>
        <p>© 2026 CivicLens. Built for teams serving cities and communities.</p>
      </footer>
    </main>
  )
}

export default LandingPage
