import { useState } from 'react'
import { Link, Route, Routes } from 'react-router'
import HomePage from './pages/home'
import ProfilePage from './pages/profile'
import RandomPage from './pages/random'
import StatsPage from './pages/stats'
import NewPage from './pages/new'
import NotesPage from './pages/notes'


const ROUTES = [
  { path: "/", element: <HomePage /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/random", element: <RandomPage /> },
  { path: "/home", element: <HomePage /> },
  { path: "/stats", element: <StatsPage /> },
  { path: "/new", element: <NewPage/> },
  { path: "/notes", element: <NotesPage /> }


]

export default function Layout() {


  return (
    <div className="min-h-screen flex flex-col">
      {/* Main */}
      <Routes>
        {ROUTES.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
      </Routes>
      {/* Footer */}
      <div className="p-5 h-32 bg-base-300 flex justify-around items-center">
        <Link to="/stats">
          <button className="btn btn-ghost">Stats</button>
        </Link>
        <Link to="/random">
          <button className="btn btn-ghost">Random</button>
        </Link>
        <Link to="/home">
          <button className="btn btn-ghost">Home</button>
        </Link>
        <Link to="/new">
          <button className="btn btn-ghost">New</button>
        </Link>
        <Link to="/notes">
          <button className="btn btn-ghost">Notes</button>
        </Link>
        <Link to="/profile">
          <button className="btn btn-ghost">Profile</button>
        </Link>

      </div>
    </div>
  )
}