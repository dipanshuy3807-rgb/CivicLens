import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  getHeatmapByBatch,
  getIssueHistory,
  getIssueHistorySummary,
  getIssuesByBatch,
} from '../api'

ChartJS.register(
  ArcElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const DEFAULT_CENTER = [19.45, 72.81]
const LAST_ISSUE_ID_KEY = 'civiclens_latest_issue_id'
const LAST_UPLOAD_DATA_KEY = 'civiclens_last_upload_data'
const LAST_BATCH_ID_KEY = 'civiclens_latest_batch_id'
const SEVERITY_COLORS = {
  Critical: '#d62828',
  High: '#f77f00',
  Medium: '#fcbf49',
  Low: '#2a9d8f',
}
const STATIC_VOLUNTEERS = [
  { name: 'Rahul', skill: 'cleanup', location: 'Virar West', status: 'available' },
  { name: 'Priya', skill: 'water', location: 'Nallasopara', status: 'busy' },
  { name: 'Amit', skill: 'road', location: 'Vasai', status: 'available' },
  { name: 'Sneha', skill: 'cleanup', location: 'Virar East', status: 'available' },
  { name: 'Karan', skill: 'power', location: 'Vasai East', status: 'available' },
  { name: 'Meera', skill: 'sewage', location: 'Virar West', status: 'available' },
]
const ISSUE_SKILL_MAP = {
  'Garbage Overflow': 'cleanup',
  'Water Shortage': 'water',
  'Road Damage': 'road',
  'Power Issue': 'power',
  'Sewage Problem': 'sewage',
}

let leafletAssetsPromise

function loadLeafletAssets() {
  if (window.L && window.L.heatLayer) {
    return Promise.resolve(window.L)
  }

  if (!leafletAssetsPromise) {
    leafletAssetsPromise = new Promise((resolve, reject) => {
      ensureLeafletStyles()

      loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
        .then(() => loadScript('https://unpkg.com/leaflet.heat/dist/leaflet-heat.js'))
        .then(() => {
          if (window.L && window.L.heatLayer) {
            resolve(window.L)
            return
          }
          reject(new Error('Leaflet failed to initialize.'))
        })
        .catch(reject)
    })
  }

  return leafletAssetsPromise
}

function ensureLeafletStyles() {
  if (document.querySelector('link[data-leaflet-style="true"]')) {
    return
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  link.dataset.leafletStyle = 'true'
  document.head.appendChild(link)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`)
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve()
        return
      }
      existingScript.addEventListener('load', resolve, { once: true })
      existingScript.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true'
        resolve()
      },
      { once: true },
    )
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
    document.body.appendChild(script)
  })
}

function NgoDashboardPage() {
  const [issues, setIssues] = useState([])
  const [heatmapPoints, setHeatmapPoints] = useState([])
  const [resolvedIssueIds, setResolvedIssueIds] = useState([])
  const [selectedIssueForAssignment, setSelectedIssueForAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadSummary, setUploadSummary] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [searchIssueId, setSearchIssueId] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyIssues, setHistoryIssues] = useState([])
  const [historySummary, setHistorySummary] = useState(null)
  const [selectedHistoryIssue, setSelectedHistoryIssue] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('All')
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const heatLayerRef = useRef(null)
  const markerLayerRef = useRef(null)

  const latestIssueId = Number(localStorage.getItem(LAST_ISSUE_ID_KEY) || 0) || null
  const currentBatchId = localStorage.getItem(LAST_BATCH_ID_KEY) || null

  useEffect(() => {
    const storedUpload = localStorage.getItem(LAST_UPLOAD_DATA_KEY)
    if (storedUpload) {
      try {
        setUploadSummary(JSON.parse(storedUpload))
      } catch {
        localStorage.removeItem(LAST_UPLOAD_DATA_KEY)
      }
    }
  }, [])

  useEffect(() => {
    void loadCurrentBatchData()
    const intervalId = window.setInterval(() => {
      void loadCurrentBatchData()
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [currentBatchId])

  useEffect(() => {
    if (!historyOpen || historyIssues.length) {
      return
    }

    void loadHistoryData()
  }, [historyOpen])

  useEffect(() => {
    let isMounted = true

    async function initializeMap() {
      try {
        const L = await loadLeafletAssets()
        if (!isMounted || !mapContainerRef.current || mapRef.current) {
          return
        }

        mapRef.current = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, 11)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapRef.current)
        markerLayerRef.current = L.layerGroup().addTo(mapRef.current)
      } catch (mapError) {
        if (isMounted) {
          setError(mapError.message || 'Unable to load heatmap.')
        }
      }
    }

    void initializeMap()

    return () => {
      isMounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      heatLayerRef.current = null
      markerLayerRef.current = null
    }
  }, [])

  const activeIssues = useMemo(
    () => issues.filter((issue) => !resolvedIssueIds.includes(issue.id)),
    [issues, resolvedIssueIds],
  )

  const issueTypes = useMemo(
    () => ['All', ...new Set(activeIssues.map((issue) => issue.issue_type).filter(Boolean))],
    [activeIssues],
  )

  const filteredIssues = useMemo(() => {
    let nextIssues = [...activeIssues]

    if (severityFilter !== 'All') {
      nextIssues = nextIssues.filter((issue) => issue.severity === severityFilter)
    }

    if (typeFilter !== 'All') {
      nextIssues = nextIssues.filter((issue) => issue.issue_type === typeFilter)
    }

    if (searchIssueId.trim()) {
      nextIssues = nextIssues.filter((issue) => String(issue.id) === searchIssueId.trim())
    }

    return nextIssues.sort((left, right) => Number(right.priority_score) - Number(left.priority_score))
  }, [activeIssues, severityFilter, typeFilter, searchIssueId])

  const urgentIssues = useMemo(() => filteredIssues.slice(0, 3), [filteredIssues])

  const metrics = useMemo(() => {
    const totalIssues = activeIssues.length
    const highPriorityIssues = activeIssues.filter((issue) => Number(issue.priority_score) > 600).length
    const latestIssue =
      activeIssues.find((issue) => issue.id === latestIssueId) ||
      uploadSummary?.created_issues?.[0] ||
      activeIssues[0] ||
      null

    return { totalIssues, highPriorityIssues, latestIssue }
  }, [activeIssues, latestIssueId, uploadSummary])

  const insights = useMemo(() => {
    if (!activeIssues.length) {
      return []
    }

    const issueTypeCounts = countBy(activeIssues, (issue) => issue.issue_type || 'Unknown')
    const locationCounts = countBy(activeIssues, (issue) => issue.location || 'Unknown')
    const topIssueType = getTopEntry(issueTypeCounts)
    const topLocation = getTopEntry(locationCounts)
    const highPriorityCount = activeIssues.filter((issue) => Number(issue.priority_score) > 600).length

    return [
      `${topIssueType.key} is the most common issue`,
      `${topLocation.key} is the most affected area`,
      `${highPriorityCount} high priority issues currently need attention`,
    ]
  }, [activeIssues])

  const selectedVolunteerMatches = useMemo(() => {
    if (!selectedIssueForAssignment) {
      return []
    }

    const requiredSkill = ISSUE_SKILL_MAP[selectedIssueForAssignment.issue_type] || 'general'
    const normalizedLocation = (selectedIssueForAssignment.location || '').toLowerCase()

    return STATIC_VOLUNTEERS.filter((volunteer) => {
      const matchesSkill = volunteer.skill === requiredSkill
      const matchesLocation = volunteer.location.toLowerCase().includes(normalizedLocation) || normalizedLocation.includes(volunteer.location.toLowerCase())
      return matchesSkill && matchesLocation
    })
  }, [selectedIssueForAssignment])

  const trendChartData = useMemo(() => {
    const countsByDate = countBy(activeIssues, (issue) => formatIssueDate(issue.created_at))
    const labels = Object.keys(countsByDate).sort()

    return {
      labels,
      datasets: [
        {
          label: 'Issues Reported',
          data: labels.map((label) => countsByDate[label]),
          borderColor: '#0e7c86',
          backgroundColor: 'rgba(14, 124, 134, 0.14)',
          fill: true,
          tension: 0.35,
        },
      ],
    }
  }, [activeIssues])

  const categoryChartData = useMemo(() => {
    const countsByType = countBy(activeIssues, (issue) => issue.issue_type || 'Unknown')
    const labels = Object.keys(countsByType)

    return {
      labels,
      datasets: [
        {
          data: labels.map((label) => countsByType[label]),
          backgroundColor: ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#457b9d', '#6c757d'],
          borderWidth: 0,
        },
      ],
    }
  }, [activeIssues])

  const groupedHistory = useMemo(() => {
    const filteredHistory = historyIssues.filter((issue) => {
      if (historyFilter === 'Resolved') {
        return resolvedIssueIds.includes(issue.id)
      }
      return true
    })

    return filteredHistory.reduce((groups, issue) => {
      const batchKey = issue.batch_id || 'legacy'
      if (!groups[batchKey]) {
        groups[batchKey] = []
      }
      groups[batchKey].push(issue)
      return groups
    }, {})
  }, [historyIssues, historyFilter, resolvedIssueIds])

  useEffect(() => {
    if (!mapRef.current || !window.L) {
      return
    }

    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    if (!heatmapPoints.length) {
      return
    }

    const maxIntensity = Math.max(...heatmapPoints.map((point) => Number(point.intensity) || 0), 1)
    const heatData = heatmapPoints
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .map((point) => [
        point.lat,
        point.lng,
        Math.max((Number(point.intensity) || 0) / maxIntensity, 0.15),
      ])

    if (!heatData.length) {
      return
    }

    heatLayerRef.current = window.L.heatLayer(heatData, {
      radius: 32,
      blur: 24,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.2: '#2a9d8f',
        0.5: '#fcbf49',
        0.8: '#f77f00',
        1.0: '#d62828',
      },
    }).addTo(mapRef.current)

    const bounds = window.L.latLngBounds(heatData.map(([lat, lng]) => [lat, lng]))
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.2))
    }
  }, [heatmapPoints])

  useEffect(() => {
    if (!mapRef.current || !window.L || !markerLayerRef.current) {
      return
    }

    markerLayerRef.current.clearLayers()

    filteredIssues
      .filter((issue) => Number.isFinite(issue.latitude) && Number.isFinite(issue.longitude))
      .forEach((issue) => {
        const color = SEVERITY_COLORS[issue.severity] || '#5c677d'
        const marker = window.L.circleMarker([issue.latitude, issue.longitude], {
          radius: 8,
          color: '#1f2a35',
          weight: 1,
          fillColor: color,
          fillOpacity: 0.95,
        })

        marker.bindPopup(`
          <div>
            <strong>${issue.issue_type}</strong><br/>
            Severity: ${issue.severity}<br/>
            People Affected: ${issue.people_affected ?? 'Unknown'}<br/>
            Location: ${issue.location || 'Unknown'}
          </div>
        `)

        markerLayerRef.current.addLayer(marker)
      })
  }, [filteredIssues])

  async function loadCurrentBatchData() {
    if (!currentBatchId) {
      setIssues([])
      setHeatmapPoints([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const [issuesResult, heatmapResult] = await Promise.allSettled([
      getIssuesByBatch(currentBatchId),
      getHeatmapByBatch(currentBatchId),
    ])

    if (issuesResult.status === 'fulfilled') {
      setIssues(issuesResult.value)
    } else {
      setError(issuesResult.reason?.message || 'Failed to load issues.')
    }

    if (heatmapResult.status === 'fulfilled') {
      setHeatmapPoints(heatmapResult.value)
    } else if (issuesResult.status === 'fulfilled') {
      setError(heatmapResult.reason?.message || 'Failed to load heatmap.')
    }

    setLoading(false)
  }

  async function loadHistoryData() {
    setHistoryLoading(true)
    setHistoryError('')

    const [historyResult, summaryResult] = await Promise.allSettled([
      getIssueHistory(),
      getIssueHistorySummary(),
    ])

    if (historyResult.status === 'fulfilled') {
      setHistoryIssues(historyResult.value)
    } else {
      setHistoryError(historyResult.reason?.message || 'Failed to load history.')
    }

    if (summaryResult.status === 'fulfilled') {
      setHistorySummary(summaryResult.value)
    }

    setHistoryLoading(false)
  }

  function handleResolveIssue(issueId) {
    setResolvedIssueIds((currentIds) => [...currentIds, issueId])

    if (selectedIssueForAssignment?.id === issueId) {
      setSelectedIssueForAssignment(null)
    }
  }

  function getPriorityReason(issue) {
    const severityWeight = getSeverityWeight(issue.severity)
    return `Severity weight ${severityWeight} + people affected ${issue.people_affected || 0}`
  }

  return (
    <main className="page-shell dashboard-page">
      <div className="page-frame dashboard-shell">
        <aside className={`history-sidebar ${historyOpen ? 'history-sidebar-open' : ''}`}>
          <div className="history-sidebar-header">
            <button
              className="ghost-button history-toggle"
              type="button"
              onClick={() => setHistoryOpen((currentOpen) => !currentOpen)}
            >
              {historyOpen ? 'Close History' : '📜 View History'}
            </button>
          </div>

          {historyOpen ? (
            <div className="history-sidebar-content">
              <div className="panel-heading">
                <h2>History Panel</h2>
                <span className="panel-meta">Read-only</span>
              </div>

              <div className="history-toolbar">
                <button
                  className={`history-filter-button ${historyFilter === 'All' ? 'history-filter-button-active' : ''}`}
                  type="button"
                  onClick={() => setHistoryFilter('All')}
                >
                  All
                </button>
                <button
                  className={`history-filter-button ${historyFilter === 'Resolved' ? 'history-filter-button-active' : ''}`}
                  type="button"
                  onClick={() => setHistoryFilter('Resolved')}
                >
                  Resolved
                </button>
              </div>

              {historySummary ? (
                <div className="history-summary-card">
                  <strong>{historySummary.total_past_issues} total historical issues</strong>
                  <span>{historySummary.batches?.length || 0} batches recorded</span>
                </div>
              ) : null}

              {historyError ? <div className="feedback-banner error-banner">{historyError}</div> : null}

              <div className="history-list">
                {historyLoading ? (
                  <p className="placeholder-copy">Loading history...</p>
                ) : Object.keys(groupedHistory).length ? (
                  Object.entries(groupedHistory).map(([batchId, batchIssues]) => (
                    <section className="history-batch" key={batchId}>
                      <h3>Batch {batchId}</h3>
                      {batchIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          className={`history-item ${selectedHistoryIssue?.id === issue.id ? 'history-item-active' : ''}`}
                          onClick={() => setSelectedHistoryIssue(issue)}
                        >
                          <strong>{issue.issue_type}</strong>
                          <span>{issue.location || 'Unknown location'}</span>
                          <span>{issue.severity} · {formatIssueDate(issue.created_at)}</span>
                        </button>
                      ))}
                    </section>
                  ))
                ) : (
                  <p className="placeholder-copy">No history available yet.</p>
                )}
              </div>

              {selectedHistoryIssue ? (
                <div className="history-detail-card">
                  <h3>Selected Historical Issue</h3>
                  <p><strong>{selectedHistoryIssue.issue_type}</strong></p>
                  <p>{selectedHistoryIssue.location || 'Unknown location'}</p>
                  <p>{selectedHistoryIssue.severity} · Priority {selectedHistoryIssue.priority_score}</p>
                  <p>{formatIssueDate(selectedHistoryIssue.created_at)}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="section-header">
              <span className="eyebrow">NGO Results</span>
              <h1>Decision-support operations dashboard</h1>
              <p>
                Current batch data stays isolated in the main workspace while the sidebar
                lets you explore historical batches safely.
              </p>
            </div>
            <div className="topbar-actions">
              <Link className="ghost-button" to="/ngo">
                Upload Another
              </Link>
              <Link className="ghost-button" to="/">
                Back Home
              </Link>
            </div>
          </header>

          {error ? <div className="feedback-banner error-banner">{error}</div> : null}

          <section className="dashboard-grid">
            <div className="panel-card urgent-panel">
              <div className="panel-heading">
                <h2>🚨 Urgent Issues – Immediate Attention Required</h2>
                <span className="panel-meta">
                  {loading ? 'Loading...' : `${urgentIssues.length} highlighted`}
                </span>
              </div>
              <div className="urgent-grid">
                {urgentIssues.length ? (
                  urgentIssues.map((issue) => (
                    <article className="urgent-card" key={issue.id}>
                      <strong>{issue.issue_type}</strong>
                      <span>{issue.location || 'Unknown location'}</span>
                      <span>Priority Score: {issue.priority_score}</span>
                    </article>
                  ))
                ) : (
                  <p className="placeholder-copy">No urgent issues available right now.</p>
                )}
              </div>
            </div>

            <div className="stats-grid">
              <article className="dashboard-card">
                <h3>Total Issues</h3>
                <p className="stat-value">{loading ? '...' : metrics.totalIssues}</p>
                <p className="muted-copy">Active issues from the current batch only.</p>
              </article>
              <article className="dashboard-card">
                <h3>High Priority Issues</h3>
                <p className="stat-value">{loading ? '...' : metrics.highPriorityIssues}</p>
                <p className="muted-copy">Current batch issues with priority score above 600.</p>
              </article>
              <article className="dashboard-card">
                <h3>Latest Issue</h3>
                <p className="stat-value stat-value-small">
                  {loading ? '...' : metrics.latestIssue?.issue_type || 'No issue yet'}
                </p>
                <p className="muted-copy">
                  {metrics.latestIssue
                    ? `${metrics.latestIssue.location || 'Unknown'} · Priority ${metrics.latestIssue.priority_score}`
                    : 'Submit a report to see the latest issue details here.'}
                </p>
              </article>
            </div>

            <div className="panel-card filter-panel">
              <div className="panel-heading">
                <h2>Filters + Search</h2>
                <span className="panel-meta">
                  {searchIssueId.trim() && !filteredIssues.length ? '❌ Issue not found' : `${filteredIssues.length} results`}
                </span>
              </div>
              <div className="filters-grid">
                <label className="input-label">
                  Severity
                  <select
                    className="input-control"
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label className="input-label">
                  Issue Type
                  <select
                    className="input-control"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    {issueTypes.map((issueType) => (
                      <option key={issueType} value={issueType}>
                        {issueType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="input-label">
                  Search by Issue ID
                  <input
                    className="input-control"
                    type="text"
                    placeholder="Enter issue ID"
                    value={searchIssueId}
                    onChange={(event) => setSearchIssueId(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-heading">
                <h2>Heatmap + Markers</h2>
                <span className="panel-meta">
                  {loading ? 'Loading...' : `${heatmapPoints.length} hotspots`}
                </span>
              </div>
              <div className="map-panel">
                <div ref={mapContainerRef} className="map-canvas" />
                {!heatmapPoints.length && !loading ? (
                  <div className="map-overlay">No heatmap coordinates available yet.</div>
                ) : null}
              </div>
              <div className="heatmap-legend">
                <span><i className="legend-dot legend-low" /> Low</span>
                <span><i className="legend-dot legend-medium" /> Medium</span>
                <span><i className="legend-dot legend-high" /> High</span>
                <span><i className="legend-dot legend-critical" /> Critical</span>
              </div>
            </div>

            <div className="results-grid">
              <div className="panel-card">
                <div className="panel-heading">
                  <h2>🧠 Insights</h2>
                  <span className="panel-meta">Current batch only</span>
                </div>
                <ul className="insight-list">
                  {insights.length ? (
                    insights.map((insight) => <li key={insight}>{insight}</li>)
                  ) : (
                    <li>No insights available yet.</li>
                  )}
                </ul>
              </div>

              <div className="panel-card">
                <div className="panel-heading">
                  <h2>👥 Volunteer Matching</h2>
                  <span className="panel-meta">
                    {selectedIssueForAssignment
                      ? `${selectedVolunteerMatches.length} local matches`
                      : 'Select an issue'}
                  </span>
                </div>
                {selectedIssueForAssignment ? (
                  <div className="match-result-card match-result-card-large">
                    <strong>{selectedIssueForAssignment.issue_type}</strong>
                    <p className="muted-copy">
                      {selectedIssueForAssignment.location || 'Unknown'} · Required skill:{' '}
                      {ISSUE_SKILL_MAP[selectedIssueForAssignment.issue_type] || 'general'}
                    </p>
                    {selectedVolunteerMatches.length ? (
                      <ul className="match-list">
                        {selectedVolunteerMatches.map((volunteer) => (
                          <li key={`${volunteer.name}-${volunteer.location}`}>
                            <strong>{volunteer.name}</strong>
                            <span>{volunteer.location}</span>
                            <span>Skill match: {volunteer.skill}</span>
                            <span>Status: {volunteer.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted-copy">No local volunteer match found for this issue.</p>
                    )}
                  </div>
                ) : (
                  <p className="placeholder-copy">
                    Click “Assign Volunteer” on an issue to view matching volunteers.
                  </p>
                )}
              </div>
            </div>

            <div className="charts-grid">
              <div className="panel-card">
                <div className="panel-heading">
                  <h2>📈 Issues Reported Over Time</h2>
                  <span className="panel-meta">Current batch trend</span>
                </div>
                {trendChartData.labels.length ? (
                  <Line
                    data={trendChartData}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                    }}
                  />
                ) : (
                  <p className="placeholder-copy">No trend data available yet.</p>
                )}
              </div>

              <div className="panel-card">
                <div className="panel-heading">
                  <h2>📊 Issue Category Breakdown</h2>
                  <span className="panel-meta">Current batch only</span>
                </div>
                {categoryChartData.labels.length ? (
                  <Doughnut
                    data={categoryChartData}
                    options={{
                      responsive: true,
                      plugins: { legend: { position: 'bottom' } },
                    }}
                  />
                ) : (
                  <p className="placeholder-copy">No category data available yet.</p>
                )}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-heading">
                <h2>Issue Management</h2>
                <span className="panel-meta">
                  {loading ? 'Loading...' : `${filteredIssues.length} active issues`}
                </span>
              </div>
              <div className="issue-scroll-list issue-management-list">
                {loading ? (
                  <p className="placeholder-copy">Loading issues...</p>
                ) : filteredIssues.length ? (
                  filteredIssues.map((issue) => (
                    <article className="issue-management-card" key={issue.id}>
                      <div className="issue-row">
                        <div>
                          <h3>{issue.issue_type}</h3>
                          <p className="task-meta">
                            {issue.location || 'Unknown location'} · People affected:{' '}
                            {issue.people_affected ?? 'Unknown'}
                          </p>
                        </div>
                        <div className="issue-row-side">
                          <span className="severity-chip">{issue.severity}</span>
                          <strong>Priority {issue.priority_score}</strong>
                        </div>
                      </div>

                      <div className="priority-reason">
                        <strong>Priority Score: {issue.priority_score}</strong>
                        <p className="muted-copy">Reason: {getPriorityReason(issue)}</p>
                      </div>

                      <div className="task-actions-row">
                        <button
                          className="ghost-button task-inline-button"
                          type="button"
                          onClick={() => setSelectedIssueForAssignment(issue)}
                        >
                          Assign Volunteer
                        </button>
                        <button
                          className="button task-inline-button"
                          type="button"
                          onClick={() => handleResolveIssue(issue.id)}
                        >
                          Mark Resolved
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="placeholder-copy">
                    {searchIssueId.trim() ? '❌ Issue not found' : 'No issues available yet.'}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item)
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
}

function getTopEntry(record) {
  return Object.entries(record).reduce(
    (currentTop, [key, value]) => (value > currentTop.value ? { key, value } : currentTop),
    { key: 'Unknown', value: 0 },
  )
}

function formatIssueDate(createdAt) {
  if (!createdAt) {
    return 'Unknown'
  }

  const parsedDate = new Date(createdAt)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown'
  }

  return parsedDate.toISOString().slice(0, 10)
}

function getSeverityWeight(severity) {
  switch (severity) {
    case 'Critical':
      return 5
    case 'High':
      return 4
    case 'Medium':
      return 3
    default:
      return 1
  }
}

export default NgoDashboardPage
