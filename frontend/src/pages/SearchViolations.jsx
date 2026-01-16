import { useState, useEffect } from 'react'
import {
    Search,
    Calendar,
    Sun,
    Sunset,
    Moon,
    Play,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Users,
    FileVideo,
    Eye,
    X,
    RefreshCw,
    Filter
} from 'lucide-react'
import { searchVideos, getAvailableDates } from '../services/api'
import { useLanguage } from '../context/LanguageContext'

function SearchViolations() {
    const { t } = useLanguage()
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedShift, setSelectedShift] = useState('')
    const [violationType, setViolationType] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [results, setResults] = useState([])
    const [totalVideos, setTotalVideos] = useState(0)
    const [totalViolations, setTotalViolations] = useState(0)
    const [availableDates, setAvailableDates] = useState([])
    const [expandedVideos, setExpandedVideos] = useState({})
    const [videoPlayer, setVideoPlayer] = useState(null)
    const [expandedDates, setExpandedDates] = useState({})

    // Fetch available dates on mount
    useEffect(() => {
        fetchAvailableDates()
    }, [])

    const fetchAvailableDates = async () => {
        try {
            const res = await getAvailableDates()
            setAvailableDates(res.data.dates || [])
        } catch (err) {
            console.error('Failed to fetch available dates', err)
        }
    }

    const handleSearch = async () => {
        if (!searchDate) {
            setError('Please select a date to search')
            return
        }

        try {
            setLoading(true)
            setError(null)
            const res = await searchVideos(searchDate, selectedShift, violationType)
            setResults(res.data.results || [])
            setTotalVideos(res.data.total_videos || 0)
            setTotalViolations(res.data.total_violations || 0)

            // Auto-expand all dates
            const expanded = {}
            res.data.results?.forEach(r => {
                expanded[r.date] = true
            })
            setExpandedDates(expanded)
        } catch (err) {
            setError('Failed to search videos')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const toggleVideo = (videoId) => {
        setExpandedVideos(prev => ({
            ...prev,
            [videoId]: !prev[videoId]
        }))
    }

    const toggleDate = (date) => {
        setExpandedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }))
    }

    const formatDuration = (seconds) => {
        if (!seconds) return '-'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatTime = (dateStr) => {
        const date = new Date(dateStr)
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }

    const getShiftIcon = (shift) => {
        switch (shift) {
            case 'morning': return <Sun size={18} style={{ color: '#f59e0b' }} />
            case 'evening': return <Sunset size={18} style={{ color: '#f97316' }} />
            case 'night': return <Moon size={18} style={{ color: '#6366f1' }} />
            default: return <Sun size={18} />
        }
    }

    const getShiftColor = (shift) => {
        switch (shift) {
            case 'morning': return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            case 'evening': return 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'
            case 'night': return 'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)'
            default: return 'var(--bg-tertiary)'
        }
    }

    const renderVideoCard = (video) => {
        const isExpanded = expandedVideos[video.id]

        return (
            <div key={video.id} className="card mb-4" style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
            }}>
                {/* Video Header - Clickable */}
                <div
                    onClick={() => toggleVideo(video.id)}
                    style={{
                        padding: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <div className="flex items-center gap-3" style={{ minWidth: '280px', flex: '1 1 auto' }}>
                        <FileVideo size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <div style={{ wordBreak: 'break-word' }}>
                            <div className="font-semibold">{video.original_filename}</div>
                            <div className="text-sm text-muted">
                                {formatDuration(video.duration)} • {formatTime(video.uploaded_at)}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', flex: '0 1 auto' }}>
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-muted" />
                            <span>{video.total_individuals}</span>
                        </div>
                        {video.total_violations > 0 ? (
                            <span className="badge badge-warning">
                                <AlertTriangle size={12} />
                                {video.total_violations} {t('violations')}
                            </span>
                        ) : (
                            <span className="badge badge-success">{t('No violations')}</span>
                        )}
                        {video.annotated_video_path && (
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setVideoPlayer(video)
                                }}
                            >
                                <Play size={14} />
                                {t('Watch')}
                            </button>
                        )}
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>

                {/* Expanded Content - Violations */}
                {isExpanded && (
                    <div style={{
                        borderTop: '1px solid var(--border-color)',
                        padding: '16px',
                        background: 'var(--bg-tertiary)'
                    }}>
                        {/* Violation Type Summary */}
                        {Object.keys(video.violation_types || {}).length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-sm font-semibold mb-2">{t('Violation Summary')}</h4>
                                <div className="flex flex-wrap" style={{ gap: '8px 16px' }}>
                                    {Object.entries(video.violation_types).map(([type, count]) => (
                                        <div key={type} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }}></span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{type}:</span>
                                            <span style={{ fontWeight: 600 }}>{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Violations with Snapshots - Grouped by Person */}
                        {video.violations?.length > 0 ? (
                            <div>
                                <h4 className="text-sm font-semibold mb-3">
                                    {t('Violation Snapshots')} ({video.violations.length}) - {t('Grouped by Person')}
                                </h4>
                                {(() => {
                                    // Group violations by person_id
                                    const groupedByPerson = video.violations.reduce((acc, v) => {
                                        const personKey = v.person_id || 'unknown'
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {sortedPersonKeys.map((personKey, index) => {
                                                const personViolations = groupedByPerson[personKey]
                                                return (
                                                    <div key={personKey} style={{
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: 12,
                                                        overflow: 'hidden',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        {/* Person Header/Tag */}
                                                        <div style={{
                                                            padding: '14px 18px',
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
                                                                    fontWeight: 'bold',
                                                                    fontSize: 16,
                                                                    border: '1px solid var(--border-color)'
                                                                }}>
                                                                    <Users size={18} />
                                                                </div>
                                                                <div>
                                                                    <span style={{
                                                                        color: 'var(--text-primary)',
                                                                        fontWeight: 700,
                                                                        fontSize: '1rem',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.5px'
                                                                    }}>
                                                                        {t('Person')} {index + 1}
                                                                    </span>
                                                                    <div style={{
                                                                        color: 'var(--text-muted)',
                                                                        fontSize: '0.75rem',
                                                                        marginTop: 2
                                                                    }}>
                                                                        {t('ID')}: {personKey}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span style={{
                                                                background: 'var(--bg-primary)',
                                                                color: 'var(--text-primary)',
                                                                padding: '6px 14px',
                                                                borderRadius: 20,
                                                                fontWeight: 600,
                                                                fontSize: '0.85rem',
                                                                border: '1px solid var(--border-color)'
                                                            }}>
                                                                {personViolations.length} {personViolations.length !== 1 ? t('violations') : t('violation')}
                                                            </span>
                                                        </div>

                                                        {/* Person's Violations Grid */}
                                                        <div style={{
                                                            padding: 12,
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                            gap: '12px'
                                                        }}>
                                                            {personViolations.map((v) => (
                                                                <div key={v.id} style={{
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: 8,
                                                                    overflow: 'hidden',
                                                                    border: '1px solid var(--border-color)'
                                                                }}>
                                                                    {v.image_path ? (
                                                                        <img
                                                                            src={v.image_path}
                                                                            alt={v.type}
                                                                            style={{
                                                                                width: '100%',
                                                                                height: 100,
                                                                                objectFit: 'cover'
                                                                            }}
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none'
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <div style={{
                                                                            width: '100%',
                                                                            height: 100,
                                                                            background: 'var(--bg-secondary)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}>
                                                                            <Eye size={28} className="text-muted" />
                                                                        </div>
                                                                    )}
                                                                    <div style={{ padding: 8 }}>
                                                                        <div className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>
                                                                            {v.type}
                                                                        </div>
                                                                        <div className="text-xs text-muted">
                                                                            {t('Confidence')}: {(v.confidence * 100).toFixed(0)}%
                                                                        </div>
                                                                        <div className="text-xs text-muted">
                                                                            {t('Time')}: {v.timestamp?.toFixed(1)}s
                                                                        </div>
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
                        ) : (
                            <p className="text-muted text-sm">{t('No violations detected in this video.')}</p>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const renderShiftColumn = (title, icon, videos, bgGradient) => (
        <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{
                background: bgGradient,
                padding: '12px 16px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 0
            }}>
                {icon}
                <span className="font-semibold" style={{ color: '#1f2937' }}>{title}</span>
                <span className="badge badge-neutral" style={{ marginLeft: 'auto' }}>
                    {videos.length} videos
                </span>
            </div>
            <div style={{
                background: 'var(--bg-tertiary)',
                padding: 12,
                borderRadius: '0 0 8px 8px',
                minHeight: 200,
                border: '1px solid var(--border-color)',
                borderTop: 'none'
            }}>
                {videos.length > 0 ? (
                    videos.map(video => renderVideoCard(video))
                ) : (
                    <div className="text-center text-muted py-8">
                        <FileVideo size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <p>{t('No videos for this shift')}</p>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">{t('Search for Violations')}</h1>
                        <p className="page-subtitle">{t('Query analyzed videos by date and view violations')}</p>
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Search Form */}
                <div className="card mb-6">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Filter size={18} />
                            Search Filters
                        </h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            {/* Date Picker */}
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="form-label">
                                    <Calendar size={14} />
                                    {t('Select Date')}
                                </label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={searchDate}
                                    onChange={(e) => setSearchDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>

                            {/* Shift Filter */}
                            <div style={{ flex: 1, minWidth: 150 }}>
                                <label className="form-label">{t('Shift (Optional)')}</label>
                                <select
                                    className="form-select"
                                    value={selectedShift}
                                    onChange={(e) => setSelectedShift(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">{t('All Shifts')}</option>
                                    <option value="morning">{t('Morning')}</option>
                                    <option value="evening">{t('Evening')}</option>
                                    <option value="night">{t('Night')}</option>
                                </select>
                            </div>

                            {/* Violation Type Filter */}
                            <div style={{ flex: 1, minWidth: 150 }}>
                                <label className="form-label">{t('Violation Type (Optional)')}</label>
                                <select
                                    className="form-select"
                                    value={violationType}
                                    onChange={(e) => setViolationType(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">{t('All Types')}</option>
                                    <option value="No Helmet">{t('No Helmet')}</option>
                                    <option value="No Face Mask">{t('No Face Mask')}</option>
                                    <option value="No Safety Boots">{t('No Safety Boots')}</option>
                                    <option value="No Goggles">{t('No Goggles')}</option>
                                </select>
                            </div>

                            {/* Search Button */}
                            <button
                                className="btn btn-primary"
                                onClick={handleSearch}
                                disabled={loading}
                                style={{ height: 44 }}
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw size={16} className="spin" />
                                        {t('Searching...')}
                                    </>
                                ) : (
                                    <>
                                        <Search size={16} />
                                        {t('Search')}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Available Dates Quick Select */}
                        {availableDates.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <span className="text-sm text-muted">{t('Quick select')}: </span>
                                <div className="flex flex-wrap gap-2" style={{ marginTop: 4 }}>
                                    {availableDates.slice(0, 7).map(d => (
                                        <button
                                            key={d.date}
                                            className={`btn btn-sm ${searchDate === d.date ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSearchDate(d.date)}
                                        >
                                            {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            <span className="badge badge-neutral" style={{ marginLeft: 4 }}>
                                                {d.video_count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Message */}
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

                {/* Results Summary */}
                {results.length > 0 && (
                    <div className="card mb-6">
                        <div className="card-body flex items-center gap-6">
                            <div>
                                <div className="text-2xl font-bold">{totalVideos}</div>
                                <div className="text-sm text-muted">{t('Videos Found')}</div>
                            </div>
                            <div style={{ width: 1, height: 40, background: 'var(--border-color)' }} />
                            <div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
                                    {totalViolations}
                                </div>
                                <div className="text-sm text-muted">{t('Total Violations')}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results by Date */}
                {results.map(dateGroup => (
                    <div key={dateGroup.date} className="mb-6">
                        {/* Date Header */}
                        <div
                            onClick={() => toggleDate(dateGroup.date)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 20px',
                                background: 'var(--bg-secondary)',
                                borderRadius: expandedDates[dateGroup.date] ? '12px 12px 0 0' : 12,
                                cursor: 'pointer',
                                border: '1px solid var(--border-color)'
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <Calendar size={20} style={{ color: 'var(--accent-primary)' }} />
                                <h2 className="font-semibold" style={{ margin: 0 }}>
                                    {new Date(dateGroup.date).toLocaleDateString('en-IN', {
                                        weekday: 'long',
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="badge badge-neutral">
                                    {dateGroup.total_videos} {t('videos')}
                                </span>
                                <span className="badge badge-warning">
                                    {dateGroup.total_violations} {t('violations')}
                                </span>
                                {expandedDates[dateGroup.date] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>

                        {/* Shift Columns */}
                        {expandedDates[dateGroup.date] && (
                            <div style={{
                                display: 'flex',
                                gap: 16,
                                padding: 16,
                                background: 'var(--bg-primary)',
                                borderRadius: '0 0 12px 12px',
                                border: '1px solid var(--border-color)',
                                borderTop: 'none',
                                overflowX: 'auto'
                            }}>
                                {renderShiftColumn(
                                    t('Morning (6AM - 2PM)'),
                                    <Sun size={20} style={{ color: '#f59e0b' }} />,
                                    dateGroup.morning_videos,
                                    'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                                )}
                                {renderShiftColumn(
                                    t('Evening (2PM - 10PM)'),
                                    <Sunset size={20} style={{ color: '#f97316' }} />,
                                    dateGroup.evening_videos,
                                    'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'
                                )}
                                {renderShiftColumn(
                                    t('Night (10PM - 6AM)'),
                                    <Moon size={20} style={{ color: '#6366f1' }} />,
                                    dateGroup.night_videos,
                                    'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)'
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Empty State */}
                {!loading && results.length === 0 && searchDate && (
                    <div className="empty-state">
                        <FileVideo className="empty-state-icon" />
                        <h3 className="empty-state-title">{t('No Videos Found')}</h3>
                        <p className="empty-state-description">
                            {t('No analyzed videos found for the selected date and filters.')}
                        </p>
                    </div>
                )}

                {/* Initial State */}
                {!loading && results.length === 0 && !searchDate && (
                    <div className="empty-state">
                        <Search className="empty-state-icon" />
                        <h3 className="empty-state-title">{t('Search for Violations')}</h3>
                        <p className="empty-state-description">
                            {t('Select a date above to search for analyzed videos and their violations.')}
                        </p>
                    </div>
                )}
            </div>

            {/* Video Player Modal */}
            {videoPlayer && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.95)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 20
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: 1200,
                        marginBottom: 16
                    }}>
                        <h2 style={{ color: 'white', margin: 0 }}>
                            {t('Analyzed Video')}: {videoPlayer.original_filename}
                        </h2>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setVideoPlayer(null)}
                            style={{ color: 'white' }}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <video
                        src={videoPlayer.annotated_video_path}
                        controls
                        autoPlay
                        style={{
                            maxWidth: '100%',
                            maxHeight: 'calc(100vh - 120px)',
                            borderRadius: 8,
                            background: 'black'
                        }}
                    >
                        Your browser does not support video playback.
                    </video>

                    <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 16, textAlign: 'center' }}>
                        {t('RED boxes = Violations detected • GREEN boxes = Tracked persons')}
                    </p>
                </div>
            )}
        </>
    )
}

export default SearchViolations
