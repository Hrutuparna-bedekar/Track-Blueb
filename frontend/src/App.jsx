import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Videos from './pages/Videos'
import Violations from './pages/Violations'
import Individuals from './pages/Individuals'
import VideoDetail from './pages/VideoDetail'
import Webcam from './pages/Webcam'

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Landing />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="videos" element={<Videos />} />
                        <Route path="videos/:videoId" element={<VideoDetail />} />
                        <Route path="violations" element={<Violations />} />
                        <Route path="webcam" element={<Webcam />} />
                        <Route path="individuals/:videoId" element={<Individuals />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    )
}

export default App
