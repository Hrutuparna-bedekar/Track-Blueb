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
    X
} from 'lucide-react'
import { getViolations, reviewViolation, bulkReviewViolations, getViolationTypes } from '../services/api'

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

    useEffect(() => {
        fetchViolations()
        fetchViolationTypes()
    }, [page, filters])

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPage(1)

        const params = new URLSearchParams(searchParams)
        if (value) {
            params.set(key === 'reviewStatus' ? 'review_status' :
                key === 'violationType' ? 'violation_type' : 'video_id', value)
        } else {
            params.delete(key === 'reviewStatus' ? 'review_status' :
                key === 'violationType' ? 'violation_type' : 'video_id')
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

    // Group violations by person (track_id)
    const groupedViolations = violations.reduce((acc, v) => {
        const key = `Video ${v.video_id} - Person ${v.track_id}`
        if (!acc[key]) {
            acc[key] = []
        }
        acc[key].push(v)
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
                        </div>
                    </div>
                </div>

                {/* Bulk Actions */}
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
                        {/* Grouped by Person */}
                        {Object.entries(groupedViolations).map(([personKey, personViolations]) => (
                            <div key={personKey} className="card mb-6">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <User size={18} />
                                        <h3 className="card-title">{personKey}</h3>
                                    </div>
                                    <span className="badge badge-neutral">
                                        {personViolations.length} violations
                                    </span>
                                </div>
                                <div className="card-body">
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '1rem'
                                    }}>
                                        {personViolations.map(violation => (
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
                                                        <div>Time: {formatTimestamp(violation.timestamp)}</div>
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
        </>
    )
}

export default Violations
