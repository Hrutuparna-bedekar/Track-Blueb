import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Sun, Moon, ArrowRight } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

function Layout() {
    const { theme, toggleTheme } = useTheme()
    const location = useLocation()
    const isLandingPage = location.pathname === '/'

    const navItems = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/videos', label: 'Videos' },
        { path: '/webcam', label: 'Webcam' },
        { path: '/violations', label: 'Violations' },
    ]

    return (
        <div className="app-container">
            {/* Floating Navbar */}
            <nav className="navbar">
                <NavLink to="/" className="navbar-brand">
                    <span className="navbar-brand-text">VioTrack</span>
                </NavLink>

                <div className="navbar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `nav-link ${isActive ? 'active' : ''}`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </div>

                <div className="navbar-actions">
                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    {isLandingPage && (
                        <NavLink to="/dashboard" className="btn btn-primary btn-sm">
                            Get Started <ArrowRight size={14} />
                        </NavLink>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
