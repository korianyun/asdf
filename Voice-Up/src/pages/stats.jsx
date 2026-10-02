import { formatTime, readNotes, readSession } from '../session'

export default function StatsPage() {
    const session = readSession()
    const notes = readNotes()
    const elapsed = session ? Math.max(0, session.durationSeconds - session.remainingSeconds) : 0
    const progress = session?.durationSeconds ? Math.round((elapsed / session.durationSeconds) * 100) : 0

    return (
        <main className="practice-page dashboard-page stats-page">
            <header className="dashboard-heading">
                <span className="eyebrow">VOICE UP / STATS</span>
                <h1>Your practice, at a glance.</h1>
                <p>A quiet record of the work you have put in.</p>
            </header>
            <section className="stats-overview" aria-label="Latest session">
                <div className="stats-focus">
                    <span className="eyebrow">LATEST SESSION</span>
                    <h2>{session?.topic || 'Your first session is waiting.'}</h2>
                    <p>{session ? `${session.difficulty} practice · ${session.status === 'complete' ? 'Completed' : 'In progress'}` : 'No practice session recorded yet.'}</p>
                    <div className="progress-track" role="progressbar" aria-label="Latest session progress" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
                    <small>{progress}% of the session elapsed</small>
                </div>
                <div className="stats-metrics">
                    <div className="stat-metric"><span>TIME SPOKEN</span><strong>{formatTime(elapsed)}</strong></div>
                    <div className="stat-metric"><span>SESSION LENGTH</span><strong>{session ? formatTime(session.durationSeconds) : '--:--'}</strong></div>
                    <div className="stat-metric"><span>SAVED NOTES</span><strong>{String(notes.length).padStart(2, '0')}</strong></div>
                </div>
            </section>
            <div className="stats-footnote"><span className="eyebrow">KEEP GOING</span><p>Your next session adds another small step to the story.</p></div>
        </main>
    )
}