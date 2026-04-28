import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import {
  assignIssueToVolunteer,
  assignVolunteer,
  getAuthUser,
  getHeatmapByBatch,
  getIssueHistory,
  getIssuesByBatch,
  getVolunteerUsers,
  matchVolunteers,
} from '../api'

ChartJS.register(ArcElement, CategoryScale, Legend, LinearScale, Tooltip)

const MAP_INITIAL_CENTER = [20.5937, 78.9629]
const LAST_BATCH_ID_KEY = 'civiclens_latest_batch_id'
const NAV_ITEMS = [
  { label: 'Overview', icon: 'O' },
  { label: 'Heatmap', icon: 'H' },
  { label: 'Volunteers', icon: 'V' },
  { label: 'History', icon: 'R' },
]
const HIGH_PRIORITY_THRESHOLD = 600
const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f59e0b',
  Medium: '#6366f1',
  Low: '#22c55e',
}
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
  const [activeTab, setActiveTab] = useState('Overview')
  const [issues, setIssues] = useState([])
  const [heatmapPoints, setHeatmapPoints] = useState([])
  const [historyIssues, setHistoryIssues] = useState([])
  const [volunteerMatchesByIssueId, setVolunteerMatchesByIssueId] = useState({})
  const [volunteerUsers, setVolunteerUsers] = useState([])
  const [selectedVolunteerByIssueId, setSelectedVolunteerByIssueId] = useState({})
  const [matchingLoadingIds, setMatchingLoadingIds] = useState([])
  const [assigningIssueIds, setAssigningIssueIds] = useState([])
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [searchIssueId, setSearchIssueId] = useState('')
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [assignmentNotice, setAssignmentNotice] = useState('')
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const heatLayerRef = useRef(null)
  const markerLayerRef = useRef(null)

  const currentBatchId = localStorage.getItem(LAST_BATCH_ID_KEY) || null
  const currentUser = getAuthUser()

  useEffect(() => {
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
        setError(issuesResult.reason?.message || 'Failed to load current batch issues.')
      }

      if (heatmapResult.status === 'fulfilled') {
        setHeatmapPoints(heatmapResult.value)
      } else if (issuesResult.status === 'fulfilled') {
        setError(heatmapResult.reason?.message || 'Failed to load heatmap.')
      }

      setLoading(false)
    }

    void loadCurrentBatchData()
    const intervalId = window.setInterval(() => {
      void loadCurrentBatchData()
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [currentBatchId])

  useEffect(() => {
    if (activeTab !== 'History' || historyIssues.length) {
      return
    }

    async function loadHistoryData() {
      setHistoryLoading(true)
      setHistoryError('')

      try {
        const history = await getIssueHistory()
        setHistoryIssues(sortIssuesByDate(history))
      } catch (historyLoadError) {
        setHistoryError(historyLoadError.message || 'Failed to load history.')
      } finally {
        setHistoryLoading(false)
      }
    }

    void loadHistoryData()
  }, [activeTab, historyIssues.length])

  useEffect(() => {
    if (activeTab !== 'Heatmap') {
      return undefined
    }

    let isMounted = true

    async function initializeMap() {
      try {
        const L = await loadLeafletAssets()
        if (!isMounted || !mapContainerRef.current || mapRef.current) {
          return
        }

        mapRef.current = L.map(mapContainerRef.current).setView(MAP_INITIAL_CENTER, 5)
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
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'Heatmap' || !mapRef.current || !window.L) {
      return
    }

    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    const heatData = buildHeatData(heatmapPoints)
    if (!heatData.length) {
      return
    }

    heatLayerRef.current = window.L.heatLayer(heatData, {
      radius: 34,
      blur: 24,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.2: '#22c55e',
        0.5: '#6366f1',
        0.8: '#f59e0b',
        1.0: '#ef4444',
      },
    }).addTo(mapRef.current)
  }, [activeTab, heatmapPoints])

  useEffect(() => {
    if (activeTab !== 'Heatmap' || !mapRef.current || !window.L || !markerLayerRef.current) {
      return
    }

    markerLayerRef.current.clearLayers()
    const mappedIssues = issues.filter(hasCoordinates)

    mappedIssues.forEach((issue) => {
      const color = SEVERITY_COLORS[issue.severity] || '#5c677d'
      const marker = window.L.circleMarker([Number(issue.latitude), Number(issue.longitude)], {
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

    const heatData = buildHeatData(heatmapPoints)
    const boundsPoints = mappedIssues.map((issue) => [Number(issue.latitude), Number(issue.longitude)])
    const heatPoints = heatData.map(([lat, lng]) => [lat, lng])
    const allPoints = [...boundsPoints, ...heatPoints]

    if (allPoints.length) {
      const bounds = window.L.latLngBounds(allPoints)
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.18))
      }
    }
  }, [activeTab, heatmapPoints, issues])

  useEffect(() => {
    if (activeTab !== 'Volunteers') {
      return
    }

    getVolunteerUsers()
      .then(setVolunteerUsers)
      .catch((volunteerLoadError) => {
        setError(volunteerLoadError.message || 'Failed to load volunteers.')
      })

    const missingIssueIds = issues
      .map((issue) => issue.id)
      .filter(
        (issueId) =>
          !volunteerMatchesByIssueId[issueId] && !matchingLoadingIds.includes(issueId),
      )

    missingIssueIds.forEach((issueId) => {
      setMatchingLoadingIds((currentIds) => (
        currentIds.includes(issueId) ? currentIds : [...currentIds, issueId]
      ))

      matchVolunteers(issueId)
        .then((matchResult) => {
          setVolunteerMatchesByIssueId((currentMatches) => ({
            ...currentMatches,
            [issueId]: matchResult,
          }))
        })
        .catch((matchError) => {
          setError(matchError.message || 'Failed to load volunteer matches.')
        })
        .finally(() => {
          setMatchingLoadingIds((currentIds) => (
            currentIds.filter((currentId) => currentId !== issueId)
          ))
        })
    })
  }, [activeTab, issues, matchingLoadingIds, volunteerMatchesByIssueId])

  const sortedIssues = useMemo(
    () => [...issues].sort((left, right) => Number(right.priority_score) - Number(left.priority_score)),
    [issues],
  )
  const topIssues = useMemo(() => sortedIssues.slice(0, 5), [sortedIssues])
  const metrics = useMemo(() => {
    const totalIssues = issues.length
    const highPriorityIssues = issues.filter((issue) => Number(issue.priority_score) > HIGH_PRIORITY_THRESHOLD).length
    const totalPeopleAffected = issues.reduce(
      (total, issue) => total + Number(issue.people_affected || 0),
      0,
    )

    return { totalIssues, highPriorityIssues, totalPeopleAffected }
  }, [issues])
  const issueTypeCounts = useMemo(
    () => countBy(issues, (issue) => issue.issue_type || 'Unknown'),
    [issues],
  )
  const locationCounts = useMemo(
    () => countBy(issues, (issue) => issue.location || 'Unknown'),
    [issues],
  )
  const mostCommonIssue = getTopEntry(issueTypeCounts)
  const mostAffectedLocation = getTopEntry(locationCounts)
  const issueChartData = useMemo(() => {
    const labels = Object.keys(issueTypeCounts)

    return {
      labels,
      datasets: [
        {
          data: labels.map((label) => issueTypeCounts[label]),
          backgroundColor: ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'],
          borderWidth: 0,
        },
      ],
    }
  }, [issueTypeCounts])

  function openSearchResult() {
    const issue = issues.find((currentIssue) => String(currentIssue.id) === searchIssueId.trim())
    if (issue) {
      setSelectedIssue(issue)
    }
  }

  if (!currentBatchId) {
    return <Navigate to="/ngo" replace />
  }

  async function handleAssignVolunteer(issue, volunteerName) {
    const isReassignment = Boolean(issue.assigned_volunteer)
    const confirmed = window.confirm(
      isReassignment
        ? `Reassign issue ${issue.id} from ${issue.assigned_volunteer} to ${volunteerName}?`
        : `Assign ${volunteerName} to issue ${issue.id}?`,
    )

    if (!confirmed) {
      return
    }

    setAssigningIssueIds((currentIds) => (
      currentIds.includes(issue.id) ? currentIds : [...currentIds, issue.id]
    ))
    setAssignmentNotice('')
    setError('')

    try {
      const response = await assignVolunteer(issue.id, volunteerName)
      const updatedIssue = response.issue

      setIssues((currentIssues) => replaceIssue(currentIssues, updatedIssue))
      setHistoryIssues((currentIssues) => replaceIssue(currentIssues, updatedIssue))
      setSelectedIssue((currentIssue) => (
        currentIssue?.id === updatedIssue.id ? updatedIssue : currentIssue
      ))
      setAssignmentNotice(`Assigned to: ${updatedIssue.assigned_volunteer}`)
    } catch (assignmentError) {
      setError(assignmentError.message || 'Failed to assign volunteer.')
    } finally {
      setAssigningIssueIds((currentIds) => currentIds.filter((currentId) => currentId !== issue.id))
    }
  }

  async function handleAssignUserVolunteer(issue, volunteerId) {
    const numericVolunteerId = Number(volunteerId)
    if (!numericVolunteerId) {
      setError('Select a volunteer before assigning.')
      return
    }

    setAssigningIssueIds((currentIds) => (
      currentIds.includes(issue.id) ? currentIds : [...currentIds, issue.id]
    ))
    setAssignmentNotice('')
    setError('')

    try {
      const response = await assignIssueToVolunteer(issue.id, numericVolunteerId)
      const updatedIssue = response.issue

      setIssues((currentIssues) => replaceIssue(currentIssues, updatedIssue))
      setHistoryIssues((currentIssues) => replaceIssue(currentIssues, updatedIssue))
      setSelectedIssue((currentIssue) => (
        currentIssue?.id === updatedIssue.id ? updatedIssue : currentIssue
      ))
      setAssignmentNotice(`Assigned to: ${updatedIssue.assigned_volunteer}`)
    } catch (assignmentError) {
      setError(assignmentError.message || 'Failed to assign volunteer.')
    } finally {
      setAssigningIssueIds((currentIds) => currentIds.filter((currentId) => currentId !== issue.id))
    }
  }

  return (
    <main className="civic-dashboard">
      <aside className="civic-sidebar">
        <div className="civic-brand">
          <span className="civic-brand-mark" />
          <strong>CivicLens</strong>
        </div>

        <nav className="civic-nav" aria-label="Dashboard sections">
          <span className="civic-nav-label">Dashboard</span>
          {NAV_ITEMS.map((item) => (
            <button
              className={`civic-nav-item ${activeTab === item.label ? 'civic-nav-item-active' : ''}`}
              key={item.label}
              type="button"
              onClick={() => setActiveTab(item.label)}
            >
              <span className="civic-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="civic-sidebar-footer">
          <Link className="civic-link-button" to="/ngo">Upload</Link>
          <Link className="civic-link-button" to="/">Back Home</Link>
        </div>
      </aside>

      <section className="civic-workspace">
        <header className="civic-topbar">
          <label className="civic-topbar-search">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search current batch by issue ID"
              value={searchIssueId}
              onChange={(event) => setSearchIssueId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  openSearchResult()
                }
              }}
            />
          </label>

          <div className="civic-topbar-actions">
            <button className="civic-notification-button" type="button" aria-label="Notifications">
              <span />
            </button>
            <div className="civic-user-chip">
              <span>NG</span>
              <div>
                <strong>{currentUser?.name || 'NGO Admin'}</strong>
                <small>{currentBatchId ? `Batch ${currentBatchId}` : 'No active batch'}</small>
              </div>
            </div>
          </div>
        </header>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}
        {assignmentNotice ? <div className="feedback-banner success-banner">{assignmentNotice}</div> : null}

        <div className="civic-content">
          {activeTab === 'Overview' ? (
            <OverviewTab
              issueChartData={issueChartData}
              loading={loading}
              metrics={metrics}
              mostAffectedLocation={mostAffectedLocation}
              mostCommonIssue={mostCommonIssue}
              onOpenIssue={setSelectedIssue}
              onSearch={openSearchResult}
              searchIssueId={searchIssueId}
              topIssues={topIssues}
            />
          ) : null}

          {activeTab === 'Heatmap' ? (
            <HeatmapTab
              heatmapPoints={heatmapPoints}
              issues={issues}
              loading={loading}
              mapContainerRef={mapContainerRef}
            />
          ) : null}

          {activeTab === 'Volunteers' ? (
            <VolunteersTab
              assigningIssueIds={assigningIssueIds}
              issues={sortedIssues}
              loading={loading}
              matchingLoadingIds={matchingLoadingIds}
              onAssignVolunteer={handleAssignVolunteer}
              onAssignUserVolunteer={handleAssignUserVolunteer}
              selectedVolunteerByIssueId={selectedVolunteerByIssueId}
              setSelectedVolunteerByIssueId={setSelectedVolunteerByIssueId}
              volunteerUsers={volunteerUsers}
              volunteerMatchesByIssueId={volunteerMatchesByIssueId}
            />
          ) : null}

          {activeTab === 'History' ? (
            <HistoryTab
              historyError={historyError}
              historyIssues={historyIssues}
              historyLoading={historyLoading}
              onOpenIssue={setSelectedIssue}
            />
          ) : null}
        </div>
      </section>

      {selectedIssue ? (
        <IssueDetailPanel issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
      ) : null}
    </main>
  )
}

function OverviewTab({
  issueChartData,
  loading,
  metrics,
  mostAffectedLocation,
  mostCommonIssue,
  onOpenIssue,
  onSearch,
  searchIssueId,
  topIssues,
}) {
  return (
    <div className="civic-tab civic-overview-grid">
      <section className="civic-kpi-grid">
        <KpiCard context="Current batch" label="Total Issues" loading={loading} trend="+5%" value={metrics.totalIssues} />
        <KpiCard context="Priority above threshold" label="High Priority Issues" loading={loading} trend="-2%" value={metrics.highPriorityIssues} />
        <KpiCard context="Reported impact" label="Total People Affected" loading={loading} trend="+8%" value={metrics.totalPeopleAffected} />
      </section>

      <section className="civic-panel civic-chart-panel">
        <PanelHeading title="Total Issues" meta="By category" />
        {issueChartData.labels.length ? (
          <Doughnut
            data={issueChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
            }}
          />
        ) : (
          <EmptyState icon="C" message="Issue categories will appear once this batch has reports." title="No issue data" />
        )}
      </section>

      <section className="civic-panel">
        <PanelHeading title="Top Issues" meta="Top 5 by priority" />
        <div className="civic-issue-list">
          {topIssues.length ? (
            topIssues.map((issue) => (
              <button
                className="civic-issue-row"
                key={issue.id}
                type="button"
                onClick={() => onOpenIssue(issue)}
              >
                <div>
                  <strong>{issue.issue_type}</strong>
                  <span>{issue.location || 'Unknown location'}</span>
                </div>
                <div className="civic-row-score">
                  <span>{issue.severity}</span>
                  <strong>{issue.priority_score}</strong>
                </div>
              </button>
            ))
          ) : loading ? (
            <SkeletonList rows={5} />
          ) : (
            <EmptyState icon="I" message="Upload reports to populate current batch issues." title="No issues" />
          )}
        </div>
      </section>

      <section className="civic-panel">
        <PanelHeading title="Insights" meta="Current batch" />
        <div className="civic-insight-grid">
          <article>
            <span>Most common issue type</span>
            <strong>{mostCommonIssue.key}</strong>
            <small>{mostCommonIssue.value} reports</small>
          </article>
          <article>
            <span>Most affected location</span>
            <strong>{mostAffectedLocation.key}</strong>
            <small>{mostAffectedLocation.value} reports</small>
          </article>
        </div>
      </section>

      <section className="civic-panel civic-search-panel">
        <PanelHeading title="Issue Lookup" meta="Current batch only" />
        <button
          className="button"
          type="button"
          disabled={!searchIssueId.trim()}
          onClick={onSearch}
        >
          Open Issue Detail
        </button>
      </section>
    </div>
  )
}

function HeatmapTab({ heatmapPoints, issues, loading, mapContainerRef }) {
  const mappedIssueCount = issues.filter(hasCoordinates).length

  return (
    <div className="civic-tab">
      <section className="civic-panel civic-map-card">
        <PanelHeading
          title="Heatmap"
          meta={loading ? 'Loading...' : `${heatmapPoints.length} hotspots · ${mappedIssueCount} markers`}
        />
        <div className="civic-map-shell">
          <div ref={mapContainerRef} className="civic-map-canvas" />
          {loading ? <MapLoadingState /> : null}
          {!heatmapPoints.length && !mappedIssueCount && !loading ? (
            <EmptyState
              className="map-overlay"
              icon="M"
              message="Locations with coordinates will render as heat and marker layers."
              title="No mapped coordinates"
            />
          ) : null}
        </div>
        <div className="heatmap-legend">
          <span><i className="legend-dot legend-low" /> Low</span>
          <span><i className="legend-dot legend-medium" /> Medium</span>
          <span><i className="legend-dot legend-high" /> High</span>
          <span><i className="legend-dot legend-critical" /> Critical</span>
        </div>
      </section>
    </div>
  )
}

function VolunteersTab({
  assigningIssueIds,
  issues,
  loading,
  matchingLoadingIds,
  onAssignVolunteer,
  onAssignUserVolunteer,
  selectedVolunteerByIssueId,
  setSelectedVolunteerByIssueId,
  volunteerUsers,
  volunteerMatchesByIssueId,
}) {
  return (
    <div className="civic-tab">
      <section className="civic-panel">
        <PanelHeading title="Volunteer Assignments" meta={loading ? 'Loading...' : `${issues.length} current batch issues`} />
        <div className="civic-volunteer-list">
          {loading ? (
            <AssignmentSkeleton />
          ) : issues.length ? (
            issues.map((issue) => {
              const matchResult = volunteerMatchesByIssueId[issue.id]
              const matchedVolunteers = matchResult?.matched_volunteers || []
              const isAssigned = Boolean(issue.assigned_volunteer)
              const isAssigning = assigningIssueIds.includes(issue.id)
              const isLoadingMatches = matchingLoadingIds.includes(issue.id)

              return (
                <article
                  className={`civic-assignment-card ${isAssigned ? 'civic-assignment-card-active' : ''}`}
                  key={issue.id}
                >
                  <div className="civic-assignment-head">
                    <div>
                      <strong>{issue.issue_type}</strong>
                      <span>
                        #{issue.id} · {issue.location || 'Unknown location'} · Required skill:{' '}
                        {matchResult?.required_skill || ISSUE_SKILL_MAP[issue.issue_type] || 'general'}
                      </span>
                    </div>
                    <span className={`assignment-badge ${isAssigned ? 'assignment-badge-assigned' : ''}`}>
                      {isAssigned ? 'Assigned' : 'Not Assigned'}
                    </span>
                  </div>

                  <p className="assignment-status">
                    {isAssigned ? `Assigned to: ${issue.assigned_volunteer}` : 'No volunteer assigned'}
                  </p>

                  <div className="civic-assign-control">
                    <select
                      className="input-control"
                      value={selectedVolunteerByIssueId[issue.id] || issue.assigned_to || ''}
                      onChange={(event) => {
                        setSelectedVolunteerByIssueId((currentSelections) => ({
                          ...currentSelections,
                          [issue.id]: event.target.value,
                        }))
                      }}
                    >
                      <option value="">Select volunteer user</option>
                      {volunteerUsers.map((volunteer) => (
                        <option key={volunteer.id} value={volunteer.id}>
                          {volunteer.name} · {volunteer.email}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button task-inline-button"
                      type="button"
                      disabled={isAssigning || !volunteerUsers.length}
                      onClick={() => onAssignUserVolunteer(
                        issue,
                        selectedVolunteerByIssueId[issue.id] || issue.assigned_to,
                      )}
                    >
                      {isAssigned ? 'Reassign User' : 'Assign User'}
                    </button>
                  </div>

                  {isLoadingMatches ? (
                    <SkeletonList rows={2} />
                  ) : matchedVolunteers.length ? (
                    <div className="civic-match-grid">
                      {matchedVolunteers.map((volunteer) => (
                        <div className="civic-match-row" key={volunteer.id}>
                          <VolunteerAvatar name={volunteer.name} />
                          <div>
                            <strong>{volunteer.name}</strong>
                            <span>{volunteer.location || 'Unknown location'}</span>
                            {volunteer.availability ? <span>{volunteer.availability}</span> : null}
                            <div className="civic-skill-tags">
                              {(volunteer.skills?.length ? volunteer.skills : ['General']).map((skill) => (
                                <small key={skill}>{skill}</small>
                              ))}
                            </div>
                          </div>
                          <button
                            className="ghost-button task-inline-button assignment-button"
                            type="button"
                            disabled={isAssigning || (isAssigned && issue.assigned_volunteer === volunteer.name)}
                            onClick={() => onAssignVolunteer(issue, volunteer.name)}
                          >
                            {isAssigned && issue.assigned_volunteer === volunteer.name
                              ? 'Assigned'
                              : isAssigned ? 'Reassign' : 'Assign'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon="V" message="Matching volunteers will appear here when skill and location data align." title="No volunteers matched" />
                  )}
                </article>
              )
            })
          ) : (
            <EmptyState icon="V" message="Current batch issues are required before volunteers can be assigned." title="No volunteer assignments" />
          )}
        </div>
      </section>
    </div>
  )
}

function HistoryTab({ historyError, historyIssues, historyLoading, onOpenIssue }) {
  return (
    <div className="civic-tab">
      <section className="civic-panel">
        <PanelHeading title="Issue History" meta="All batches" />
        {historyError ? <div className="feedback-banner error-banner">{historyError}</div> : null}
        <div className="civic-history-table">
          <div className="civic-history-head">
            <span>Issue ID</span>
            <span>Issue Type</span>
            <span>Location</span>
            <span>Severity</span>
            <span>Priority</span>
            <span>Created</span>
          </div>
          {historyLoading ? (
            <SkeletonTable rows={6} />
          ) : historyIssues.length ? (
            historyIssues.map((issue) => (
              <button
                className="civic-history-row"
                key={issue.id}
                type="button"
                onClick={() => onOpenIssue(issue)}
              >
                <span>#{issue.id}</span>
                <strong>{issue.issue_type}</strong>
                <span>{issue.location || 'Unknown'}</span>
                <span>{issue.severity}</span>
                <span>{issue.priority_score}</span>
                <span>{formatIssueDate(issue.created_at)}</span>
              </button>
            ))
          ) : (
            <EmptyState icon="H" message="Past uploaded issues will show here as a transaction-style log." title="No history yet" />
          )}
        </div>
      </section>
    </div>
  )
}

function IssueDetailPanel({ issue, onClose }) {
  return (
    <div className="civic-detail-backdrop" role="presentation" onClick={onClose}>
      <aside className="civic-detail-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="civic-detail-header">
          <div>
            <span className="eyebrow">Issue #{issue.id}</span>
            <h2>{issue.issue_type}</h2>
          </div>
          <button className="ghost-button task-inline-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="civic-detail-grid">
          <div><dt>Location</dt><dd>{issue.location || 'Unknown'}</dd></div>
          <div><dt>Severity</dt><dd>{issue.severity || 'Unknown'}</dd></div>
          <div><dt>Priority Score</dt><dd>{issue.priority_score ?? 'Unknown'}</dd></div>
          <div><dt>People Affected</dt><dd>{issue.people_affected ?? 'Unknown'}</dd></div>
          <div><dt>Latitude</dt><dd>{issue.latitude ?? 'Not mapped'}</dd></div>
          <div><dt>Longitude</dt><dd>{issue.longitude ?? 'Not mapped'}</dd></div>
          <div><dt>Assigned Volunteer</dt><dd>{issue.assigned_volunteer || 'No volunteer assigned'}</dd></div>
          <div><dt>Batch ID</dt><dd>{issue.batch_id || 'Legacy'}</dd></div>
          <div><dt>Created At</dt><dd>{formatIssueDate(issue.created_at)}</dd></div>
        </dl>
      </aside>
    </div>
  )
}

function KpiCard({ context, label, loading, trend, value }) {
  return (
    <article className="civic-kpi-card">
      <span>{label}</span>
      {loading ? <span className="civic-skeleton civic-skeleton-value" /> : <strong>{value}</strong>}
      <small>
        <b>{trend}</b>
        {context}
      </small>
    </article>
  )
}

function EmptyState({ className = '', icon, message, title }) {
  return (
    <div className={`civic-empty-state ${className}`}>
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

function SkeletonTable({ rows }) {
  return (
    <div className="civic-skeleton-table">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="civic-skeleton-table-row" key={index}>
          <span className="civic-skeleton" />
          <span className="civic-skeleton" />
          <span className="civic-skeleton" />
          <span className="civic-skeleton" />
        </div>
      ))}
    </div>
  )
}

function AssignmentSkeleton() {
  return (
    <>
      <SkeletonList rows={3} />
      <SkeletonList rows={3} />
    </>
  )
}

function MapLoadingState() {
  return (
    <div className="civic-map-loading">
      <span />
      Loading map data
    </div>
  )
}

function VolunteerAvatar({ name }) {
  return <span className="civic-volunteer-avatar">{getInitials(name)}</span>
}

function PanelHeading({ title, meta }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <span className="panel-meta">{meta}</span>
    </div>
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

function replaceIssue(issues, updatedIssue) {
  return issues.map((issue) => (issue.id === updatedIssue.id ? { ...issue, ...updatedIssue } : issue))
}

function sortIssuesByDate(issues) {
  return [...issues].sort((left, right) => (
    new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  ))
}

function buildHeatData(heatmapPoints) {
  const validPoints = heatmapPoints.filter((point) => (
    Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
  ))
  const maxIntensity = Math.max(...validPoints.map((point) => Number(point.intensity) || 0), 1)

  return validPoints.map((point) => [
    Number(point.lat),
    Number(point.lng),
    Math.max((Number(point.intensity) || 0) / maxIntensity, 0.15),
  ])
}

function hasCoordinates(issue) {
  return Number.isFinite(Number(issue.latitude)) && Number.isFinite(Number(issue.longitude))
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

function getInitials(name) {
  return (name || 'Volunteer')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default NgoDashboardPage
