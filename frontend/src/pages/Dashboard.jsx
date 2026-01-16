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
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ComposedChart, AreaChart, Bar, Area
} from 'recharts'
import { getDashboardStats, getRepeatOffenders } from '../services/api'
import { useLanguage } from '../context/LanguageContext'

function Dashboard() {
    const [stats, setStats] = useState(null)
    const [offenders, setOffenders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [offendersExpanded, setOffendersExpanded] = useState(false)
    const { t } = useLanguage()

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
            setError(t('Failed to load dashboard data'))
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
                            <h1 className="page-title">{t('Dashboard')}</h1>
                            <p className="page-subtitle">{t('Loading...')}</p>
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
                    <h3 className="empty-state-title">{t('Error Loading Dashboard')}</h3>
                    <p className="empty-state-description">{error}</p>
                    <button className="btn btn-primary" onClick={fetchData}>
                        <RefreshCw size={16} />
                        {t('Retry')}
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
                        <h1 className="page-title">{t('Dashboard')}</h1>
                        <p className="page-subtitle">{t('Compliance Overview & Analytics')}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        {t('Refresh')}
                    </button>
                </div>
            </div>

            <style>{`
                .dashboard-card {
                    background: var(--bg-surface);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                    border: 1px solid var(--border-color);
                }
                .dashboard-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
                    border-color: var(--border-color-strong);
                }
                .review-status-row {
                    text-decoration: none;
                    display: block;
                }
                .review-status-row:hover .font-semibold {
                   transform: scale(1.05);
                   transition: transform 0.2s;
                }
                .recent-event-item:hover {
                    background-color: var(--bg-tertiary);
                }
            `}</style>

            <div className="page-content">
                {/* 1. Overall Compliance Overview */}
                <div className="stats-grid mb-6">
                    <div className="stat-card dashboard-card">
                        <div className="stat-icon success">
                            <Users size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_individuals || 0}</div>
                            <div className="stat-label">{t('People Detected')}</div>
                        </div>
                    </div>

                    <div className="stat-card dashboard-card">
                        <div className="stat-icon primary">
                            <Shield size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value" style={{ color: 'var(--success)' }}>
                                {stats?.compliance_rate || 0}%
                            </div>
                            <div className="stat-label">{t('Compliance Rate')}</div>
                        </div>
                    </div>

                    <div className="stat-card dashboard-card">
                        <div className="stat-icon warning">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_violations || 0}</div>
                            <div className="stat-label">{t('Total Violations')}</div>
                            <div className="stat-change">
                                <Clock size={12} />
                                {stats?.pending_violations || 0} {t('pending review')}
                            </div>
                        </div>
                    </div>

                    <div className="stat-card dashboard-card">
                        <div className="stat-icon danger">
                            <ShieldAlert size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value" style={{ color: 'var(--danger)' }}>
                                {stats?.violation_rate || 0}%
                            </div>
                            <div className="stat-label">{t('Violation Rate')}</div>
                        </div>
                    </div>
                </div>

                {/* 2. PPE-wise Violation Breakdown + 3. Time-Based Analysis */}
                <div className="grid-2 mb-6">
                    {/* PPE-wise Breakdown */}
                    <div className="card dashboard-card">
                        <div className="card-header">
                            <h3 className="card-title">{t('PPE Violation Breakdown')}</h3>
                        </div>
                        <div className="card-body" style={{ height: 300 }}>
                            {stats?.violations_by_type && Object.keys(stats.violations_by_type).length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(stats.violations_by_type).map(([name, value]) => ({ name: t(name), value }))}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {Object.entries(stats.violations_by_type).map(([name], index) => {
                                                const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
                                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                            })}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted">
                                    {t('No violations detected yet')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shift-Based Analysis */}
                    <div className="card dashboard-card">
                        <div className="card-header">
                            <h3 className="card-title">{t('Violations by Shift')}</h3>
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
                                            <div className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>{t(shift)}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Violation Trend Graph */}
                <div className="card dashboard-card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <BarChart3 size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                            {t('7-Day Violation Trend')}
                        </h3>
                    </div>
                    <div className="card-body" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={(() => {
                                    // Use day name from API if available, otherwise parse date
                                    let data = stats?.daily_violations || []

                                    // Map to simpler format using day from API or fallback to parsing
                                    data = data.map(d => ({
                                        name: t(d.day || new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })),
                                        violations: d.count
                                    }))

                                    return data
                                })()}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" stroke="var(--text-muted)" />
                                <YAxis stroke="var(--text-muted)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="violations" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Confidence & Review Status Grid */}
                <div className="grid-2 mb-6">
                    {/* Review Status */}
                    <div className="card dashboard-card" style={{ gridColumn: 'span 2' }}>
                        <div className="card-header">
                            <h3 className="card-title">{t('Review Status')}</h3>
                            <Link to="/violations" className="btn btn-ghost btn-sm">
                                {t('View All')} <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="card-body">
                            <div className="flex flex-col gap-3">
                                <Link to="/violations?review_status=confirmed" className="review-status-row">
                                    <div className="flex items-center justify-between p-2 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{t('Confirmed')}</span>
                                        </div>
                                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{stats?.confirmed_violations || 0}</span>
                                    </div>
                                </Link>
                                <Link to="/violations?review_status=rejected" className="review-status-row">
                                    <div className="flex items-center justify-between p-2 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <div className="flex items-center gap-2">
                                            <XCircle size={16} style={{ color: 'var(--danger)' }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{t('Rejected')}</span>
                                        </div>
                                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{stats?.rejected_violations || 0}</span>
                                    </div>
                                </Link>
                                <Link to="/violations?review_status=pending" className="review-status-row">
                                    <div className="flex items-center justify-between p-2 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} style={{ color: 'var(--warning)' }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{t('Pending')}</span>
                                        </div>
                                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{stats?.pending_violations || 0}</span>
                                    </div>
                                </Link>
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
                                        {Math.round(((stats.confirmed_violations + stats.rejected_violations) / stats.total_violations) * 100)}% {t('reviewed')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Advanced Analytics Grid */}
                <div className="grid-2 mb-6">
                    {/* Correlation Chart: Violations vs People */}
                    <div className="card dashboard-card">
                        <div className="card-header">
                            <h3 className="card-title">{t('Crowd vs. Safety Correlation')}</h3>
                        </div>
                        <div className="card-body" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={stats?.correlation_data || []}
                                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                                >
                                    <CartesianGrid stroke="#f5f5f5" strokeOpacity={0.1} />
                                    <XAxis dataKey="video_name" hide />
                                    <YAxis yAxisId="left" orientation="left" stroke="var(--danger)" label={{ value: t('Violations'), angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }} />
                                    <YAxis yAxisId="right" orientation="right" stroke="var(--accent)" label={{ value: t('People In Frame'), angle: 90, position: 'insideRight', fill: 'var(--text-muted)' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="right" dataKey="people_count" name={t('People Count')} fill="var(--accent)" opacity={0.3} barSize={20} />
                                    <Line yAxisId="left" type="monotone" dataKey="violation_count" name={t('Violations')} stroke="var(--danger)" strokeWidth={2} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Stacked Area Chart: PPE Trends */}
                    <div className="card dashboard-card">
                        <div className="card-header">
                            <h3 className="card-title">{t('Missing PPE Trends (30 Days)')}</h3>
                        </div>
                        <div className="card-body" style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={stats?.ppe_trends || []}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="colorGoggles" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorHelmet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorShoes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--info)" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} stroke="var(--text-muted)" />
                                    <YAxis stroke="var(--text-muted)" />
                                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                    <Legend />
                                    <Area type="monotone" dataKey="Missing Goggles" name={t('Missing Goggles')} stackId="1" stroke="var(--accent-primary)" fill="url(#colorGoggles)" />
                                    <Area type="monotone" dataKey="Missing Helmet" name={t('Missing Helmet')} stackId="1" stroke="var(--warning)" fill="url(#colorHelmet)" />
                                    <Area type="monotone" dataKey="Missing Shoes" name={t('Missing Shoes')} stackId="1" stroke="var(--info)" fill="url(#colorShoes)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Recent Events Feed */}
                <div className="card dashboard-card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Activity size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                            {t('Recent Events')}
                        </h3>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        {stats?.recent_events?.length > 0 ? (
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {stats.recent_events.map(event => (
                                    <div
                                        key={event.id}
                                        className="recent-event-item"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '12px 16px',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer'
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
                                            <div className="font-semibold">{t('Person')} #{event.person_id}</div>
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
                                {t('No recent events')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Repeat Offenders - Collapsible Card */}
                {offenders.length > 0 && (
                    <div className="card dashboard-card mb-6">
                        <div
                            className="card-header"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setOffendersExpanded(!offendersExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="card-title">{t('Top 5 Repeat Offenders (Missing PPE)')}</h3>
                                <span className="badge badge-danger">{t('High Risk')}</span>
                            </div>
                            {offendersExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        {offendersExpanded && (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('Person')}</th>
                                            <th>{t('Video')}</th>
                                            <th>{t('Violations')}</th>
                                            <th>{t('Most Common')}</th>
                                            <th>{t('Risk')}</th>
                                            <th>{t('Action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {offenders.slice(0, 5).map((offender) => (
                                            <tr key={offender.individual_id}>
                                                <td>
                                                    <span className="font-semibold">{t('Person')} #{offender.track_id}</span>
                                                </td>
                                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {offender.video_name || `Video #${offender.video_id}`}
                                                </td>
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
                                                        to={`/individuals/${offender.video_id}?track_id=${offender.track_id}`}
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        {t('View Record')}
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
                        <h3 className="card-title">{t('Quick Actions')}</h3>
                    </div>
                    <div className="card-body">
                        <div className="flex gap-4">
                            <Link to="/videos" className="btn btn-primary">
                                <Video size={16} />
                                {t('Upload New Video')}
                            </Link>
                            <Link to="/violations?review_status=pending" className="btn btn-secondary">
                                <AlertTriangle size={16} />
                                {t('Review Pending')} ({stats?.pending_violations || 0})
                            </Link>
                        </div>
                    </div>
                </div>
            </div >
        </>
    )
}

export default Dashboard
