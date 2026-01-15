import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Video,
    Users,
    AlertTriangle,
    Clock,
    CheckCircle,
    XCircle,
    Play,
    RefreshCw
} from 'lucide-react'
import { getVideo, getVideoStatus, getIndividuals, getViolations } from '../services/api'

function VideoDetail() {
    const { videoId } = useParams()
    const [video, setVideo] = useState(null)
    const [individuals, setIndividuals] = useState([])
    const [violations, setViolations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchData = async () => {
        try {
            setLoading(true)
            const [videoRes, indsRes, violsRes] = await Promise.all([
                getVideo(videoId),
                getIndividuals(videoId),
                getViolations({ videoId, pageSize: 100 })
            ])
            setVideo(videoRes.data)
            setIndividuals(indsRes.data.items || [])
            setViolations(violsRes.data.items || [])
        } catch (err) {
            setError('Failed to load video details')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [videoId])

    // Poll for status if processing
    useEffect(() => {
        if (!video || video.status !== 'processing') return

        const interval = setInterval(async () => {
            try {
                const res = await getVideoStatus(videoId)
                setVideo(prev => ({
                    ...prev,
                    status: res.data.status,
                    processing_progress: res.data.progress
                }))

                if (res.data.status === 'completed') {
                    fetchData()
                }
            } catch (err) {
                console.error(err)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [video?.status])

    const formatDuration = (seconds) => {
        if (!seconds) return '-'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <span className="badge badge-success"><CheckCircle size={12} /> Completed</span>
            case 'processing':
                return <span className="badge badge-info"><Clock size={12} /> Processing</span>
            case 'pending':
                return <span className="badge badge-warning"><Clock size={12} /> Pending</span>
            case 'failed':
                return <span className="badge badge-danger"><XCircle size={12} /> Failed</span>
            default:
                return <span className="badge badge-neutral">{status}</span>
        }
    }

    if (loading) {
        return (
            <>
                <div className="page-header">
                    <div className="page-header-content">
                        <Link to="/videos" className="btn btn-ghost">
                            <ArrowLeft size={16} /> Back to Videos
                        </Link>
                    </div>
                </div>
                <div className="page-content">
                    <div className="flex items-center justify-center gap-2 text-muted" style={{ minHeight: 300 }}>
                        <div className="spinner" />
                        Loading video details...
                    </div>
                </div>
            </>
        )
    }

    if (error || !video) {
        return (
            <>
                <div className="page-header">
                    <div className="page-header-content">
                        <Link to="/videos" className="btn btn-ghost">
                            <ArrowLeft size={16} /> Back to Videos
                        </Link>
                    </div>
                </div>
                <div className="page-content">
                    <div className="empty-state">
                        <AlertTriangle className="empty-state-icon" />
                        <h3 className="empty-state-title">{error || 'Video not found'}</h3>
                        <button className="btn btn-primary" onClick={fetchData}>
                            <RefreshCw size={16} /> Retry
                        </button>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div className="flex items-center gap-4">
                        <Link to="/videos" className="btn btn-ghost btn-icon">
                            <ArrowLeft size={16} />
                        </Link>
                        <div>
                            <h1 className="page-title">{video.original_filename}</h1>
                            <div className="flex items-center gap-4 mt-2">
                                {getStatusBadge(video.status)}
                                <span className="text-muted text-sm">
                                    Uploaded {new Date(video.uploaded_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Processing Status */}
                {video.status === 'processing' && (
                    <div className="card mb-6">
                        <div className="card-body">
                            <div className="flex items-center gap-4">
                                <div className="spinner" />
                                <div className="flex-1">
                                    <div className="font-semibold">Processing video...</div>
                                    <p className="text-muted text-sm mt-1">
                                        Detecting violations and tracking individuals
                                    </p>
                                    <div className="progress-bar mt-3" style={{ maxWidth: 400 }}>
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${video.processing_progress || 0}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-muted mt-2">
                                        {Math.round(video.processing_progress || 0)}% complete
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video Info */}
                <div className="stats-grid mb-8">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <Video size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{formatDuration(video.duration)}</div>
                            <div className="stat-label">Duration</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Users size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{individuals.length}</div>
                            <div className="stat-label">Individuals Tracked</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{violations.length}</div>
                            <div className="stat-label">Violations Detected</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon danger">
                            <CheckCircle size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {violations.filter(v => v.review_status === 'confirmed').length}
                            </div>
                            <div className="stat-label">Confirmed</div>
                        </div>
                    </div>
                </div>

                {/* Individuals & Violations */}
                <div className="grid-2">
                    {/* Individuals */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Tracked Individuals</h3>
                            {individuals.length > 0 && (
                                <Link to={`/individuals/${videoId}`} className="btn btn-secondary btn-sm">
                                    View All
                                </Link>
                            )}
                        </div>

                        {individuals.length === 0 ? (
                            <div className="card-body text-center text-muted">
                                No individuals detected yet
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Person</th>
                                            <th>Snapshot</th>
                                            <th>Violations</th>
                                            <th>Risk</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {individuals.slice(0, 5).map((ind) => {
                                            // Find first violation image for this person
                                            const personViolation = violations.find(v => v.track_id === ind.track_id && v.image_path)
                                            return (
                                                <tr key={ind.id}>
                                                    <td>
                                                        <span className="font-semibold">Person #{ind.track_id}</span>
                                                    </td>
                                                    <td>
                                                        {personViolation?.image_path ? (
                                                            <img
                                                                src={personViolation.image_path}
                                                                alt={`Person ${ind.track_id}`}
                                                                style={{
                                                                    width: 48,
                                                                    height: 48,
                                                                    objectFit: 'cover',
                                                                    borderRadius: 6
                                                                }}
                                                            />
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    width: 48,
                                                                    height: 48,
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: 6,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <Users size={20} className="text-muted" />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {ind.total_violations > 0 ? (
                                                            <span className="badge badge-warning">
                                                                {ind.total_violations}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted">0</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${ind.risk_score >= 0.7 ? 'badge-danger' :
                                                            ind.risk_score >= 0.4 ? 'badge-warning' : 'badge-success'
                                                            }`}>
                                                            {ind.risk_score >= 0.7 ? 'High' :
                                                                ind.risk_score >= 0.4 ? 'Medium' : 'Low'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Recent Violations */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Violations</h3>
                            {violations.length > 0 && (
                                <Link
                                    to={`/violations?video_id=${videoId}`}
                                    className="btn btn-secondary btn-sm"
                                >
                                    Review All
                                </Link>
                            )}
                        </div>

                        {violations.length === 0 ? (
                            <div className="card-body text-center text-muted">
                                No violations detected
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Time</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {violations.slice(0, 5).map((viol) => (
                                            <tr key={viol.id}>
                                                <td>{viol.violation_type}</td>
                                                <td className="text-muted text-sm">
                                                    {formatDuration(viol.timestamp)}
                                                </td>
                                                <td>
                                                    {viol.review_status === 'pending' && (
                                                        <span className="badge badge-warning">Pending</span>
                                                    )}
                                                    {viol.review_status === 'confirmed' && (
                                                        <span className="badge badge-success">Confirmed</span>
                                                    )}
                                                    {viol.review_status === 'rejected' && (
                                                        <span className="badge badge-danger">Rejected</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Message if any */}
                {video.error_message && (
                    <div className="card mt-6" style={{ borderColor: 'var(--danger)' }}>
                        <div className="card-header">
                            <h3 className="card-title" style={{ color: 'var(--danger)' }}>
                                Processing Error
                            </h3>
                        </div>
                        <div className="card-body">
                            <pre className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {video.error_message}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export default VideoDetail
