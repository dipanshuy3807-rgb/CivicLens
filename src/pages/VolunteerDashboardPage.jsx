import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIssues, matchVolunteers } from '../api'

const ISSUE_SKILL_MAP = {
  'Garbage Overflow': 'cleanup',
  'Water Shortage': 'logistics',
  'Road Damage': 'rescue',
  'Power Issue': 'technical',
  'Sewage Problem': 'cleanup',
}

function VolunteerDashboardPage() {
  const [profile, setProfile] = useState({
    name: '',
    skills: '',
    location: '',
  })
  const [allIssues, setAllIssues] = useState([])
  const [visibleIssues, setVisibleIssues] = useState([])
  const [matchResults, setMatchResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeMatchIssueId, setActiveMatchIssueId] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadIssues() {
      try {
        setLoading(true)
        const issues = await getIssues()
        if (!isMounted) {
          return
        }
        setAllIssues(issues)
        setVisibleIssues(issues)
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Failed to load issues.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadIssues()

    return () => {
      isMounted = false
    }
  }, [])

  const normalizedSkills = useMemo(
    () =>
      profile.skills
        .split(',')
        .map((skill) => skill.trim().toLowerCase())
        .filter(Boolean),
    [profile.skills],
  )

  function handleChange(field) {
    return (event) => {
      setProfile((currentProfile) => ({
        ...currentProfile,
        [field]: event.target.value,
      }))
    }
  }

  function handleSaveProfile(event) {
    event.preventDefault()
    setError('')

    if (!normalizedSkills.length) {
      setVisibleIssues(allIssues)
      return
    }

    const filteredIssues = allIssues.filter((issue) => {
      const requiredSkill = ISSUE_SKILL_MAP[issue.issue_type] || 'general'
      return normalizedSkills.includes(requiredSkill) || normalizedSkills.includes('general')
    })

    setVisibleIssues(filteredIssues)
  }

  async function handleViewMatches(issueId) {
    setError('')
    setActiveMatchIssueId(issueId)

    try {
      const result = await matchVolunteers(issueId)
      setMatchResults((currentMatches) => ({
        ...currentMatches,
        [issueId]: result,
      }))
    } catch (matchError) {
      setError(matchError.message || 'Failed to load volunteer matches.')
    } finally {
      setActiveMatchIssueId(null)
    }
  }

  function handleMarkComplete(issueId) {
    setVisibleIssues((currentIssues) => currentIssues.filter((issue) => issue.id !== issueId))
  }

  return (
    <main className="page-shell dashboard-page">
      <div className="page-frame">
        <header className="dashboard-topbar">
          <div className="section-header">
            <span className="eyebrow">Volunteer Dashboard</span>
            <h1>Stay ready for local response work</h1>
            <p>
              Volunteers can register their skills, update location, and review assigned
              field issues from one simple workspace.
            </p>
          </div>
          <div className="topbar-actions">
            <Link className="ghost-button" to="/">
              Back Home
            </Link>
          </div>
        </header>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <section className="volunteer-layout">
          <div className="form-card">
            <h2>Volunteer Profile</h2>
            <form className="form-stack" onSubmit={handleSaveProfile}>
              <label className="input-label" htmlFor="volunteer-name">
                Name
                <input
                  id="volunteer-name"
                  className="input-control"
                  type="text"
                  placeholder="Your full name"
                  value={profile.name}
                  onChange={handleChange('name')}
                />
              </label>
              <label className="input-label" htmlFor="volunteer-skills">
                Skills
                <input
                  id="volunteer-skills"
                  className="input-control"
                  type="text"
                  placeholder="cleanup, logistics, medical"
                  value={profile.skills}
                  onChange={handleChange('skills')}
                />
              </label>
              <label className="input-label" htmlFor="volunteer-location">
                Location
                <input
                  id="volunteer-location"
                  className="input-control"
                  type="text"
                  placeholder="Virar West"
                  value={profile.location}
                  onChange={handleChange('location')}
                />
              </label>
              <button className="button" type="submit">
                Save Profile
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="panel-heading">
              <h2>Assigned Issues</h2>
              <span className="panel-meta">
                {loading ? 'Loading issues...' : `${visibleIssues.length} visible`}
              </span>
            </div>
            <div className="volunteer-list volunteer-scroll-list">
              {loading ? (
                <p className="placeholder-copy">Loading issues...</p>
              ) : visibleIssues.length ? (
                visibleIssues.map((issue) => {
                  const matches = matchResults[issue.id]
                  return (
                    <article className="task-item" key={issue.id}>
                      <h3>{issue.issue_type}</h3>
                      <p className="task-meta">
                        {issue.location || 'Unknown location'} · Priority {issue.priority_score}
                      </p>
                      <p className="muted-copy">
                        Required skill: {ISSUE_SKILL_MAP[issue.issue_type] || 'general'}
                      </p>
                      <div className="task-actions-row">
                        <button
                          className="ghost-button task-inline-button"
                          type="button"
                          onClick={() => handleViewMatches(issue.id)}
                          disabled={activeMatchIssueId === issue.id}
                        >
                          {activeMatchIssueId === issue.id ? 'Loading...' : 'View Matches'}
                        </button>
                        <button
                          className="button task-inline-button"
                          type="button"
                          onClick={() => handleMarkComplete(issue.id)}
                        >
                          Mark Complete
                        </button>
                      </div>

                      {matches ? (
                        <div className="match-result-card">
                          <strong>Required Skill: {matches.required_skill}</strong>
                          {matches.matched_volunteers?.length ? (
                            <ul className="match-list">
                              {matches.matched_volunteers.map((volunteer) => (
                                <li key={volunteer.id}>
                                  {volunteer.name} · {volunteer.location} ·{' '}
                                  {(volunteer.skills || []).join(', ')}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted-copy">No volunteer matches returned yet.</p>
                          )}
                        </div>
                      ) : null}
                    </article>
                  )
                })
              ) : (
                <p className="placeholder-copy">
                  No matched issues yet. Save a profile with skills to filter assignments.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default VolunteerDashboardPage
