import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Video,
    AlertTriangle,
    Users,
    Shield,
    Settings,
    HardHat
} from 'lucide-react'

function Layout() {
    const location = useLocation()

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/videos', label: 'Videos', icon: Video },
        { path: '/violations', label: 'Violations', icon: AlertTriangle },
    ]

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <Shield size={24} />
                        </div>
                        <div>
                            <div className="sidebar-logo-text">VioTrack</div>
                            <div className="sidebar-logo-subtitle">Admin Panel</div>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <div className="nav-section-title">Main</div>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-link ${isActive ? 'active' : ''}`
                                }
                            >
                                <item.icon className="nav-link-icon" size={20} />
                                {item.label}
                            </NavLink>
                        ))}
                    </div>

                    <div className="nav-section">
                        <div className="nav-section-title">System</div>
                        <NavLink to="/settings" className="nav-link">
                            <Settings className="nav-link-icon" size={20} />
                            Settings
                        </NavLink>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout
