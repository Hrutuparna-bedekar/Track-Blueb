import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
    Upload,
    Video,
    Play,
    Trash2,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    RefreshCw,
    FileVideo,
    X
} from 'lucide-react'
import { getVideos, uploadVideo, deleteVideo, getVideoStatus } from '../services/api'

function Videos() {
    const [videos, setVideos] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [dragging, setDragging] = useState(false)
    const [videoPlayer, setVideoPlayer] = useState(null) // Video to play in modal

    const fileInputRef = useRef(null)

    const fetchVideos = async () => {
        try {
            setLoading(true)
            const res = await getVideos(page, 10)
            setVideos(res.data.items)
            setTotal(res.data.total)
        } catch (err) {
            setError('Failed to load videos')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVideos()
    }, [page])

    // Poll for processing status
    useEffect(() => {
        const processingVideos = videos.filter(v => v.status === 'processing')
        if (processingVideos.length === 0) return

        const interval = setInterval(async () => {
            for (const video of processingVideos) {
                try {
                    const res = await getVideoStatus(video.id)
                    setVideos(prev => prev.map(v =>
                        v.id === video.id
                            ? { ...v, status: res.data.status, processing_progress: res.data.progress }
                            : v
                    ))

                    // Refresh all videos when one completes to get annotated path
                    if (res.data.status === 'completed') {
                        fetchVideos()
                    }
                } catch (err) {
                    console.error('Failed to fetch status', err)
                }
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [videos])

    const handleFileSelect = async (file) => {
        if (!file) return

        const allowedTypes = ['.mp4', '.avi', '.mov', '.mkv']
        const ext = '.' + file.name.split('.').pop().toLowerCase()
        if (!allowedTypes.includes(ext)) {
            setError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`)
            return
        }

        try {
            setUploading(true)
            setUploadProgress(0)
            setError(null)

            const res = await uploadVideo(file, (progress) => {
                setUploadProgress(progress)
            })

            setVideos(prev => [res.data, ...prev])
            setTotal(prev => prev + 1)
        } catch (err) {
            setError('Failed to upload video')
            console.error(err)
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        handleFileSelect(file)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setDragging(true)
    }

    const handleDragLeave = () => {
        setDragging(false)
    }

    const handleDelete = async (videoId) => {
        if (!confirm('Are you sure you want to delete this video?')) return

        try {
            await deleteVideo(videoId)
            setVideos(prev => prev.filter(v => v.id !== videoId))
            setTotal(prev => prev - 1)
        } catch (err) {
            setError('Failed to delete video')
            console.error(err)
        }
    }

    const formatFileSize = (bytes) => {
        if (!bytes) return '-'
        const mb = bytes / (1024 * 1024)
        return `${mb.toFixed(1)} MB`
    }

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

    return (
        <>
            <div className="page-header">
                <div className="page-header-content">
                    <div>
                        <h1 className="page-title">Videos</h1>
                        <p className="page-subtitle">Upload and manage video files for analysis</p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchVideos} disabled={loading}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="page-content">
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

                {/* Upload Area */}
                <div
                    className={`upload-area mb-8 ${dragging ? 'dragging' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp4,.avi,.mov,.mkv"
                        onChange={(e) => handleFileSelect(e.target.files[0])}
                        style={{ display: 'none' }}
                    />

                    {uploading ? (
                        <>
                            <div className="spinner mb-4" style={{ margin: '0 auto' }} />
                            <div className="upload-title">Uploading... {uploadProgress}%</div>
                            <div className="progress-bar mt-4" style={{ maxWidth: 300, margin: '0 auto' }}>
                                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </>
                    ) : (
                        <>
                            <Upload className="upload-icon" />
                            <div className="upload-title">Drop video file here or click to browse</div>
                            <div className="upload-subtitle">
                                Supports MP4, AVI, MOV, MKV (max 500MB)
                            </div>
                        </>
                    )}
                </div>

                {/* Videos Table */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Uploaded Videos</h3>
                        <span className="text-muted text-sm">{total} total</span>
                    </div>

                    {loading && videos.length === 0 ? (
                        <div className="card-body">
                            <div className="flex items-center justify-center gap-2 text-muted">
                                <div className="spinner" />
                                Loading videos...
                            </div>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="empty-state">
                            <FileVideo className="empty-state-icon" />
                            <h3 className="empty-state-title">No Videos Yet</h3>
                            <p className="empty-state-description">
                                Upload your first video to start detecting violations
                            </p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Video</th>
                                        <th>Size</th>
                                        <th>Duration</th>
                                        <th>Status</th>
                                        <th>Individuals</th>
                                        <th>Violations</th>
                                        <th>Uploaded</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {videos.map((video) => (
                                        <tr key={video.id}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <Video size={18} style={{ color: 'var(--accent-primary)' }} />
                                                    <span className="font-semibold">{video.original_filename}</span>
                                                </div>
                                            </td>
                                            <td>{formatFileSize(video.file_size)}</td>
                                            <td>{formatDuration(video.duration)}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(video.status)}
                                                    {video.status === 'processing' && (
                                                        <span className="text-sm text-muted">
                                                            {Math.round(video.processing_progress || 0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{video.total_individuals || 0}</td>
                                            <td>
                                                {video.total_violations > 0 ? (
                                                    <span className="badge badge-warning">
                                                        {video.total_violations}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">0</span>
                                                )}
                                            </td>
                                            <td className="text-muted text-sm">
                                                {new Date(video.uploaded_at).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <div className="flex gap-2 justify-end">
                                                    {/* Watch Analyzed Button */}
                                                    {video.annotated_video_path && video.status === 'completed' && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            title="Watch Analyzed Video"
                                                            onClick={() => setVideoPlayer(video)}
                                                        >
                                                            <Play size={14} />
                                                            Watch Analyzed
                                                        </button>
                                                    )}
                                                    <Link
                                                        to={`/videos/${video.id}`}
                                                        className="btn btn-ghost btn-icon"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} />
                                                    </Link>
                                                    <button
                                                        className="btn btn-ghost btn-icon"
                                                        title="Delete"
                                                        onClick={() => handleDelete(video.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {total > 10 && (
                        <div className="card-body flex items-center justify-between">
                            <span className="text-muted text-sm">
                                Page {page} of {Math.ceil(total / 10)}
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
                                    disabled={page >= Math.ceil(total / 10)}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
                            Analyzed Video: {videoPlayer.original_filename}
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
                        RED boxes = Violations detected by YOLO • GREEN boxes = Tracked persons by DeepSORT
                    </p>
                </div>
            )}
        </>
    )
}

export default Videos
