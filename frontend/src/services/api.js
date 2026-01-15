import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
})

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats')
export const getRepeatOffenders = (minViolations = 2) =>
    api.get(`/dashboard/repeat-offenders?min_violations=${minViolations}`)
export const getQuickSummary = () => api.get('/dashboard/summary')

// Videos
export const uploadVideo = (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress?.(progress)
        },
    })
}

export const getVideos = (page = 1, pageSize = 10, status = null) => {
    let url = `/videos?page=${page}&page_size=${pageSize}`
    if (status) url += `&status=${status}`
    return api.get(url)
}

export const getVideo = (videoId) => api.get(`/videos/${videoId}`)
export const getVideoStatus = (videoId) => api.get(`/videos/${videoId}/status`)
export const deleteVideo = (videoId) => api.delete(`/videos/${videoId}`)

// Violations
export const getViolations = (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.pageSize) query.set('page_size', params.pageSize)
    if (params.videoId) query.set('video_id', params.videoId)
    if (params.individualId) query.set('individual_id', params.individualId)
    if (params.violationType) query.set('violation_type', params.violationType)
    if (params.reviewStatus) query.set('review_status', params.reviewStatus)
    if (params.minConfidence) query.set('min_confidence', params.minConfidence)

    return api.get(`/violations?${query.toString()}`)
}

export const getViolation = (violationId) => api.get(`/violations/${violationId}`)

export const reviewViolation = (violationId, isConfirmed, notes = null) =>
    api.post(`/violations/${violationId}/review`, { is_confirmed: isConfirmed, notes })

export const bulkReviewViolations = (violationIds, isConfirmed, notes = null) =>
    api.post('/violations/bulk-review', {
        violation_ids: violationIds,
        is_confirmed: isConfirmed,
        notes
    })

export const getViolationTypes = () => api.get('/violations/types/list')

// Individuals
export const getIndividuals = (videoId) => api.get(`/individuals/${videoId}`)
export const getIndividual = (videoId, trackId) => api.get(`/individuals/${videoId}/${trackId}`)
export const analyzeIndividual = (videoId, trackId) =>
    api.get(`/individuals/${videoId}/${trackId}/analysis`)

export default api
