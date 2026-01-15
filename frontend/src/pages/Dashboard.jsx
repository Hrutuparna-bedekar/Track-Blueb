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
    RefreshCw
} from 'lucide-react'
import { getDashboardStats, getRepeatOffenders } from '../services/api'

function Dashboard() {
    const [stats, setStats] = useState(null)
    const [offenders, setOffenders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">Overview of violation tracking system</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="page-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <Video size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_videos || 0}</div>
                            <div className="stat-label">Total Videos</div>
                            {stats?.videos_processing > 0 && (
                                <div className="stat-change">
                                    <Clock size={12} />
                                    {stats.videos_processing} processing
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Users size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_individuals || 0}</div>
                            <div className="stat-label">Individuals Tracked</div>
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
                            <TrendingUp size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.repeat_offenders_count || 0}</div>
                            <div className="stat-label">Repeat Offenders</div>
                        </div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid-2">
                    {/* Violation Status */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Review Status</h3>
                            <Link to="/violations" className="btn btn-ghost btn-sm">
                                View All <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="card-body">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={18} className="text-success" style={{ color: 'var(--success)' }} />
                                        <span>Confirmed</span>
                                    </div>
                                    <span className="font-semibold">{stats?.confirmed_violations || 0}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <XCircle size={18} style={{ color: 'var(--danger)' }} />
                                        <span>Rejected</span>
                                    </div>
                                    <span className="font-semibold">{stats?.rejected_violations || 0}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock size={18} style={{ color: 'var(--warning)' }} />
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

                    {/* Violations by Type */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Violations by Type</h3>
                        </div>
                        <div className="card-body">
                            {stats?.violations_by_type && Object.keys(stats.violations_by_type).length > 0 ? (
                                <div className="flex flex-col gap-4">
                                    {Object.entries(stats.violations_by_type)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 5)
                                        .map(([type, count]) => (
                                            <div key={type} className="flex items-center justify-between">
                                                <span className="text-sm">{type}</span>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="progress-bar"
                                                        style={{ width: 100, height: 4 }}
                                                    >
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{
                                                                width: `${(count / stats.total_violations) * 100}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="font-semibold text-sm">{count}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="text-muted">No violations detected yet</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Repeat Offenders */}
                {offenders.length > 0 && (
                    <div className="card mt-4">
                        <div className="card-header">
                            <h3 className="card-title">Repeat Offenders</h3>
                            <span className="badge badge-danger">{offenders.length} flagged</span>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Track ID</th>
                                        <th>Video</th>
                                        <th>Total Violations</th>
                                        <th>Confirmed</th>
                                        <th>Most Common Type</th>
                                        <th>Risk Score</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {offenders.slice(0, 5).map((offender) => (
                                        <tr key={offender.individual_id}>
                                            <td>
                                                <span className="font-semibold">#{offender.track_id}</span>
                                            </td>
                                            <td>Video #{offender.video_id}</td>
                                            <td>
                                                <span className="badge badge-warning">
                                                    {offender.total_violations}
                                                </span>
                                            </td>
                                            <td>{offender.confirmed_violations}</td>
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
                    </div>
                )}

                {/* Quick Actions */}
                <div className="card mt-4">
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
