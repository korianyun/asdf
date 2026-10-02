import { useState } from 'react'
import { useNavigate } from 'react-router'
import { formatTime, readSession } from '../session'
import { CircularTimer } from './practice'

export default function HomePage() {
  const [session] = useState(readSession)
  const navigate = useNavigate()
  const hasSession = session && session.topic

  return (
    <main className="practice-page home-page">
      <header className="home-intro">
        <span className="eyebrow">VOICE UP / HOME</span>
        <h1>Welcome back.</h1>
        <p>{hasSession ? 'Your last practice is right where you left it.' : 'Your next thought deserves to be heard.'}</p>
      </header>
      {hasSession ? (
        <section className="home-session" aria-label="Last practice session">
          <div className="home-session-copy">
            <span className="eyebrow">LAST SESSION</span>
            <h2>{session.topic}</h2>
            <p>{session.difficulty} practice <span aria-hidden="true">·</span> {formatTime(session.durationSeconds)} total</p>
            <small>{session.status === 'complete' ? 'Your next round is ready.' : `${formatTime(session.remainingSeconds)} left to finish.`}</small>
          </div>
          <CircularTimer session={session} actionLabel={session.status === 'complete' ? 'Practice again' : 'Resume'} onAction={() => navigate('/new/resume')} />
        </section>
      ) : <button className="primary-button" onClick={() => navigate('/new/setup')}>Start a practice session <span>→</span></button>}
    </main>
  )
}