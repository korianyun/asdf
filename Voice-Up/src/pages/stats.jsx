import { useState } from 'react'
import { formatTime, readNotes, readPracticeHistory, readSession, readTopicCategories, saveTopicCategory } from '../session'
import { getTopicCategory, TOPIC_CATEGORIES } from '../topicCategory'

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getPracticeRecords() {
  const history = readPracticeHistory()
  const latest = readSession()
  if (!latest || latest.status === 'setup') return history
  if (
    latest.status === 'ready'
    && !latest.accumulatedElapsedSeconds
    && !history.some((record) => record.id === latest.id)
  ) return history

  const id = latest.id || `legacy-${latest.startedAt || latest.topic}`
  const elapsedSeconds = latest.status === 'complete'
    ? latest.durationSeconds
    : latest.status === 'running'
      ? Math.max(0, (latest.accumulatedElapsedSeconds || 0) + (latest.remainingAtStart || latest.durationSeconds) - latest.remainingSeconds)
      : latest.accumulatedElapsedSeconds || 0
  const fallback = {
    id,
    topic: latest.topic,
    category: latest.category,
    difficulty: latest.difficulty,
    startedAt: latest.startedAt || (latest.endsAt ? latest.endsAt - latest.durationSeconds * 1000 : Date.now()),
    durationSeconds: latest.durationSeconds,
    elapsedSeconds,
    status: latest.status === 'complete' ? 'completed' : latest.status === 'running' ? 'in-progress' : 'left',
    score: latest.evaluation?.score ?? null,
    onTopicPercent: latest.evaluation?.onTopicPercent ?? null,
    eyeContactPercent: latest.eyeContactPercent ?? null,
    wordCount: latest.evaluation?.wordCount ?? 0,
  }

  const existingIndex = history.findIndex((record) => record.id === id)
  if (existingIndex === -1) return [...history, fallback]
  return history.map((record, index) => index === existingIndex ? { ...record, ...fallback } : record)
}

function getLastSevenDays(records) {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index))
    const key = dateKey(date)
    const dayRecords = records.filter((record) => record.startedAt && dateKey(new Date(record.startedAt)) === key)
    return {
      key,
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      sessions: dayRecords.length,
      minutes: Math.round(dayRecords.reduce((total, record) => total + (record.elapsedSeconds || 0), 0) / 60),
    }
  })
}

function DailyChart({ title, description, data, valueKey, unit, maxValue }) {
  const width = 420
  const chartHeight = 150
  const chartTop = 10
  const chartBottom = chartTop + chartHeight
  const slotWidth = width / data.length
  const safeMax = Math.max(maxValue, 1)
  const points = data.map((day, index) => {
    const x = slotWidth * index + slotWidth / 2
    const y = chartBottom - (day[valueKey] / safeMax) * chartHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <figure className="stats-chart">
      <figcaption>
        <strong>{title}</strong>
        <span>{description}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${chartBottom + 30}`} role="img" aria-label={`${title}, last seven days`}>
        <line x1="0" y1={chartBottom} x2={width} y2={chartBottom} className="chart-axis" />
        {data.map((day, index) => {
          const x = slotWidth * index + slotWidth / 2
          const value = day[valueKey]
          const y = chartBottom - (value / safeMax) * chartHeight
          return (
            <g key={day.key}>
              <line x1={x} y1={chartTop} x2={x} y2={chartBottom} className="chart-gridline" />
              <circle cx={x} cy={y} r="5" className="chart-point" />
              <text x={x} y={chartBottom + 20} textAnchor="middle" className="chart-label">{day.label}</text>
              <text x={x} y={Math.max(y - 10, 9)} textAnchor="middle" className="chart-value">{value}{unit}</text>
            </g>
          )
        })}
        <polyline points={points} className="chart-line" />
      </svg>
    </figure>
  )
}

function calculateStreak(records) {
  const activeDays = new Set(records.filter((record) => record.startedAt).map((record) => dateKey(new Date(record.startedAt))))
  const today = new Date()
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!activeDays.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (activeDays.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function StatsPage() {
  const [records, setRecords] = useState(getPracticeRecords)
  const [categoryMessage, setCategoryMessage] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const topicCategories = readTopicCategories()
  const notes = readNotes()
  const days = getLastSevenDays(records)
  const completed = records.filter((record) => record.status === 'completed')
  const left = records.filter((record) => record.status === 'left')
  const inProgress = records.filter((record) => record.status === 'in-progress')
  const attempts = completed.length + left.length + inProgress.length
  const completionPercent = attempts ? Math.round((completed.length / attempts) * 100) : 0
  const totalTime = records.reduce((total, record) => total + (Number(record.elapsedSeconds) || 0), 0)
  const scored = completed.filter((record) => Number.isFinite(record.score))
  const averageScore = scored.length
    ? Math.round(scored.reduce((total, record) => total + record.score, 0) / scored.length)
    : null
  const categoryStats = new Map()
  records.forEach((record) => {
    if (!record.topic) return
    const category = getTopicCategory(record.topic, topicCategories, record.category)
    const current = categoryStats.get(category) || { count: 0, scoreTotal: 0, scoreCount: 0 }
    current.count += 1
    if (Number.isFinite(record.score)) {
      current.scoreTotal += record.score
      current.scoreCount += 1
    }
    categoryStats.set(category, current)
  })
  const mostPracticedCategories = [...categoryStats.entries()].sort((a, b) => b[1].count - a[1].count)
  const topicsToWorkOn = [...categoryStats.entries()]
    .filter(([, stats]) => stats.scoreCount)
    .sort((a, b) => a[1].scoreTotal / a[1].scoreCount - b[1].scoreTotal / b[1].scoreCount)
    .slice(0, 3)
  const latest = [...records].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0]
  const sessionsPerDayMax = Math.max(...days.map((day) => day.sessions), 1)
  const minutesPerDayMax = Math.max(...days.map((day) => day.minutes), 1)
  const topicRows = [...records]
    .filter((record) => record.topic)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
    .reduce((rows, record) => {
      const key = record.topic.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
      const existing = rows.find((row) => row.key === key)
      if (existing) existing.count += 1
      else rows.push({
        key,
        topic: record.topic,
        count: 1,
        category: getTopicCategory(record.topic, topicCategories, record.category),
      })
      return rows
    }, [])

  function updateTopicCategory(topic, category) {
    try {
      saveTopicCategory(topic, category)
      setRecords(getPracticeRecords())
      setCategoryError('')
      setCategoryMessage(`Updated the category for “${topic}”.`)
    } catch (error) {
      setCategoryMessage('')
      setCategoryError(`Category could not be saved: ${error.message}`)
    }
  }

  return (
    <main className="practice-page dashboard-page stats-page">
      <header className="dashboard-heading">
        <span className="eyebrow">VOICE UP / STATS</span>
        <h1>Your practice, at a glance.</h1>
        <p>Your speaking practice over time.</p>
      </header>

      <section className="stats-summary" aria-label="Practice summary">
        <article className="stats-summary-card">
          <span>TIME PRACTICED</span>
          <strong>{formatTime(totalTime)}</strong>
        </article>
        <article className="stats-summary-card">
          <span>SESSIONS COMPLETED</span>
          <strong>{completed.length}</strong>
        </article>
        <article className="stats-summary-card">
          <span>PRACTICE STREAK</span>
          <strong>{calculateStreak(records)} <small>days</small></strong>
        </article>
        <article className="stats-summary-card">
          <span>AVERAGE PRACTICE SCORE</span>
          <strong>{averageScore === null ? '—' : `${averageScore}%`}</strong>
        </article>
      </section>

      <section className="stats-charts" aria-label="Weekly practice charts">
        <DailyChart
          title="Days logged"
          description="Practice sessions started each day"
          data={days}
          valueKey="sessions"
          unit=""
          maxValue={sessionsPerDayMax}
        />
        <DailyChart
          title="Practice time"
          description="Minutes spent practicing each day"
          data={days}
          valueKey="minutes"
          unit="m"
          maxValue={minutesPerDayMax}
        />
      </section>

      <section className="stats-details" aria-label="Practice details">
        <article className="stats-detail-card stats-completion">
          <div>
            <span className="eyebrow">SESSIONS COMPLETED AND LEFT</span>
            <h2>{completionPercent}% completed</h2>
            <p>{completed.length} completed · {left.length} left · {inProgress.length} in progress</p>
          </div>
          <div
            className="stats-donut"
            role="img"
            aria-label={`${completionPercent}% completed; ${completed.length} completed, ${left.length} left, ${inProgress.length} in progress`}
            style={{ '--completed-share': `${completionPercent}%` }}
          >
            <span>{completionPercent}%</span>
          </div>
        </article>

        <article className="stats-detail-card">
          <span className="eyebrow">MOST-PRACTICED CATEGORIES</span>
          {mostPracticedCategories.length ? (
            <ol className="stats-topic-list">
              {mostPracticedCategories.slice(0, 5).map(([category, stats]) => <li key={category}><span>{category}</span><strong>{stats.count} {stats.count === 1 ? 'session' : 'sessions'}</strong></li>)}
            </ol>
          ) : <p className="stats-empty">Practice topics to see which categories you explore most.</p>}
        </article>

        <article className="stats-detail-card">
          <span className="eyebrow">TOPICS TO WORK ON</span>
          {topicsToWorkOn.length ? (
            <ol className="stats-topic-list">
              {topicsToWorkOn.map(([category, stats]) => (
                <li key={category}><span>{category}</span><strong>{Math.round(stats.scoreTotal / stats.scoreCount)}%</strong></li>
              ))}
            </ol>
          ) : <p className="stats-empty">Complete scored sessions to get topic suggestions.</p>}
        </article>
      </section>

      <section className="stats-category-editor" aria-labelledby="category-editor-title">
        <div className="stats-category-editor-heading">
          <div>
            <span className="eyebrow">YOUR TOPICS</span>
            <h2 id="category-editor-title">Adjust a category</h2>
          </div>
          <p>Changes apply to every practice session with the same topic and future sessions.</p>
        </div>
        {topicRows.length ? (
          <ul className="stats-category-list">
            {topicRows.map((row, index) => (
              <li key={row.key}>
                <div className="stats-category-topic">
                  <strong>{row.topic}</strong>
                  <span>{row.count} {row.count === 1 ? 'session' : 'sessions'}</span>
                </div>
                <label className="stats-category-select" htmlFor={`topic-category-${index}`}>
                  <span>Category</span>
                  <select
                    id={`topic-category-${index}`}
                    value={row.category}
                    onChange={(event) => updateTopicCategory(row.topic, event.target.value)}
                  >
                    {TOPIC_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="stats-empty">Your practiced topics will appear here so you can adjust their categories.</p>}
        {categoryError && <p className="stats-category-feedback stats-category-error" role="alert">{categoryError}</p>}
        {categoryMessage && <p className="stats-category-feedback" role="status">{categoryMessage}</p>}
      </section>

      <div className="stats-footnote">
        <span className="eyebrow">LATEST SESSION</span>
        <p>{latest ? `${latest.topic} · ${latest.status === 'completed' ? 'Completed' : latest.status === 'left' ? 'Left early' : 'In progress'}` : 'Start a practice session to begin your stats.'}</p>
        <span className="stats-notes-count">{notes.length} saved notes</span>
      </div>
    </main>
  )
}
