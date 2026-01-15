import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Video,
    Users,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    ArrowRight,
    RefreshCw,
    Shield,
    ShieldAlert,
    Activity,
    Sun,
    Sunset,
    Moon,
    Image,
    ChevronDown,
    ChevronUp,
    BarChart3
} from 'lucide-react'
import { getDashboardStats, getRepeatOffenders } from '../services/api'

function Dashboard() {
    const [stats, setStats] = useState(null)
    const [offenders, setOffenders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [offendersExpanded, setOffendersExpanded] = useState(false)

    const fetchData = async () => {
        try {
            setLoading(true)
            const [statsRes, offendersRes] = await Promise.all([
                getDashboardStats(),
                getRepeatOffenders(2)
            ])
            setStats(statsRes.data)
            setOffenders(offendersRes.data.offenders || [])
        } catch (err) {
            setError('Failed to load dashboard data')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        // Poll for updates every 30 seconds
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    if (loading && !stats) {
        return (
            <>
                <div className="page-header">
                    <div className="page-header-content">
                        <div>
                            <h1 className="page-title">Dashboard</h1>
                            <p className="page-subtitle">Loading...</p>
                        </div>
                    </div>
                </div>
                <div className="page-content">
                    <div className="stats-grid">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="stat-card">
                                <div className="skeleton" style={{ width: 48, height: 48 }} />
                                <div className="stat-content">
                                    <div className="skeleton" style={{ width: 80, height: 28, marginBottom: 8 }} />
                                    <div className="skeleton" style={{ width: 120, height: 16 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )
    }

    if (error) {
        return (
            <div className="page-content">
                <div className="empty-state">
                    <AlertTriangle className="empty-state-icon" />
                    <h3 className="empty-state-title">Error Loading Dashboard</h3>
                    <p className="empty-state-description">{error}</p>
                    <button className="btn btn-primary" onClick={fetchData}>
                        <RefreshCw size={16} />
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // Calculate bar heights for trend chart
    const maxViolations = Math.max(...(stats?.daily_violations?.map(d => d.count) || [1]), 1)

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">Compliance Overview & Analytics</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="page-content">
                {/* 1. Overall Compliance Overview */}
                <div className="stats-grid mb-6">
                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Users size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_individuals || 0}</div>
                            <div className="stat-label">People Detected</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <Shield size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value" style={{ color: 'var(--success)' }}>
                                {stats?.compliance_rate || 0}%
                            </div>
                            <div className="stat-label">Compliance Rate</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_violations || 0}</div>
                            <div className="stat-label">Total Violations</div>
                            <div className="stat-change">
                                <Clock size={12} />
                                {stats?.pending_violations || 0} pending review
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon danger">
                            <ShieldAlert size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value" style={{ color: 'var(--danger)' }}>
                                {stats?.violation_rate || 0}%
                            </div>
                            <div className="stat-label">Violation Rate</div>
                        </div>
                    </div>
                </div>

                {/* 2. PPE-wise Violation Breakdown + 3. Time-Based Analysis */}
                <div className="grid-2 mb-6">
                    {/* PPE-wise Breakdown */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">PPE Violation Breakdown</h3>
                        </div>
                        <div className="card-body">
                            {stats?.violations_by_type && Object.keys(stats.violations_by_type).length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {Object.entries(stats.violations_by_type)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([type, count]) => {
                                            const pct = stats.total_violations > 0 ? (count / stats.total_violations * 100) : 0
                                            return (
                                                <div key={type}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-semibold">{type}</span>
                                                        <span className="text-sm">{count} ({pct.toFixed(1)}%)</span>
                                                    </div>
                                                    <div className="progress-bar" style={{ height: 8 }}>
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{
                                                                width: `${pct}%`,
                                                                background: type.toLowerCase().includes('helmet') ? 'var(--warning)' :
                                                                    type.toLowerCase().includes('shoe') ? 'var(--info)' :
                                                                        type.toLowerCase().includes('goggle') ? 'var(--accent-primary)' :
                                                                            'var(--danger)'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            ) : (
                                <p className="text-muted">No violations detected yet</p>
                            )}
                        </div>
                    </div>

                    {/* Shift-Based Analysis */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Violations by Shift</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                {['morning', 'evening', 'night'].map(shift => {
                                    const count = stats?.violations_by_shift?.[shift] || 0
                                    const Icon = shift === 'morning' ? Sun : shift === 'evening' ? Sunset : Moon
                                    const color = shift === 'morning' ? '#f59e0b' : shift === 'evening' ? '#ef4444' : '#6366f1'
                                    return (
                                        <div
                                            key={shift}
                                            style={{
                                                flex: 1,
                                                textAlign: 'center',
                                                padding: 16,
                                                borderRadius: 12,
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-color)'
                                            }}
                                        >
                                            <Icon size={32} style={{ color, marginBottom: 8 }} />
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{count}</div>
                                            <div className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>{shift}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Violation Trend Graph */}
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <BarChart3 size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                            7-Day Violation Trend
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                            {stats?.daily_violations?.map((day, idx) => {
                                const heightPct = maxViolations > 0 ? (day.count / maxViolations * 100) : 0
                                const isToday = idx === stats.daily_violations.length - 1
                                return (
                                    <div key={day.date} style={{ flex: 1, textAlign: 'center' }}>
                                        <div
                                            style={{
                                                height: Math.max(heightPct * 1.2, 4),
                                                background: isToday ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                borderRadius: '4px 4px 0 0',
                                                marginBottom: 8,
                                                transition: 'height 0.3s ease'
                                            }}
                                            title={`${day.date}: ${day.count} violations`}
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{day.count}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Confidence & Review Status Grid */}
                <div className="grid-2 mb-6">
                    {/* Confidence Metrics */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Detection Confidence</h3>
                        </div>
                        <div className="card-body">
                            <div className="flex items-center justify-between mb-4">
                                <span>Average Confidence</span>
                                <span className="font-semibold" style={{
                                    color: (stats?.avg_detection_confidence || 0) >= 0.7 ? 'var(--success)' :
                                        (stats?.avg_detection_confidence || 0) >= 0.5 ? 'var(--warning)' : 'var(--danger)'
                                }}>
                                    {((stats?.avg_detection_confidence || 0) * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Low Confidence Detections</span>
                                <span className="badge badge-warning">{stats?.low_confidence_count || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Review Status */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Review Status</h3>
                            <Link to="/violations" className="btn btn-ghost btn-sm">
                                View All <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="card-body">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                                        <span>Confirmed</span>
                                    </div>
                                    <span className="font-semibold">{stats?.confirmed_violations || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <XCircle size={16} style={{ color: 'var(--danger)' }} />
                                        <span>Rejected</span>
                                    </div>
                                    <span className="font-semibold">{stats?.rejected_violations || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} style={{ color: 'var(--warning)' }} />
                                        <span>Pending</span>
                                    </div>
                                    <span className="font-semibold">{stats?.pending_violations || 0}</span>
                                </div>
                            </div>
                            {stats?.total_violations > 0 && (
                                <div className="mt-4">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-bar-fill"
                                            style={{
                                                width: `${((stats.confirmed_violations + stats.rejected_violations) / stats.total_violations) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <p className="text-sm text-muted mt-2">
                                        {Math.round(((stats.confirmed_violations + stats.rejected_violations) / stats.total_violations) * 100)}% reviewed
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Events Feed */}
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Activity size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                            Recent Events
                        </h3>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {stats?.recent_events?.length > 0 ? (
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {stats.recent_events.map(event => (
                                    <div
                                        key={event.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-color)'
                                        }}
                                    >
                                        {event.image_path ? (
                                            <img
                                                src={event.image_path.startsWith('/') ? event.image_path : `/violation_images/${event.image_path.split('/').pop()}`}
                                                alt="Snapshot"
                                                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 8,
                                                background: 'var(--bg-tertiary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Image size={20} className="text-muted" />
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div className="font-semibold">Person #{event.person_id}</div>
                                            <div className="text-sm text-muted">
                                                {event.violation_type} • {event.video_name}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="badge badge-warning">{(event.confidence * 100).toFixed(0)}%</div>
                                            <div className="text-xs text-muted mt-1">
                                                {new Date(event.detected_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-muted" style={{ padding: 24, textAlign: 'center' }}>
                                No recent events
                            </div>
                        )}
                    </div>
                </div>

                {/* Repeat Offenders - Collapsible Card */}
                {offenders.length > 0 && (
                    <div className="card mb-6">
                        <div
                            className="card-header"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setOffendersExpanded(!offendersExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="card-title">Repeat Offenders</h3>
                                <span className="badge badge-danger">{offenders.length} flagged</span>
                            </div>
                            {offendersExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        {offendersExpanded && (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Person</th>
                                            <th>Video</th>
                                            <th>Violations</th>
                                            <th>Most Common</th>
                                            <th>Risk</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {offenders.slice(0, 10).map((offender) => (
                                            <tr key={offender.individual_id}>
                                                <td>
                                                    <span className="font-semibold">Person #{offender.track_id}</span>
                                                </td>
                                                <td>Video #{offender.video_id}</td>
                                                <td>
                                                    <span className="badge badge-warning">{offender.total_violations}</span>
                                                </td>
                                                <td>{offender.most_common_violation || '-'}</td>
                                                <td>
                                                    <span className={`badge ${offender.risk_score >= 0.7 ? 'badge-danger' :
                                                        offender.risk_score >= 0.4 ? 'badge-warning' : 'badge-success'
                                                        }`}>
                                                        {(offender.risk_score * 100).toFixed(0)}%
                                                    </span>
                                                </td>
                                                <td>
                                                    <Link
                                                        to={`/individuals/${offender.video_id}`}
                                                        className="btn btn-ghost btn-sm"
                                                    >
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Actions */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div className="card-body">
                        <div className="flex gap-4">
                            <Link to="/videos" className="btn btn-primary">
                                <Video size={16} />
                                Upload New Video
                            </Link>
                            <Link to="/violations?review_status=pending" className="btn btn-secondary">
                                <AlertTriangle size={16} />
                                Review Pending ({stats?.pending_violations || 0})
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Dashboard
