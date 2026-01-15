import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Users,
    AlertTriangle,
    TrendingUp,
    Clock,
    User,
    RefreshCw
} from 'lucide-react'
import { getIndividuals, getIndividual, analyzeIndividual } from '../services/api'

function Individuals() {
    const { videoId } = useParams()
    const [individuals, setIndividuals] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedIndividual, setSelectedIndividual] = useState(null)
    const [analysis, setAnalysis] = useState(null)
    const [loadingAnalysis, setLoadingAnalysis] = useState(false)

    const fetchIndividuals = async () => {
        try {
            setLoading(true)
            const res = await getIndividuals(videoId)
            setIndividuals(res.data.items || [])
        } catch (err) {
            setError('Failed to load individuals')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchIndividuals()
    }, [videoId])

    const handleSelectIndividual = async (individual) => {
        if (selectedIndividual?.id === individual.id) {
            setSelectedIndividual(null)
            setAnalysis(null)
            return
        }

        setSelectedIndividual(individual)

        try {
            setLoadingAnalysis(true)
            const [detailRes, analysisRes] = await Promise.all([
                getIndividual(videoId, individual.track_id),
                analyzeIndividual(videoId, individual.track_id)
            ])
            setSelectedIndividual(detailRes.data)
            setAnalysis(analysisRes.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingAnalysis(false)
        }
    }

    const formatTime = (seconds) => {
        if (!seconds) return '-'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const getRiskLevel = (score) => {
        if (score >= 0.7) return { label: 'High', color: 'danger' }
        if (score >= 0.4) return { label: 'Medium', color: 'warning' }
        return { label: 'Low', color: 'success' }
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div className="flex items-center gap-4">
                        <Link to={`/videos/${videoId}`} className="btn btn-ghost btn-icon">
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <h1 className="page-title">Tracked Individuals</h1>
                            <p className="page-subtitle">Video #{videoId} - {individuals.length} individuals tracked</p>
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchIndividuals} disabled={loading}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="page-content">
                {error && (
                    <div className="card mb-6" style={{ borderColor: 'var(--danger)' }}>
                        <div className="card-body flex items-center gap-4">
                            <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                <div className="grid-2">
                    {/* Individuals List */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">All Individuals</h3>
                        </div>

                        {loading ? (
                            <div className="card-body">
                                <div className="flex items-center justify-center gap-2 text-muted">
                                    <div className="spinner" />
                                    Loading...
                                </div>
                            </div>
                        ) : individuals.length === 0 ? (
                            <div className="empty-state">
                                <Users className="empty-state-icon" />
                                <h3 className="empty-state-title">No Individuals Tracked</h3>
                                <p className="empty-state-description">
                                    No individuals were detected in this video
                                </p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                                {individuals.map((ind) => {
                                    const risk = getRiskLevel(ind.risk_score)
                                    const isSelected = selectedIndividual?.id === ind.id

                                    return (
                                        <div
                                            key={ind.id}
                                            className={`flex items-center gap-4 p-4 cursor-pointer transition-all ${isSelected ? 'bg-[var(--bg-tertiary)]' : ''
                                                }`}
                                            style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                background: isSelected ? 'var(--bg-tertiary)' : undefined
                                            }}
                                            onClick={() => handleSelectIndividual(ind)}
                                        >
                                            <div
                                                className="stat-icon primary"
                                                style={{ width: 40, height: 40, flexShrink: 0 }}
                                            >
                                                <User size={20} />
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">Track #{ind.track_id}</span>
                                                    {ind.total_violations >= 2 && (
                                                        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                                                            Repeat
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted mt-1">
                                                    <span>{ind.total_frames_tracked} frames</span>
                                                    <span>
                                                        {formatTime(ind.first_seen_time)} - {formatTime(ind.last_seen_time)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
                                                    <span className="font-semibold">{ind.total_violations}</span>
                                                </div>
                                                <span className={`badge badge-${risk.color} mt-1`} style={{ fontSize: '0.65rem' }}>
                                                    {risk.label} Risk
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Individual Detail */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Individual Detail</h3>
                        </div>

                        {!selectedIndividual ? (
                            <div className="card-body text-center text-muted py-12">
                                <User size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                <p>Select an individual to view details</p>
                            </div>
                        ) : loadingAnalysis ? (
                            <div className="card-body">
                                <div className="flex items-center justify-center gap-2 text-muted">
                                    <div className="spinner" />
                                    Loading analysis...
                                </div>
                            </div>
                        ) : (
                            <div className="card-body">
                                {/* Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="stat-icon primary" style={{ width: 56, height: 56 }}>
                                        <User size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">Track #{selectedIndividual.track_id}</h2>
                                        <p className="text-muted text-sm">
                                            Tracked from {formatTime(selectedIndividual.first_seen_time)}
                                            to {formatTime(selectedIndividual.last_seen_time)}
                                        </p>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid-3 mb-6">
                                    <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <div className="text-2xl font-bold">{selectedIndividual.total_violations}</div>
                                        <div className="text-sm text-muted">Violations</div>
                                    </div>
                                    <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <div className="text-2xl font-bold">{selectedIndividual.confirmed_violations}</div>
                                        <div className="text-sm text-muted">Confirmed</div>
                                    </div>
                                    <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <div className="text-2xl font-bold">{selectedIndividual.pending_violations}</div>
                                        <div className="text-sm text-muted">Pending</div>
                                    </div>
                                </div>

                                {/* Analysis */}
                                {analysis && (
                                    <>
                                        <h4 className="font-semibold mb-3">Pattern Analysis</h4>
                                        <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted">Violation Frequency</span>
                                                <span className="font-semibold">
                                                    {analysis.violation_frequency.toFixed(2)} per minute
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted">Most Common Violation</span>
                                                <span className="font-semibold">
                                                    {analysis.most_common_violation || '-'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted">Repeat Offender</span>
                                                <span className={`badge ${analysis.is_repeat_offender ? 'badge-danger' : 'badge-success'}`}>
                                                    {analysis.is_repeat_offender ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted">Risk Level</span>
                                                <span className={`badge badge-${analysis.risk_level === 'high' ? 'danger' :
                                                    analysis.risk_level === 'medium' ? 'warning' : 'success'
                                                    }`}>
                                                    {analysis.risk_level.charAt(0).toUpperCase() + analysis.risk_level.slice(1)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Worn Equipment Section */}
                                        {selectedIndividual.worn_equipment?.length > 0 && (
                                            <>
                                                <h4 className="font-semibold mt-6 mb-3" style={{ color: 'var(--success)' }}>
                                                    ✓ Worn Equipment (PPE Detected)
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedIndividual.worn_equipment.map((item, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="badge badge-success"
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                padding: '6px 12px',
                                                                textTransform: 'capitalize'
                                                            }}
                                                        >
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-muted text-sm mt-2" style={{ fontSize: '0.75rem' }}>
                                                    PPE items detected on this person. Violations for these items are skipped.
                                                </p>
                                            </>
                                        )}

                                        {/* Timeline */}
                                        {analysis.violation_timeline?.length > 0 && (
                                            <>
                                                <h4 className="font-semibold mt-6 mb-3">Violation Timeline</h4>
                                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                    {analysis.violation_timeline.map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-3 py-2"
                                                            style={{ borderBottom: '1px solid var(--border-color)' }}
                                                        >
                                                            <span className="text-muted text-sm" style={{ minWidth: 50 }}>
                                                                {formatTime(item.timestamp)}
                                                            </span>
                                                            <span className="flex-1">{item.type}</span>
                                                            <span className={`badge ${item.status === 'confirmed' ? 'badge-success' :
                                                                item.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                                                                }`} style={{ fontSize: '0.65rem' }}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 mt-6">
                                    <Link
                                        to={`/violations?individual_id=${selectedIndividual.id}`}
                                        className="btn btn-primary flex-1"
                                    >
                                        <AlertTriangle size={16} />
                                        Review Violations
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default Individuals
