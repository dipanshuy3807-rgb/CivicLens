import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { acceptIssue, getAuthUser, getVolunteerTasks, rejectIssue } from '../api'

function VolunteerDashboardPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingIssueId, setUpdatingIssueId] = useState(null)
  const currentUser = getAuthUser()
  const needsOnboarding = !currentUser?.onboarding_completed

  useEffect(() => {
    if (needsOnboarding) {
      setLoading(false)
      return undefined
    }

    let isMounted = true

    async function loadTasks() {
      setLoading(true)
      setError('')

      try {
        const assignedTasks = await getVolunteerTasks()
        if (isMounted) {
          setTasks(assignedTasks)
        }
      } catch (taskError) {
        if (isMounted) {
          setError(taskError.message || 'Failed to load assigned tasks.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadTasks()

    return () => {
      isMounted = false
    }
  }, [needsOnboarding])

  async function updateTaskStatus(issueId, action) {
    setUpdatingIssueId(issueId)
    setError('')

    try {
      const response = action === 'accept'
        ? await acceptIssue(issueId)
        : await rejectIssue(issueId)
      setTasks((currentTasks) => replaceIssue(currentTasks, response.issue))
    } catch (taskError) {
      setError(taskError.message || 'Failed to update task.')
    } finally {
      setUpdatingIssueId(null)
    }
  }

  if (needsOnboarding) {
    return <Navigate to="/volunteer/onboarding" replace />
  }

  return (
    <main className="civic-dashboard civic-volunteer-dashboard">
      <aside className="civic-sidebar">
        <div className="civic-brand">
          <span className="civic-brand-mark" />
          <strong>CivicLens</strong>
        </div>

        <nav className="civic-nav" aria-label="Volunteer sections">
          <span className="civic-nav-label">Volunteer</span>
          <button className="civic-nav-item civic-nav-item-active" type="button">
            <span className="civic-nav-icon">T</span>
            Tasks
          </button>
        </nav>

        <div className="civic-sidebar-footer">
          <Link className="civic-link-button" to="/">Back Home</Link>
        </div>
      </aside>

      <section className="civic-workspace">
        <header className="civic-topbar">
          <div>
            <span className="eyebrow">Volunteer Dashboard</span>
            <h1 className="volunteer-page-title">Assigned field tasks</h1>
          </div>
          <div className="civic-user-chip">
            <span>{getInitials(currentUser?.name)}</span>
            <div>
              <strong>{currentUser?.name || 'Volunteer'}</strong>
              <small>{currentUser?.skill || 'Ready'} · {currentUser?.availability || 'Available'}</small>
            </div>
          </div>
        </header>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <section className="civic-panel">
          <PanelHeading
            title="My Tasks"
            meta={loading ? 'Loading...' : `${tasks.length} assigned`}
          />

          <div className="volunteer-task-grid">
            {loading ? (
              <SkeletonList rows={4} />
            ) : tasks.length ? (
              tasks.map((task) => (
                <article className="volunteer-task-card" key={task.id}>
                  <div className="civic-assignment-head">
                    <div>
                      <strong>{task.issue_type}</strong>
                      <span>{task.location || 'Unknown location'} · Priority {task.priority_score}</span>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>

                  <p className="muted-copy">
                    People affected: {task.people_affected ?? 'Unknown'}
                  </p>

                  <div className="task-actions-row">
                    <button
                      className="button task-inline-button"
                      type="button"
                      disabled={updatingIssueId === task.id || task.status === 'accepted'}
                      onClick={() => updateTaskStatus(task.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      className="ghost-button task-inline-button danger-action"
                      type="button"
                      disabled={updatingIssueId === task.id || task.status === 'rejected'}
                      onClick={() => updateTaskStatus(task.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                icon="T"
                message="Assigned issues from NGOs will appear here."
                title="No assigned tasks"
              />
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function StatusBadge({ status }) {
  return <span className={`task-status task-status-${status || 'open'}`}>{status || 'open'}</span>
}

function PanelHeading({ title, meta }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <span className="panel-meta">{meta}</span>
    </div>
  )
}

function EmptyState({ icon, message, title }) {
  return (
    <div className="civic-empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  )
}

function SkeletonList({ rows }) {
  return (
    <div className="civic-skeleton-list">
      {Array.from({ length: rows }).map((_, index) => (
        <span className="civic-skeleton civic-skeleton-row" key={index} />
      ))}
    </div>
  )
}

function replaceIssue(issues, updatedIssue) {
  return issues.map((issue) => (issue.id === updatedIssue.id ? { ...issue, ...updatedIssue } : issue))
}

function getInitials(name) {
  return (name || 'Volunteer')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default VolunteerDashboardPage
