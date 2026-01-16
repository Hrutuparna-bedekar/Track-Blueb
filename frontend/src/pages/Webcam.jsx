import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Camera, CameraOff, AlertTriangle, Users, Shield, Play, Square,
    CheckCircle, XCircle, RefreshCw, Image, User, ArrowLeft, Clock
} from 'lucide-react'

function Webcam() {
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState(null)
    const [stats, setStats] = useState({
        frame_num: 0,
        persons: 0,
        total_violations: 0,
        recent_violations: []
    })

    // Session review state
    const [sessionEnded, setSessionEnded] = useState(false)
    const [sessionViolations, setSessionViolations] = useState([])
    const [reviewStatus, setReviewStatus] = useState({})
    const [expandedImage, setExpandedImage] = useState(null)
    const [personPpe, setPersonPpe] = useState({}) // track_id -> [ppe items]

    // Tab state for review (like video section)
    const [activeTab, setActiveTab] = useState('violations') // 'individuals' | 'violations'
    const [selectedIndividual, setSelectedIndividual] = useState(null)

    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const displayCanvasRef = useRef(null)
    const wsRef = useRef(null)
    const streamRef = useRef(null)
    const animationRef = useRef(null)
    const violationsRef = useRef([])
    const ppeRef = useRef({}) // person_id -> [ppe items]

    // Cleanup function
    const cleanup = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
            animationRef.current = null
        }
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsStreaming(false)
    }, [])

    // Start webcam streaming
    const startStreaming = async () => {
        try {
            setError(null)
            setSessionEnded(false)
            setSessionViolations([])
            setReviewStatus({})
            setSelectedIndividual(null)
            setPersonPpe({})
            violationsRef.current = []
            ppeRef.current = {}

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/api/webcam/stream`
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                console.log('WebSocket connected')
                setIsStreaming(true)
                sendFrame()
            }

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.error) { console.error('Server error:', data.error); return }

                if (data.session_violations && data.session_violations.length > 0) {
                    violationsRef.current = data.session_violations
                }
                if (data.person_ppe) {
                    ppeRef.current = data.person_ppe
                }

                if (data.frame && displayCanvasRef.current) {
                    const img = new window.Image()
                    img.onload = () => {
                        const ctx = displayCanvasRef.current.getContext('2d')
                        displayCanvasRef.current.width = img.width
                        displayCanvasRef.current.height = img.height
                        ctx.drawImage(img, 0, 0)
                    }
                    img.src = `data:image/jpeg;base64,${data.frame}`
                }

                if (data.stats) setStats(data.stats)

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    animationRef.current = requestAnimationFrame(sendFrame)
                }
            }

            ws.onerror = () => { setError('Connection error. Make sure the backend is running.'); cleanup() }
            ws.onclose = () => {
                setIsStreaming(false)
                if (violationsRef.current.length > 0) {
                    setSessionViolations(violationsRef.current)
                    const initialStatus = {}
                    violationsRef.current.forEach(v => { initialStatus[v.id] = 'pending' })
                    setReviewStatus(initialStatus)
                    setSessionEnded(true)
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to access webcam')
            cleanup()
        }
    }

    const sendFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !wsRef.current) return
        if (wsRef.current.readyState !== WebSocket.OPEN) return
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        wsRef.current.send(dataUrl.split(',')[1])
    }, [])

    const stopStreaming = () => {
        if (violationsRef.current.length > 0) {
            setSessionViolations(violationsRef.current)
            const initialStatus = {}
            violationsRef.current.forEach(v => { initialStatus[v.id] = 'pending' })
            setReviewStatus(initialStatus)
        }
        // Save PPE data
        setPersonPpe(ppeRef.current)
        cleanup()
        setSessionEnded(true)
    }

    const startNewSession = () => {
        setSessionEnded(false)
        setSessionViolations([])
        setReviewStatus({})
        setSelectedIndividual(null)
        setStats({ frame_num: 0, persons: 0, total_violations: 0, recent_violations: [] })
    }

    const handleReview = (violationId, isConfirmed) => {
        setReviewStatus(prev => ({ ...prev, [violationId]: isConfirmed ? 'confirmed' : 'rejected' }))
    }

    useEffect(() => { return () => cleanup() }, [cleanup])

    // Helpers
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'confirmed': return <span className="badge badge-success"><CheckCircle size={12} /> Confirmed</span>
            case 'rejected': return <span className="badge badge-danger"><XCircle size={12} /> Rejected</span>
            default: return <span className="badge badge-warning">Pending</span>
        }
    }

    const getRiskLevel = (count) => {
        if (count >= 3) return { label: 'High', color: 'danger' }
        if (count >= 2) return { label: 'Medium', color: 'warning' }
        return { label: 'Low', color: 'success' }
    }

    // Build individuals from violations
    const individuals = Object.values(
        sessionViolations.reduce((acc, v) => {
            if (!acc[v.person_id]) {
                acc[v.person_id] = {
                    person_id: v.person_id,
                    violations: [],
                    image_path: v.image_path,
                    first_seen: v.timestamp,
                    last_seen: v.timestamp,
                    worn_ppe: v.worn_ppe || personPpe[v.person_id] || []
                }
            }
            acc[v.person_id].violations.push(v)
            acc[v.person_id].last_seen = Math.max(acc[v.person_id].last_seen, v.timestamp)
            // Merge worn_ppe
            if (v.worn_ppe) {
                const existing = new Set(acc[v.person_id].worn_ppe)
                v.worn_ppe.forEach(item => existing.add(item))
                acc[v.person_id].worn_ppe = [...existing]
            }
            return acc
        }, {})
    )

    // ==================== VIOLATIONS VIEW (copied from Violations.jsx) ====================
    const renderViolationsView = () => (
        <div className="card">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                    <h3 className="card-title">Session Violations</h3>
                </div>
                <span className="badge badge-neutral">{sessionViolations.length} violations</span>
            </div>
            <div className="card-body">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem'
                }}>
                    {sessionViolations.map(violation => (
                        <div
                            key={violation.id}
                            className="card"
                            style={{
                                border: reviewStatus[violation.id] === 'confirmed'
                                    ? '2px solid var(--success)'
                                    : reviewStatus[violation.id] === 'rejected'
                                        ? '2px solid var(--danger)'
                                        : '1px solid var(--border)'
                            }}
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
                                        alt={`${violation.type} violation`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => setExpandedImage(violation.image_path)}
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
                                        {violation.type}
                                    </span>
                                    {getStatusBadge(reviewStatus[violation.id])}
                                </div>

                                {/* Details */}
                                <div className="text-sm text-muted mb-3">
                                    <div>Person: Person-{violation.person_id}</div>
                                    <div>Time: {formatTime(violation.timestamp)}</div>
                                    <div>Confidence: {Math.round(violation.confidence * 100)}%</div>
                                </div>

                                {/* Review Actions */}
                                {reviewStatus[violation.id] === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-success btn-sm"
                                            style={{ flex: 1 }}
                                            onClick={() => handleReview(violation.id, true)}
                                        >
                                            <CheckCircle size={14} />
                                            Confirm
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            style={{ flex: 1 }}
                                            onClick={() => handleReview(violation.id, false)}
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
    )

    // ==================== INDIVIDUALS VIEW (copied from Individuals.jsx) ====================
    const renderIndividualsView = () => (
        <div className="grid-2">
            {/* Individuals List */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">All Individuals</h3>
                </div>

                {individuals.length === 0 ? (
                    <div className="empty-state">
                        <Users className="empty-state-icon" />
                        <h3 className="empty-state-title">No Individuals Tracked</h3>
                        <p className="empty-state-description">No individuals were detected in this session</p>
                    </div>
                ) : (
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                        {individuals.map((ind) => {
                            const risk = getRiskLevel(ind.violations.length)
                            const isSelected = selectedIndividual?.person_id === ind.person_id

                            return (
                                <div
                                    key={ind.person_id}
                                    className="flex items-center gap-4 p-4 cursor-pointer transition-all"
                                    style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        background: isSelected ? 'var(--bg-tertiary)' : undefined
                                    }}
                                    onClick={() => setSelectedIndividual(isSelected ? null : ind)}
                                >
                                    {/* Snapshot or placeholder */}
                                    {ind.image_path ? (
                                        <img
                                            src={ind.image_path}
                                            alt={`Person ${ind.person_id}`}
                                            style={{
                                                width: 48, height: 48, objectFit: 'cover',
                                                borderRadius: 8, flexShrink: 0
                                            }}
                                        />
                                    ) : (
                                        <div className="stat-icon primary" style={{ width: 48, height: 48, flexShrink: 0 }}>
                                            <User size={20} />
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">Person #{ind.person_id}</span>
                                            {ind.violations.length >= 2 && (
                                                <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                                                    Repeat
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted mt-1">
                                            <span>{formatTime(ind.first_seen)} - {formatTime(ind.last_seen)}</span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
                                            <span className="font-semibold">{ind.violations.length}</span>
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
                ) : (
                    <div className="card-body">
                        {/* Header with Snapshot */}
                        <div className="flex items-center gap-4 mb-6">
                            {selectedIndividual.image_path ? (
                                <img
                                    src={selectedIndividual.image_path}
                                    alt={`Person ${selectedIndividual.person_id}`}
                                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, cursor: 'pointer' }}
                                    onClick={() => setExpandedImage(selectedIndividual.image_path)}
                                />
                            ) : (
                                <div className="stat-icon primary" style={{ width: 64, height: 64 }}>
                                    <User size={32} />
                                </div>
                            )}
                            <div>
                                <h2 className="text-lg font-semibold">Person #{selectedIndividual.person_id}</h2>
                                <p className="text-muted text-sm">
                                    Tracked from {formatTime(selectedIndividual.first_seen)} to {formatTime(selectedIndividual.last_seen)}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid-3 mb-6">
                            <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="text-2xl font-bold">{selectedIndividual.violations.length}</div>
                                <div className="text-sm text-muted">Violations</div>
                            </div>
                            <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="text-2xl font-bold">
                                    {selectedIndividual.violations.filter(v => reviewStatus[v.id] === 'confirmed').length}
                                </div>
                                <div className="text-sm text-muted">Confirmed</div>
                            </div>
                            <div className="text-center p-4" style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <div className="text-2xl font-bold">
                                    {selectedIndividual.violations.filter(v => reviewStatus[v.id] === 'pending').length}
                                </div>
                                <div className="text-sm text-muted">Pending</div>
                            </div>
                        </div>

                        {/* Worn Equipment (PPE Detected) */}
                        {selectedIndividual.worn_ppe?.length > 0 && (
                            <>
                                <h4 className="font-semibold mb-3" style={{ color: 'var(--success)' }}>
                                    ✓ Worn Equipment (PPE Detected)
                                </h4>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {selectedIndividual.worn_ppe.map((item, idx) => (
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
                                <p className="text-muted text-sm mb-6" style={{ fontSize: '0.75rem' }}>
                                    PPE items detected on this person.
                                </p>
                            </>
                        )}

                        {/* Violation Timeline */}
                        <h4 className="font-semibold mb-3">Violation Timeline</h4>
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                            {selectedIndividual.violations.map((v, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-3 py-2"
                                    style={{ borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <span className="text-muted text-sm" style={{ minWidth: 50 }}>
                                        {formatTime(v.timestamp)}
                                    </span>
                                    <span className="flex-1">{v.type}</span>
                                    {getStatusBadge(reviewStatus[v.id])}
                                </div>
                            ))}
                        </div>

                        {/* Quick Review Actions */}
                        <div className="flex gap-2 mt-6">
                            <button
                                className="btn btn-success flex-1"
                                onClick={() => selectedIndividual.violations.forEach(v => handleReview(v.id, true))}
                            >
                                <CheckCircle size={16} />
                                Confirm All
                            </button>
                            <button
                                className="btn btn-danger flex-1"
                                onClick={() => selectedIndividual.violations.forEach(v => handleReview(v.id, false))}
                            >
                                <XCircle size={16} />
                                Reject All
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    // ==================== SESSION REVIEW PANEL ====================
    const renderSessionReview = () => {
        if (!sessionEnded) return null
        const hasViolations = sessionViolations.length > 0

        return (
            <div className="page-content">
                {/* Header */}
                <div className="page-header mb-6">
                    <div className="page-header-content">
                        <h2 className="page-title">Session Analysis Results</h2>
                        <button className="btn btn-primary" onClick={startStreaming}>
                            <RefreshCw size={16} />
                            New Session
                        </button>
                    </div>
                </div>

                {!hasViolations ? (
                    <div className="card">
                        <div className="card-body text-center py-8">
                            <CheckCircle size={48} style={{ marginBottom: 16, color: 'var(--success)' }} />
                            <h3>No Violations Detected</h3>
                            <p className="text-muted">Great job! No PPE violations were found in this session.</p>
                            <button className="btn btn-primary mt-4" onClick={startStreaming}>
                                <Play size={16} />
                                Start New Analysis
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="stats-grid mb-6">
                            <div className="stat-card">
                                <div className="stat-icon primary"><Users size={24} /></div>
                                <div className="stat-content">
                                    <div className="stat-value">{individuals.length}</div>
                                    <div className="stat-label">Individuals</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon warning"><AlertTriangle size={24} /></div>
                                <div className="stat-content">
                                    <div className="stat-value">{sessionViolations.length}</div>
                                    <div className="stat-label">Violations</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon success"><CheckCircle size={24} /></div>
                                <div className="stat-content">
                                    <div className="stat-value">{Object.values(reviewStatus).filter(s => s === 'confirmed').length}</div>
                                    <div className="stat-label">Confirmed</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon danger"><XCircle size={24} /></div>
                                <div className="stat-content">
                                    <div className="stat-value">{Object.values(reviewStatus).filter(s => s === 'rejected').length}</div>
                                    <div className="stat-label">Rejected</div>
                                </div>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 mb-6">
                            <button
                                className={`btn ${activeTab === 'individuals' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveTab('individuals')}
                            >
                                <Users size={16} />
                                View Individuals ({individuals.length})
                            </button>
                            <button
                                className={`btn ${activeTab === 'violations' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setActiveTab('violations')}
                            >
                                <AlertTriangle size={16} />
                                View Violations ({sessionViolations.length})
                            </button>
                        </div>

                        {/* Content based on tab */}
                        {activeTab === 'violations' ? renderViolationsView() : renderIndividualsView()}
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="webcam-page">
            <div className="page-header">
                <div className="page-header-content">
                    <h1><Camera className="page-icon" />Live Webcam Analysis</h1>
                    <p className="page-description">Real-time PPE violation detection using your webcam</p>
                </div>
                <div className="webcam-controls">
                    {!isStreaming ? (
                        <button className="btn btn-primary btn-lg" onClick={startStreaming}>
                            <Play size={20} />Start Camera
                        </button>
                    ) : (
                        <button className="btn btn-danger btn-lg" onClick={stopStreaming}>
                            <Square size={20} />Stop Camera
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-danger">
                    <AlertTriangle size={20} /><span>{error}</span>
                </div>
            )}

            {/* Live Streaming View */}
            {!sessionEnded && (
                <div className="webcam-container">
                    <div className="webcam-main">
                        <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div className="video-display">
                            {isStreaming ? (
                                <canvas ref={displayCanvasRef} className="webcam-canvas" />
                            ) : (
                                <div className="webcam-placeholder">
                                    <CameraOff size={64} />
                                    <p>Click "Start Camera" to begin live analysis</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="webcam-sidebar">
                        <div className="stats-card">
                            <h3>Live Statistics</h3>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <Users className="stat-icon" />
                                    <div className="stat-content">
                                        <span className="stat-value">{stats.persons}</span>
                                        <span className="stat-label">Persons Detected</span>
                                    </div>
                                </div>
                                <div className="stat-item">
                                    <AlertTriangle className="stat-icon violation" />
                                    <div className="stat-content">
                                        <span className="stat-value">{stats.total_violations}</span>
                                        <span className="stat-label">Total Violations</span>
                                    </div>
                                </div>
                                <div className="stat-item">
                                    <Shield className="stat-icon" />
                                    <div className="stat-content">
                                        <span className="stat-value">{stats.frame_num}</span>
                                        <span className="stat-label">Frames Processed</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="violations-card">
                            <h3>Recent Violations</h3>
                            <div className="violations-list">
                                {stats.recent_violations.length === 0 ? (
                                    <p className="no-violations">No violations detected yet</p>
                                ) : (
                                    stats.recent_violations.map((v, idx) => (
                                        <div key={idx} className="violation-item">
                                            <span className="violation-badge">{v.type}</span>
                                            <span className="violation-person">Person-{v.person_id}</span>
                                            <span className="violation-confidence">{Math.round(v.confidence * 100)}%</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Review */}
            {renderSessionReview()}

            {/* Image Modal */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, cursor: 'pointer'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img src={expandedImage} alt="Violation" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
                </div>
            )}
        </div>
    )
}

export default Webcam
