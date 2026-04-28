const BASE_URL = 'http://127.0.0.1:8000'
export const AUTH_TOKEN_KEY = 'civiclens_auth_token'
export const AUTH_USER_KEY = 'civiclens_auth_user'

async function request(path, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const headers = new Headers(options.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      detail = data.detail || detail
    } catch {
      // Ignore JSON parsing failures and use the default message.
    }
    throw new Error(detail)
  }

  return response.json()
}

export function saveAuthSession(data) {
  localStorage.setItem(AUTH_TOKEN_KEY, data.token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
}

export function updateAuthUser(user) {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export function getAuthUser() {
  const user = localStorage.getItem(AUTH_USER_KEY)
  if (!user) {
    return null
  }

  try {
    return JSON.parse(user)
  } catch {
    clearAuthSession()
    return null
  }
}

export function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function signupUser(payload) {
  return request('/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function getVolunteerUsers() {
  return request('/auth/volunteers')
}

export function updateVolunteerProfile(payload) {
  return request('/auth/me/volunteer-profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function getIssues() {
  return request('/issues')
}

export function getIssuesByBatch(batchId) {
  return request(`/issues?batch_id=${encodeURIComponent(batchId)}`)
}

export function getHeatmap() {
  return request('/analytics/heatmap')
}

export function getHeatmapByBatch(batchId) {
  return request(`/analytics/heatmap?batch_id=${encodeURIComponent(batchId)}`)
}

export function matchVolunteers(issueId) {
  return request(`/match/${issueId}`)
}

export function assignVolunteer(issueId, volunteerName) {
  return request('/assign-volunteer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      issue_id: issueId,
      volunteer_name: volunteerName,
    }),
  })
}

export function assignIssueToVolunteer(issueId, volunteerId) {
  return request(`/issues/${issueId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      volunteer_id: volunteerId,
    }),
  })
}

export function getVolunteerTasks() {
  return request('/volunteer/tasks')
}

export function acceptIssue(issueId) {
  return request(`/issues/${issueId}/accept`, {
    method: 'POST',
  })
}

export function rejectIssue(issueId) {
  return request(`/issues/${issueId}/reject`, {
    method: 'POST',
  })
}

export function getIssueHistory() {
  return request('/issues/history')
}

export function getIssueHistorySummary() {
  return request('/issues/history/summary')
}

export function uploadIssue(formData) {
  return request('/upload', {
    method: 'POST',
    body: formData,
  })
}
