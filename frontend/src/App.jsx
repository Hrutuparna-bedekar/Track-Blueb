import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Videos from './pages/Videos'
import Violations from './pages/Violations'
import Individuals from './pages/Individuals'
import VideoDetail from './pages/VideoDetail'
import Equipment from './pages/Equipment'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="videos" element={<Videos />} />
                    <Route path="videos/:videoId" element={<VideoDetail />} />
                    <Route path="violations" element={<Violations />} />
                    <Route path="equipment" element={<Equipment />} />
                    <Route path="individuals/:videoId" element={<Individuals />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
