import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Sparkles, Upload, X } from 'lucide-react'
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
      } else {
        localStorage.removeItem(LAST_BATCH_ID_KEY)
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
    <main className="upload-intake-page">
      <div className="upload-intake-frame">
        <header className="upload-intake-header">
          <Link className="upload-back-link" to="/">
            ← Back Home
          </Link>
          <div className="section-header">
            <span className="eyebrow">Document intake</span>
            <h1>Upload Your Document</h1>
            <p>
              Supports PDF and image files up to 20MB.
            </p>
          </div>
        </header>

        {error ? <div className="feedback-banner error-banner">{error}</div> : null}

        <section className="single-column-layout">
          <div className="upload-focus-card">
            <form className="form-stack" onSubmit={handleSubmit}>
              <label className={`upload-drop-zone ${selectedFile ? 'upload-drop-zone-active' : ''}`} htmlFor="ngo-upload-file">
                <input
                  id="ngo-upload-file"
                  className="upload-file-input"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <Upload size={48} strokeWidth={1.6} />
                <strong>Drag & drop files here</strong>
                <span>or click to browse</span>
              </label>

              {selectedFile ? (
                <div className="selected-file-card">
                  <FileText size={22} />
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <span>{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <button type="button" aria-label="Remove file" onClick={() => setSelectedFile(null)}>
                    <X size={18} />
                  </button>
                </div>
              ) : null}

              <div className="file-type-badges" aria-label="Supported file types">
                <span>PDF</span>
                <span>PNG</span>
                <span>JPG</span>
                <span>WEBP</span>
              </div>

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

              {selectedFile || uploading ? (
                <div className="upload-status-area">
                  <div className="upload-progress-track">
                    <span />
                  </div>
                  <p>{uploading ? 'Analyzing document...' : 'Ready to process'}</p>
                </div>
              ) : null}

              <button className="button" type="submit" disabled={uploading}>
                <Sparkles size={18} />
                {uploading ? 'Submitting...' : 'Process Document'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) {
    return 'Unknown size'
  }
  if (size < 1024 * 1024) {
    return `${Math.max(size / 1024, 1).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default NgoUploadPage
