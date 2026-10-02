import { NavLink, Route, Routes } from 'react-router'
import HomePage from './pages/home'
import ProfilePage from './pages/profile'
import RandomPage from './pages/random'
import StatsPage from './pages/stats'
import NewPage from './pages/new'
import NotesPage from './pages/notes'
import AboutPage from './pages/about'


const ROUTES = [
  { path: "/", element: <HomePage /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/random/*", element: <RandomPage /> },
  { path: "/home", element: <HomePage /> },
  { path: "/stats", element: <StatsPage /> },
  { path: "/new/*", element: <NewPage/> },
  { path: "/notes", element: <NotesPage /> },
  { path: "/about", element: <AboutPage /> }


]

const NAV_ITEMS = [
  { path: '/stats', label: 'Stats' },
  { path: '/random', label: 'Random' },
  { path: '/', label: 'Home', end: true },
  { path: '/new', label: 'New' },
  { path: '/notes', label: 'Notes' },
  { path: '/profile', label: 'Profile' },
]

export default function Layout() {


  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f9f5f1]">
      {/* Main */}
      <Routes>
        {ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
      </Routes>
      {/* Footer */}
      <nav className="site-footer" aria-label="Main navigation">
        <div className="nav-inner">
          {NAV_ITEMS.map(({ path, label, end }) => (
            <NavLink key={path} to={path} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-indicator" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}