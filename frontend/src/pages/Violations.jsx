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
import { useLanguage } from '../context/LanguageContext'

function Violations() {
    const { t } = useLanguage()
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
            setError(t('Failed to load violations'))
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
            setError(t('Failed to submit review'))
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
            setError(t('Failed to submit bulk review'))
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
                return <span className="badge badge-success"><CheckCircle size={12} /> {t('Confirmed')}</span>
            case 'rejected':
                return <span className="badge badge-danger"><XCircle size={12} /> {t('Rejected')}</span>
            case 'pending':
            default:
                return <span className="badge badge-warning"><Clock size={12} /> {t('Pending')}</span>
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

    // Summary State
    const [summaryStatus, setSummaryStatus] = useState({
        loading: false,
        isFullyReviewed: false,
        violators: [] // Full list of violators from all pages
    })

    const fetchSummaryData = async () => {
        if (!filters.videoId) {
            setSummaryStatus(prev => ({ ...prev, isFullyReviewed: false, violators: [] }))
            return
        }

        try {
            setSummaryStatus(prev => ({ ...prev, loading: true }))

            // 1. Check for any pending violations in the whole video
            const pendingRes = await getViolations({
                videoId: filters.videoId,
                reviewStatus: 'pending',
                pageSize: 1
            })

            if (pendingRes.data.total > 0) {
                setSummaryStatus({
                    loading: false,
                    isFullyReviewed: false,
                    violators: []
                })
                if (showSummary) setShowSummary(false) // Close if open
            } else {
                // 2. If none pending, fetch ALL confirmed violations for summary
                const confirmedRes = await getViolations({
                    videoId: filters.videoId,
                    reviewStatus: 'confirmed',
                    pageSize: 1000 // Large enough to cover most videos
                })

                // Group by person
                const violations = confirmedRes.data.items
                const personMap = new Map()

                violations.forEach(v => {
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

                setSummaryStatus({
                    loading: false,
                    isFullyReviewed: true,
                    violators: Array.from(personMap.values())
                })
            }
        } catch (err) {
            console.error('Failed to fetch summary data', err)
            setSummaryStatus(prev => ({ ...prev, loading: false }))
        }
    }

    // Refresh summary status when filters change or violations update (e.g. after review)
    useEffect(() => {
        fetchSummaryData()
    }, [filters.videoId, violations]) // dependencies: videoId filter and current page violations (updates trigger re-check)


    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">{t('Violation Review')}</h1>
                        <p className="page-subtitle">{t('Review detected violations with snapshot images')}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchViolations} disabled={loading}>
                        <RefreshCw size={16} />
                        {t('Refresh')}
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
                                <option value="">{t('All Status')}</option>
                                <option value="pending">{t('Pending')}</option>
                                <option value="confirmed">{t('Confirmed')}</option>
                                <option value="rejected">{t('Rejected')}</option>
                            </select>

                            <select
                                className="form-input form-select"
                                value={filters.violationType}
                                onChange={(e) => handleFilterChange('violationType', e.target.value)}
                                style={{ width: 'auto', minWidth: 150 }}
                            >
                                <option value="">{t('All Types')}</option>
                                {violationTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>

                            {filters.videoId && (
                                <div className="badge badge-info flex items-center gap-2">
                                    {t('Video')} #{filters.videoId}
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
                            {filters.videoId && summaryStatus.isFullyReviewed && (
                                <button
                                    className={`btn ${showSummary ? 'btn-primary' : 'btn-success'} btn-sm`}
                                    onClick={() => setShowSummary(!showSummary)}
                                    style={{ marginLeft: 'auto' }}
                                >
                                    <FileText size={14} />
                                    {showSummary ? t('Hide Summary') : t('View Verified Summary')}
                                </button>
                            )}
                            {filters.videoId && !summaryStatus.isFullyReviewed && (
                                <span className="text-muted text-sm ml-auto flex items-center gap-2">
                                    <Clock size={14} />
                                    {t('Review all to see summary')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Violator Summary Section */}
                {showSummary && summaryStatus.isFullyReviewed && (
                    <div className="card mb-6" style={{ borderColor: 'var(--success)' }}>
                        <div className="card-header">
                            <h3 className="card-title" style={{ color: 'var(--success)' }}>
                                <CheckCircle size={18} style={{ marginRight: 8 }} />
                                {t('Verified Violators Summary (Full Video)')}
                            </h3>
                        </div>
                        <div className="card-body">
                            {summaryStatus.violators.length === 0 ? (
                                <div className="text-center text-muted py-4">
                                    {t('No confirmed violators found in this video.')}
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t('Person')}</th>
                                                <th>{t('Snapshot')}</th>
                                                <th>{t('Violations')}</th>
                                                <th>{t('Count')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summaryStatus.violators.map((person, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <span className="font-semibold">
                                                            {t('Person')} #{person.track_id}
                                                        </span>
                                                        <div className="text-muted text-sm">
                                                            {t('Video')} #{person.video_id}
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
                            )}
                        </div>
                    </div>
                )}

                {selectedViolations.length > 0 && (
                    <div className="card mb-6" style={{ borderColor: 'var(--accent-primary)' }}>
                        <div className="card-body flex items-center gap-4">
                            <span className="font-semibold">
                                {selectedViolations.length} {t('selected')}
                            </span>
                            <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleBulkReview(true)}
                                disabled={submitting}
                            >
                                <CheckCircle size={14} />
                                {t('Confirm All')}
                            </button>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleBulkReview(false)}
                                disabled={submitting}
                            >
                                <XCircle size={14} />
                                {t('Reject All')}
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedViolations([])}
                                style={{ marginLeft: 'auto' }}
                            >
                                {t('Clear Selection')}
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
                                {t('Loading violations...')}
                            </div>
                        </div>
                    </div>
                ) : violations.length === 0 ? (
                    <div className="card">
                        <div className="empty-state">
                            <AlertTriangle className="empty-state-icon" />
                            <h3 className="empty-state-title">{t('No Violations Found')}</h3>
                            <p className="empty-state-description">
                                {filters.reviewStatus || filters.violationType
                                    ? t('Try adjusting your filters')
                                    : t('Upload a video to start detecting violations')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Grouped by Video, then by Person */}
                        {Object.entries(groupedViolations).map(([videoName, videoData]) => (
                            <div key={videoName} className="card mb-6">
                                <div className="card-header">
                                    <div className="flex items-center gap-2">
                                        <Video size={18} style={{ color: 'var(--accent-primary)' }} />
                                        <h3 className="card-title">{videoName}</h3>
                                    </div>
                                    <span className="badge badge-neutral">
                                        {videoData.violations.length} {t('violations')}
                                    </span>
                                </div>
                                <div className="card-body">
                                    {(() => {
                                        // Group violations by person (individual_id)
                                        const groupedByPerson = videoData.violations.reduce((acc, v) => {
                                            const personKey = v.individual_id || v.track_id || 'unknown'
                                            if (!acc[personKey]) {
                                                acc[personKey] = []
                                            }
                                            acc[personKey].push(v)
                                            return acc
                                        }, {})

                                        // Sort person keys numerically
                                        const sortedPersonKeys = Object.keys(groupedByPerson).sort((a, b) => {
                                            if (a === 'unknown') return 1
                                            if (b === 'unknown') return -1
                                            return parseInt(a) - parseInt(b)
                                        })

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                {sortedPersonKeys.map((personKey, personIndex) => {
                                                    const personViolations = groupedByPerson[personKey]
                                                    return (
                                                        <div key={personKey} style={{
                                                            background: 'var(--bg-tertiary)',
                                                            borderRadius: 12,
                                                            overflow: 'hidden',
                                                            border: '1px solid var(--border-color)'
                                                        }}>
                                                            {/* Person Header/Tag */}
                                                            <div style={{
                                                                padding: '12px 16px',
                                                                background: 'var(--bg-tertiary)',
                                                                borderBottom: '1px solid var(--border-color)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <div className="flex items-center gap-3">
                                                                    <div style={{
                                                                        width: 36,
                                                                        height: 36,
                                                                        borderRadius: '50%',
                                                                        background: 'var(--bg-primary)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: 'var(--accent-primary)',
                                                                        border: '1px solid var(--border-color)'
                                                                    }}>
                                                                        <User size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{
                                                                            color: 'var(--text-primary)',
                                                                            fontWeight: 700,
                                                                            fontSize: '0.95rem',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.5px'
                                                                        }}>
                                                                            {t('Person')} {personIndex + 1}
                                                                        </div>
                                                                        <div style={{
                                                                            color: 'var(--text-muted)',
                                                                            fontSize: '0.7rem'
                                                                        }}>
                                                                            {t('ID')}: {personKey}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <span style={{
                                                                    background: 'var(--bg-primary)',
                                                                    color: 'var(--text-primary)',
                                                                    padding: '5px 12px',
                                                                    borderRadius: 16,
                                                                    fontWeight: 600,
                                                                    fontSize: '0.8rem',
                                                                    border: '1px solid var(--border-color)'
                                                                }}>
                                                                    {personViolations.length} {personViolations.length !== 1 ? t('violations') : t('violation')}
                                                                </span>
                                                            </div>

                                                            {/* Person's Violations Grid */}
                                                            <div style={{
                                                                padding: 16,
                                                                display: 'grid',
                                                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
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
                                                                            cursor: 'pointer',
                                                                            background: 'var(--bg-surface)'
                                                                        }}
                                                                        onClick={() => toggleViolation(violation.id)}
                                                                    >
                                                                        {/* Violation Image */}
                                                                        <div style={{
                                                                            height: 160,
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
                                                                                    <span className="text-sm">{t('No image')}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="card-body" style={{ padding: '0.875rem' }}>
                                                                            {/* Type and Status */}
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="font-semibold" style={{ color: 'var(--danger)' }}>
                                                                                    {violation.violation_type}
                                                                                </span>
                                                                                {getStatusBadge(violation.review_status)}
                                                                            </div>

                                                                            {/* Details */}
                                                                            <div className="text-sm text-muted mb-3">
                                                                                <div>{t('Detected')}: {formatDateTime(violation.detected_at)}</div>
                                                                                <div>{t('Video Time')}: {formatTimestamp(violation.timestamp)}</div>
                                                                                <div>{t('Confidence')}: {Math.round(violation.confidence * 100)}%</div>
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
                                                                                        {t('Confirm')}
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
                                                                                        {t('Reject')}
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        ))}

                        {/* Pagination */}
                        {total > 20 && (
                            <div className="card">
                                <div className="card-body flex items-center justify-between">
                                    <span className="text-muted text-sm">
                                        {t('Page')} {page} {t('of')} {Math.ceil(total / 20)}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={page === 1}
                                            onClick={() => setPage(p => p - 1)}
                                        >
                                            {t('Previous')}
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={page >= Math.ceil(total / 20)}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            {t('Next')}
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
                        {selectedViolations.length} {t('selected')}
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
