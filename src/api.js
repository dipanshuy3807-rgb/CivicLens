const BASE_URL = 'http://127.0.0.1:8000'

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)

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
