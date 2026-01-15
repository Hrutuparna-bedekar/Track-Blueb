import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Filter,
    RefreshCw,
    User,
    Image,
    X,
    FileText,
    Video
} from 'lucide-react'
import { getViolations, reviewViolation, bulkReviewViolations, getViolationTypes, getVideos } from '../services/api'

function Violations() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [violations, setViolations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [violationTypes, setViolationTypes] = useState([])
    const [selectedViolations, setSelectedViolations] = useState([])
    const [submitting, setSubmitting] = useState(false)
    const [expandedImage, setExpandedImage] = useState(null)

    // Filters
    const [filters, setFilters] = useState({
        reviewStatus: searchParams.get('review_status') || '',
        violationType: searchParams.get('violation_type') || '',
        videoId: searchParams.get('video_id') || ''
    })

    // Tab state for summary view
    const [showSummary, setShowSummary] = useState(false)
    const [videoNames, setVideoNames] = useState({})  // video_id -> filename

    const fetchViolations = async () => {
        try {
            setLoading(true)
            const res = await getViolations({
                page,
                pageSize: 20,
                reviewStatus: filters.reviewStatus || undefined,
                violationType: filters.violationType || undefined,
                videoId: filters.videoId || undefined
            })
            setViolations(res.data.items)
            setTotal(res.data.total)
        } catch (err) {
            setError('Failed to load violations')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchViolationTypes = async () => {
        try {
            const res = await getViolationTypes()
            setViolationTypes(res.data.violation_types || [])
        } catch (err) {
            console.error(err)
        }
    }

    const fetchVideoNames = async () => {
        try {
            const res = await getVideos(1, 100)  // Get all videos
            const names = {}
            res.data.items.forEach(v => {
                names[v.id] = v.original_filename
            })
            setVideoNames(names)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchViolations()
        fetchViolationTypes()
        fetchVideoNames()
    }, [page, filters])

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPage(1)

        const params = new URLSearchParams(searchParams)
        const paramMap = {
            reviewStatus: 'review_status',
            violationType: 'violation_type',
            videoId: 'video_id'
        }
        const paramKey = paramMap[key] || key

        if (value) {
            params.set(paramKey, value)
        } else {
            params.delete(paramKey)
        }
        setSearchParams(params)
    }

    const handleReview = async (violationId, isConfirmed) => {
        try {
            setSubmitting(true)
            await reviewViolation(violationId, isConfirmed, '')

            setViolations(prev => prev.map(v =>
                v.id === violationId
                    ? { ...v, review_status: isConfirmed ? 'confirmed' : 'rejected' }
                    : v
            ))
        } catch (err) {
            setError('Failed to submit review')
            console.error(err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleBulkReview = async (isConfirmed) => {
        if (selectedViolations.length === 0) return

        try {
            setSubmitting(true)
            await bulkReviewViolations(selectedViolations, isConfirmed)

            setViolations(prev => prev.map(v =>
                selectedViolations.includes(v.id)
                    ? { ...v, review_status: isConfirmed ? 'confirmed' : 'rejected' }
                    : v
            ))

            setSelectedViolations([])
        } catch (err) {
            setError('Failed to submit bulk review')
            console.error(err)
        } finally {
            setSubmitting(false)
        }
    }

    const toggleViolation = (id) => {
        setSelectedViolations(prev =>
            prev.includes(id)
                ? prev.filter(v => v !== id)
                : [...prev, id]
        )
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'confirmed':
                return <span className="badge badge-success"><CheckCircle size={12} /> Confirmed</span>
            case 'rejected':
                return <span className="badge badge-danger"><XCircle size={12} /> Rejected</span>
            case 'pending':
            default:
                return <span className="badge badge-warning"><Clock size={12} /> Pending</span>
        }
    }

    const formatTimestamp = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatDateTime = (isoString) => {
        if (!isoString) return 'N/A'
        const date = new Date(isoString)
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    }

    // Group violations by video (video_id)
    const groupedViolations = violations.reduce((acc, v) => {
        const videoName = videoNames[v.video_id] || `Video ${v.video_id}`
        if (!acc[videoName]) {
            acc[videoName] = { video_id: v.video_id, violations: [] }
        }
        acc[videoName].violations.push(v)
        return acc
    }, {})

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">Violation Review</h1>
                        <p className="page-subtitle">Review detected violations with snapshot images</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchViolations} disabled={loading}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="page-content">
                {/* Error */}
                {error && (
                    <div className="card mb-6" style={{ borderColor: 'var(--danger)' }}>
                        <div className="card-body flex items-center gap-4">
                            <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                            <span>{error}</span>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setError(null)}
                                style={{ marginLeft: 'auto' }}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="card mb-6">
                    <div className="card-body">
                        <div className="flex items-center gap-4 flex-wrap">
                            <Filter size={16} className="text-muted" />

                            <select
                                className="form-input form-select"
                                value={filters.reviewStatus}
                                onChange={(e) => handleFilterChange('reviewStatus', e.target.value)}
                                style={{ width: 'auto', minWidth: 150 }}
                            >
                                <option value="">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="rejected">Rejected</option>
                            </select>

                            <select
                                className="form-input form-select"
                                value={filters.violationType}
                                onChange={(e) => handleFilterChange('violationType', e.target.value)}
                                style={{ width: 'auto', minWidth: 150 }}
                            >
                                <option value="">All Types</option>
                                {violationTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            {filters.videoId && (
                                <div className="badge badge-info flex items-center gap-2">
                                    Video #{filters.videoId}
                                    <button
                                        className="btn btn-ghost"
                                        style={{ padding: 2 }}
                                        onClick={() => handleFilterChange('videoId', '')}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            {/* Violator Summary Toggle */}
                            <button
                                className={`btn ${showSummary ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                onClick={() => setShowSummary(!showSummary)}
                                style={{ marginLeft: 'auto' }}
                            >
                                <FileText size={14} />
                                {showSummary ? 'Hide Summary' : 'View Violator Summary'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Violator Summary Section */}
                {showSummary && (
                    <div className="card mb-6" style={{ borderColor: 'var(--success)' }}>
                        <div className="card-header">
                            <h3 className="card-title" style={{ color: 'var(--success)' }}>
                                <CheckCircle size={18} style={{ marginRight: 8 }} />
                                Confirmed Violators Summary
                            </h3>
                        </div>
                        <div className="card-body">
                            {(() => {
                                // Get unique persons with confirmed violations
                                const confirmedViolations = violations.filter(v => v.review_status === 'confirmed')
                                const personMap = new Map()

                                confirmedViolations.forEach(v => {
                                    const key = `${v.video_id}-${v.track_id}`
                                    if (!personMap.has(key)) {
                                        personMap.set(key, {
                                            video_id: v.video_id,
                                            track_id: v.track_id,
                                            image_path: v.image_path,
                                            violations: [],
                                            violation_types: new Set()
                                        })
                                    }
                                    const person = personMap.get(key)
                                    person.violations.push(v)
                                    person.violation_types.add(v.violation_type)
                                })

                                const violators = Array.from(personMap.values())

                                if (violators.length === 0) {
                                    return (
                                        <div className="text-center text-muted py-4">
                                            No confirmed violators yet. Review violations above to confirm them.
                                        </div>
                                    )
                                }

                                return (
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Person</th>
                                                    <th>Snapshot</th>
                                                    <th>Violations</th>
                                                    <th>Count</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {violators.map((person, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <span className="font-semibold">
                                                                Person #{person.track_id}
                                                            </span>
                                                            <div className="text-muted text-sm">
                                                                Video #{person.video_id}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {person.image_path ? (
                                                                <img
                                                                    src={person.image_path}
                                                                    alt={`Person ${person.track_id}`}
                                                                    style={{
                                                                        width: 48,
                                                                        height: 48,
                                                                        objectFit: 'cover',
                                                                        borderRadius: 6
                                                                    }}
                                                                />
                                                            ) : (
                                                                <User size={24} className="text-muted" />
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="flex flex-wrap gap-1">
                                                                {Array.from(person.violation_types).map((type, i) => (
                                                                    <span key={i} className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                                                                        {type}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-warning">
                                                                {person.violations.length}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                )}
                {selectedViolations.length > 0 && (
                    <div className="card mb-6" style={{ borderColor: 'var(--accent-primary)' }}>
                        <div className="card-body flex items-center gap-4">
                            <span className="font-semibold">
                                {selectedViolations.length} selected
                            </span>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleBulkReview(true)}
                                disabled={submitting}
                            >
                                <CheckCircle size={14} />
                                Confirm All
                            </button>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleBulkReview(false)}
                                disabled={submitting}
                            >
                                <XCircle size={14} />
                                Reject All
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedViolations([])}
                                style={{ marginLeft: 'auto' }}
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>
                )}

                {/* Violations Grid */}
                {loading && violations.length === 0 ? (
                    <div className="card">
                        <div className="card-body">
                            <div className="flex items-center justify-center gap-2 text-muted">
                                <div className="spinner" />
                                Loading violations...
                            </div>
                        </div>
                    </div>
                ) : violations.length === 0 ? (
                    <div className="card">
                        <div className="empty-state">
                            <AlertTriangle className="empty-state-icon" />
                            <h3 className="empty-state-title">No Violations Found</h3>
                            <p className="empty-state-description">
                                {filters.reviewStatus || filters.violationType
                                    ? 'Try adjusting your filters'
                                    : 'Upload a video to start detecting violations'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Grouped by Video */}
                        {Object.entries(groupedViolations).map(([videoName, videoData]) => (
                            <div key={videoName} className="card mb-6">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <Video size={18} style={{ color: 'var(--accent-primary)' }} />
                                        <h3 className="card-title">{videoName}</h3>
                                    </div>
                                    <span className="badge badge-neutral">
                                        {videoData.violations.length} violations
                                    </span>
                                </div>
                                <div className="card-body">
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '1rem'
                                    }}>
                                        {videoData.violations.map(violation => (
                                            <div
                                                key={violation.id}
                                                className="card"
                                                style={{
                                                    border: selectedViolations.includes(violation.id)
                                                        ? '2px solid var(--accent-primary)'
                                                        : '1px solid var(--border)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => toggleViolation(violation.id)}
                                            >
                                                {/* Violation Image */}
                                                <div style={{
                                                    height: 180,
                                                    background: 'var(--bg-tertiary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                    borderRadius: '12px 12px 0 0'
                                                }}>
                                                    {violation.image_path ? (
                                                        <img
                                                            src={violation.image_path}
                                                            alt={`${violation.violation_type} violation`}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover'
                                                            }}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setExpandedImage(violation.image_path)
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-muted flex flex-col items-center gap-2">
                                                            <Image size={32} />
                                                            <span className="text-sm">No image</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="card-body" style={{ padding: '1rem' }}>
                                                    {/* Type and Status */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-semibold" style={{ color: 'var(--danger)' }}>
                                                            {violation.violation_type}
                                                        </span>
                                                        {getStatusBadge(violation.review_status)}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="text-sm text-muted mb-3">
                                                        <div>Detected: {formatDateTime(violation.detected_at)}</div>
                                                        <div>Video Time: {formatTimestamp(violation.timestamp)}</div>
                                                        <div>Confidence: {Math.round(violation.confidence * 100)}%</div>
                                                    </div>

                                                    {/* Review Actions */}
                                                    {violation.review_status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="btn btn-success btn-sm"
                                                                style={{ flex: 1 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleReview(violation.id, true)
                                                                }}
                                                                disabled={submitting}
                                                            >
                                                                <CheckCircle size={14} />
                                                                Confirm
                                                            </button>
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                style={{ flex: 1 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleReview(violation.id, false)
                                                                }}
                                                                disabled={submitting}
                                                            >
                                                                <XCircle size={14} />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Pagination */}
                        {total > 20 && (
                            <div className="card">
                                <div className="card-body flex items-center justify-between">
                                    <span className="text-muted text-sm">
                                        Page {page} of {Math.ceil(total / 20)}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={page === 1}
                                            onClick={() => setPage(p => p - 1)}
                                        >
                                            Previous
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={page >= Math.ceil(total / 20)}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Image Modal */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        cursor: 'pointer'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={expandedImage}
                        alt="Violation"
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            borderRadius: 8
                        }}
                    />
                    <button
                        className="btn btn-ghost"
                        style={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            color: 'white'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* Floating Action Buttons for Multi-Select */}
            {selectedViolations.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        right: 24,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 12,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        zIndex: 900
                    }}
                >
                    <div className="text-center font-semibold" style={{ color: 'var(--accent-primary)' }}>
                        {selectedViolations.length} Selected
                    </div>
                    <button
                        className="btn btn-success"
                        onClick={() => handleBulkReview(true)}
                        disabled={submitting}
                    >
                        <CheckCircle size={18} />
                        Confirm All
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={() => handleBulkReview(false)}
                        disabled={submitting}
                    >
                        <XCircle size={18} />
                        Reject All
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedViolations([])}
                    >
                        Clear
                    </button>
                </div>
            )}
        </>
    )
}

export default Violations
