import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { uploadIssue } from '../api'

const LAST_ISSUE_ID_KEY = 'civiclens_latest_issue_id'
const LAST_UPLOAD_DATA_KEY = 'civiclens_last_upload_data'
const LAST_BATCH_ID_KEY = 'civiclens_latest_batch_id'

function NgoUploadPage() {
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!selectedFile && !notes.trim()) {
      setError('Add a file or paste issue text before submitting.')
      return
    }

    const formData = new FormData()
    if (selectedFile) {
      formData.append('file', selectedFile)
    } else {
      const textBlob = new Blob([notes], { type: 'text/plain' })
      formData.append('file', textBlob, 'manual-report.txt')
    }

    try {
      setUploading(true)
      const response = await uploadIssue(formData)
      const latestIssueId = response.created_issues?.[0]?.id ?? null

      if (latestIssueId) {
        localStorage.setItem(LAST_ISSUE_ID_KEY, String(latestIssueId))
      } else {
        localStorage.removeItem(LAST_ISSUE_ID_KEY)
      }

      if (response.batch_id) {
        localStorage.setItem(LAST_BATCH_ID_KEY, response.batch_id)
      }

      localStorage.setItem(LAST_UPLOAD_DATA_KEY, JSON.stringify(response))
      navigate('/ngo/results')
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="page-shell dashboard-page">
      <div className="page-frame compact-page-frame">
        <header className="dashboard-topbar">
          <div className="section-header">
            <span className="eyebrow">NGO Upload</span>
            <h1>Submit a fresh field report</h1>
            <p>
              Upload a report file or paste extracted text. After submission, CivicLens
              takes you straight to the live results dashboard.
            </p>
          </div>
          <div className="topbar-actions">
            <Link className="ghost-button" to="/">
              Back Home
            </Link>
          </div>
        </header>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <section className="single-column-layout">
          <div className="form-card upload-focus-card">
            <h2>Upload Report</h2>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label className="input-label" htmlFor="ngo-upload-file">
                File upload
                <input
                  id="ngo-upload-file"
                  className="input-control"
                  type="file"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </label>
              <label className="input-label" htmlFor="ngo-upload-text">
                Optional text
                <textarea
                  id="ngo-upload-text"
                  className="textarea-control"
                  placeholder="Paste OCR text, field notes, or a manual report here..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button className="button" type="submit" disabled={uploading}>
                {uploading ? 'Submitting...' : 'Submit and View Results'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

export default NgoUploadPage
