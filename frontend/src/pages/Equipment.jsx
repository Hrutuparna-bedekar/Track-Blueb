import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    Shield,
    HardHat,
    Glasses,
    Footprints,
    RefreshCw,
    Filter,
    Image,
    X,
    CheckCircle
} from 'lucide-react'
import api from '../services/api'

function Equipment() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [equipment, setEquipment] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [equipmentTypes, setEquipmentTypes] = useState([])
    const [expandedImage, setExpandedImage] = useState(null)

    // Filters
    const [filters, setFilters] = useState({
        equipmentType: searchParams.get('equipment_type') || '',
        videoId: searchParams.get('video_id') || ''
    })

    const fetchEquipment = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                page,
                page_size: 20
            })
            if (filters.equipmentType) params.append('equipment_type', filters.equipmentType)
            if (filters.videoId) params.append('video_id', filters.videoId)

            const res = await api.get(`/api/equipment?${params}`)
            setEquipment(res.data.items)
            setTotal(res.data.total)
        } catch (err) {
            setError('Failed to load equipment')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchEquipmentTypes = async () => {
        try {
            const res = await api.get('/api/equipment/types')
            setEquipmentTypes(res.data || [])
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchEquipment()
        fetchEquipmentTypes()
    }, [page, filters])

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        setPage(1)

        const params = new URLSearchParams(searchParams)
        if (value) {
            params.set(key === 'equipmentType' ? 'equipment_type' : 'video_id', value)
        } else {
            params.delete(key === 'equipmentType' ? 'equipment_type' : 'video_id')
        }
        setSearchParams(params)
    }

    const resetFilters = () => {
        setFilters({ equipmentType: '', videoId: '' })
        setPage(1)
        setSearchParams({})
    }

    const getEquipmentIcon = (type) => {
        const typeLower = type.toLowerCase()
        if (typeLower.includes('helmet') || typeLower.includes('hard')) return <HardHat className="w-5 h-5" />
        if (typeLower.includes('glass') || typeLower.includes('goggle')) return <Glasses className="w-5 h-5" />
        if (typeLower.includes('shoe') || typeLower.includes('boot')) return <Footprints className="w-5 h-5" />
        return <Shield className="w-5 h-5" />
    }

    const getEquipmentColor = (type) => {
        const typeLower = type.toLowerCase()
        if (typeLower.includes('helmet')) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
        if (typeLower.includes('glass')) return 'bg-blue-100 text-blue-800 border-blue-300'
        if (typeLower.includes('mask')) return 'bg-purple-100 text-purple-800 border-purple-300'
        if (typeLower.includes('shoe') || typeLower.includes('boot')) return 'bg-green-100 text-green-800 border-green-300'
        if (typeLower.includes('vest')) return 'bg-orange-100 text-orange-800 border-orange-300'
        if (typeLower.includes('glove')) return 'bg-cyan-100 text-cyan-800 border-cyan-300'
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }

    const totalPages = Math.ceil(total / 20)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-green-500" />
                        Detected Equipment
                    </h1>
                    <p className="text-gray-500 mt-1">
                        PPE equipment detected in processed videos
                    </p>
                </div>
                <button
                    onClick={() => { fetchEquipment(); fetchEquipmentTypes(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {equipmentTypes.map((et) => (
                    <div
                        key={et.equipment_type}
                        className={`p-4 rounded-lg border-2 ${getEquipmentColor(et.equipment_type)} cursor-pointer hover:opacity-80`}
                        onClick={() => handleFilterChange('equipmentType', et.equipment_type)}
                    >
                        <div className="flex items-center gap-3">
                            {getEquipmentIcon(et.equipment_type)}
                            <div>
                                <div className="text-2xl font-bold">{et.count}</div>
                                <div className="text-sm capitalize">{et.equipment_type}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Filters:</span>
                    </div>

                    <select
                        value={filters.equipmentType}
                        onChange={(e) => handleFilterChange('equipmentType', e.target.value)}
                        className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Equipment Types</option>
                        {equipmentTypes.map((et) => (
                            <option key={et.equipment_type} value={et.equipment_type}>
                                {et.equipment_type} ({et.count})
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Video ID"
                        value={filters.videoId}
                        onChange={(e) => handleFilterChange('videoId', e.target.value)}
                        className="px-3 py-1.5 border rounded-lg text-sm w-24 focus:ring-2 focus:ring-blue-500"
                    />

                    {(filters.equipmentType || filters.videoId) && (
                        <button
                            onClick={resetFilters}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* Equipment Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-red-500">{error}</div>
            ) : equipment.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No equipment detected yet</p>
                    <p className="text-sm">Equipment will appear here after processing videos</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {equipment.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white rounded-lg border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Image */}
                                {item.image_path ? (
                                    <div
                                        className="relative h-40 bg-gray-100 cursor-pointer"
                                        onClick={() => setExpandedImage(item.image_path)}
                                    >
                                        <img
                                            src={item.image_path}
                                            alt={item.equipment_type}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.src = '/placeholder.png'
                                            }}
                                        />
                                        <div className="absolute top-2 right-2">
                                            <Image className="w-4 h-4 text-white drop-shadow" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-40 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center">
                                        <CheckCircle className="w-16 h-16 text-green-400" />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getEquipmentColor(item.equipment_type)}`}>
                                            {getEquipmentIcon(item.equipment_type)}
                                            <span className="ml-1 capitalize">{item.equipment_type}</span>
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Confidence:</span>
                                            <span className="font-medium">{(item.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Timestamp:</span>
                                            <span className="font-medium">{item.timestamp?.toFixed(1)}s</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Video:</span>
                                            <span className="font-medium">#{item.video_id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-6">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 border rounded-lg disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Image Modal */}
            {expandedImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
                    onClick={() => setExpandedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img
                            src={expandedImage}
                            alt="Equipment"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default Equipment
