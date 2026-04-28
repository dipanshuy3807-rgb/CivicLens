import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getAuthUser, updateAuthUser, updateVolunteerProfile } from '../api'

const SKILL_OPTIONS = [
  { label: 'Medical', value: 'medical' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Cleanup', value: 'cleanup' },
  { label: 'Infrastructure', value: 'infrastructure' },
]

const AVAILABILITY_OPTIONS = [
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Weekends', value: 'weekends' },
]

function VolunteerOnboardingPage() {
  const navigate = useNavigate()
  const currentUser = getAuthUser()
  const [form, setForm] = useState({
    skill: currentUser?.skill || 'cleanup',
    location: currentUser?.location || '',
    availability: currentUser?.availability || 'weekends',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (currentUser?.onboarding_completed) {
    return <Navigate to="/volunteer" replace />
  }

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

    if (!form.location.trim()) {
      setError('Location is required so NGOs can match nearby tasks.')
      return
    }

    setSaving(true)
    try {
      const response = await updateVolunteerProfile({
        ...form,
        location: form.location.trim(),
      })
      updateAuthUser(response.user)
      navigate('/volunteer', { replace: true })
    } catch (profileError) {
      setError(profileError.message || 'Failed to save volunteer profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell choice-layout">
      <section className="page-frame auth-card volunteer-onboarding-card">
        <div className="auth-header">
          <span className="eyebrow">Volunteer setup</span>
          <h1>Tell CivicLens where you can help</h1>
          <p className="muted-copy">
            Your profile helps NGOs assign tasks that fit your skill, location, and availability.
          </p>
        </div>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="input-label">
            Skill
            <select className="input-control" value={form.skill} onChange={handleChange('skill')}>
              {SKILL_OPTIONS.map((skill) => (
                <option key={skill.value} value={skill.value}>
                  {skill.label}
                </option>
              ))}
            </select>
          </label>

          <label className="input-label">
            Location
            <input
              className="input-control"
              type="text"
              placeholder="e.g. Vasai East, Mumbai, Pune"
              value={form.location}
              onChange={handleChange('location')}
            />
          </label>

          <label className="input-label">
            Availability
            <select
              className="input-control"
              value={form.availability}
              onChange={handleChange('availability')}
            >
              {AVAILABILITY_OPTIONS.map((availability) => (
                <option key={availability.value} value={availability.value}>
                  {availability.label}
                </option>
              ))}
            </select>
          </label>

          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Continue to Dashboard'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default VolunteerOnboardingPage
