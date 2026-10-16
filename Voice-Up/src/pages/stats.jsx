import { useState } from 'react'
import { formatTime, readNotes, readPracticeHistory, readSession, readTopicCategories, saveTopicCategory, summarizeSpeechPatterns } from '../session'
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
  const speechPatterns = summarizeSpeechPatterns(latest.transcript || '')
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
    wordCount: latest.evaluation?.wordCount ?? speechPatterns.wordCount,
    fillerWordCount: latest.evaluation?.fillerWordCount ?? speechPatterns.fillerWordCount,
    repeatedWordCount: latest.evaluation?.repeatedWordCount ?? speechPatterns.repeatedWordCount,
  }

  const existingIndex = history.findIndex((record) => record.id === id)
  if (existingIndex === -1) return [...history, fallback]
  return history.map((record, index) => index === existingIndex ? { ...record, ...fallback } : record)
}

function average(records, getValue) {
  const values = records.map(getValue).filter(Number.isFinite)
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
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

function getWeekTotals(records, offsetDays = 0) {
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1 - offsetDays)
  const start = new Date(end)
  start.setDate(start.getDate() - 7)
  const weekRecords = records.filter((record) => {
    if (!record.startedAt) return false
    const date = new Date(record.startedAt)
    return date >= start && date < end
  })
  return {
    sessions: weekRecords.length,
    minutes: Math.round(weekRecords.reduce((total, record) => total + (Number(record.elapsedSeconds) || 0), 0) / 60),
  }
}

function describeChange(current, previous, unit) {
  const formatAmount = (value) => {
    if (unit === 'session') return `${value} ${value === 1 ? 'session' : 'sessions'}`
    return `${value} ${value === 1 ? 'minute' : 'minutes'}`
  }
  const currentLabel = formatAmount(current)
  if (previous === 0) return current ? `${currentLabel} in the last 7 days; none in the 7 days before.` : 'No practice in the last 14 days.'
  const change = current - previous
  if (change === 0) return `${currentLabel} in the last 7 days, the same as the 7 days before.`
  const changeLabel = formatAmount(Math.abs(change))
  return `${currentLabel} in the last 7 days, ${changeLabel} ${change > 0 ? 'more' : 'fewer'} than in the 7 days before.`
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

function ScoreTrendChart({ records }) {
  const recent = records.slice(-8)
  if (!recent.length) {
    return (
      <figure className="stats-chart stats-score-chart">
        <figcaption>
          <strong>Score, session by session</strong>
          <span>Complete scored sessions to see your own trend here.</span>
        </figcaption>
        <p className="stats-empty">Your score history will appear after a completed session.</p>
      </figure>
    )
  }

  const width = 420
  const chartTop = 18
  const chartHeight = 130
  const chartBottom = chartTop + chartHeight
  const slotWidth = width / recent.length
  const points = recent.map((record, index) => {
    const x = slotWidth * index + slotWidth / 2
    const y = chartBottom - ((record.score / 100) * chartHeight)
    return `${x},${y}`
  }).join(' ')

  return (
    <figure className="stats-chart stats-score-chart">
      <figcaption>
        <strong>Your last {recent.length} session scores</strong>
        <span>Each point is one of your completed practice scores.</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${chartBottom + 34}`} role="img" aria-label={`Scores for your last ${recent.length} completed sessions`}>
        {[0, 50, 100].map((value) => {
          const y = chartBottom - ((value / 100) * chartHeight)
          return (
            <g key={value}>
              <line x1="0" y1={y} x2={width} y2={y} className="chart-axis" />
              <text x="2" y={y - 4} className="chart-label">{value}</text>
            </g>
          )
        })}
        {recent.length > 1 && <polyline points={points} className="chart-line" />}
        {recent.map((record, index) => {
          const x = slotWidth * index + slotWidth / 2
          const y = chartBottom - ((record.score / 100) * chartHeight)
          const label = record.topic || 'Practice'
          const date = record.startedAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(record.startedAt)) : `Session ${index + 1}`
          return (
            <g key={record.id || `${record.startedAt}-${index}`}>
              <circle cx={x} cy={y} r="5" className="chart-point" />
              <text x={x} y={y - 10} textAnchor="middle" className="chart-value">{record.score}</text>
              <text x={x} y={chartBottom + 18} textAnchor="middle" className="chart-label">{date}</text>
              <title>{`${label}: ${record.score}%`}</title>
            </g>
          )
        })}
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
  const speechPatterns = completed
    .filter((record) => record.wordCount > 0 && record.elapsedSeconds > 0
      && Number.isFinite(record.fillerWordCount) && Number.isFinite(record.repeatedWordCount))
    .map((record) => ({
      ...record,
      fillersPerMinute: record.fillerWordCount / (record.elapsedSeconds / 60),
      repeatedWordPercent: (record.repeatedWordCount / record.wordCount) * 100,
      wordsPerMinute: record.wordCount / (record.elapsedSeconds / 60),
    }))
  const totalSpeechSeconds = speechPatterns.reduce((total, record) => total + record.elapsedSeconds, 0)
  const totalSpeechWords = speechPatterns.reduce((total, record) => total + record.wordCount, 0)
  const averageFillersPerMinute = totalSpeechSeconds
    ? speechPatterns.reduce((total, record) => total + record.fillerWordCount, 0) / (totalSpeechSeconds / 60)
    : null
  const averageRepeatedWordPercent = totalSpeechWords
    ? speechPatterns.reduce((total, record) => total + record.repeatedWordCount, 0) / totalSpeechWords * 100
    : null
  const averageWordsPerMinute = totalSpeechSeconds
    ? totalSpeechWords / (totalSpeechSeconds / 60)
    : null
  const onTopicRecords = completed.filter((record) => Number.isFinite(record.onTopicPercent))
  const eyeContactRecords = completed.filter((record) => Number.isFinite(record.eyeContactPercent))
  const averageOnTopic = average(onTopicRecords, (record) => record.onTopicPercent)
  const averageEyeContact = average(eyeContactRecords, (record) => record.eyeContactPercent)
  const getTrend = (sourceRecords, getValue, metric, unit, lowerIsBetter = false, threshold = 1) => {
    const ordered = [...sourceRecords]
      .filter((record) => Number.isFinite(getValue(record)))
      .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
    if (ordered.length < 4) return null
    const midpoint = Math.floor(ordered.length / 2)
    const earlier = average(ordered.slice(0, midpoint), getValue)
    const recent = average(ordered.slice(midpoint), getValue)
    if (earlier === null || recent === null) return null
    const change = recent - earlier
    if (Math.abs(change) < threshold) return null
    const improved = lowerIsBetter ? change < 0 : change > 0
    return {
      metric,
      unit,
      improved,
      change: Math.abs(change),
      earlierCount: midpoint,
      recentCount: ordered.length - midpoint,
      text: `${metric} ${improved ? 'improved' : 'dipped'} by ${Math.abs(change).toFixed(unit === '%' ? 0 : 1)}${unit} across your last ${ordered.length} comparable sessions.`,
    }
  }
  const trends = [
    getTrend(completed, (record) => record.score, 'Your session score', ' points', false, 3),
    getTrend(onTopicRecords, (record) => record.onTopicPercent, 'Your on-topic estimate', '%', false, 5),
    getTrend(eyeContactRecords, (record) => record.eyeContactPercent, 'Camera eye contact', '%', false, 5),
    getTrend(speechPatterns, (record) => record.fillersPerMinute, 'Captured filler words per practice minute', ' per min', true, 0.5),
    getTrend(speechPatterns, (record) => record.repeatedWordPercent, 'Immediate word repeats', '%', true, 1),
  ].filter(Boolean)
  const positiveTrends = trends.filter((trend) => trend.improved)
  const focusTrends = trends.filter((trend) => !trend.improved)
  const left = records.filter((record) => record.status === 'left')
  const inProgress = records.filter((record) => record.status === 'in-progress')
  const attempts = completed.length + left.length + inProgress.length
  const completionPercent = attempts ? Math.round((completed.length / attempts) * 100) : null
  const totalTime = records.reduce((total, record) => total + (Number(record.elapsedSeconds) || 0), 0)
  const week = getWeekTotals(records)
  const previousWeek = getWeekTotals(records, 7)
  const averageSessionMinutes = completed.length
    ? completed.reduce((total, record) => total + (Number(record.elapsedSeconds) || 0), 0) / completed.length / 60
    : null
  const scored = completed.filter((record) => Number.isFinite(record.score))
  const averageScore = scored.length
    ? Math.round(scored.reduce((total, record) => total + record.score, 0) / scored.length)
    : null
  const categoryStats = new Map()
  completed.forEach((record) => {
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
  const categoryPerformance = [...categoryStats.entries()]
    .filter(([, stats]) => stats.scoreCount >= 2)
    .map(([category, stats]) => ({ category, count: stats.scoreCount, average: stats.scoreTotal / stats.scoreCount }))
    .sort((a, b) => b.average - a.average)
  const highestScoringCategory = categoryPerformance[0] || null
  const categoryToRevisit = categoryPerformance.length > 1 ? categoryPerformance[categoryPerformance.length - 1] : null
  const displayedCategoryPerformance = categoryPerformance.slice(0, 2)
  if (categoryToRevisit && !displayedCategoryPerformance.some(({ category }) => category === categoryToRevisit.category)) {
    displayedCategoryPerformance.push(categoryToRevisit)
  }
  const scoreTrend = getTrend(completed, (record) => record.score, 'Your session score', ' points', false, 3)
  const personalStrengths = [
    ...positiveTrends.map((trend) => trend.text),
    highestScoringCategory && `${highestScoringCategory.category} is your highest-scoring area so far: ${Math.round(highestScoringCategory.average)}% across ${highestScoringCategory.count} scored sessions.`,
  ].filter(Boolean)
  const personalFocus = [
    ...focusTrends.map((trend) => trend.text),
    categoryToRevisit && `${categoryToRevisit.category} has your lowest category average so far (${Math.round(categoryToRevisit.average)}% across ${categoryToRevisit.count} scored sessions).`,
  ].filter(Boolean)
  const recentSessions = [...records]
    .filter((record) => record.startedAt)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
    .slice(0, 6)
  const latest = [...records].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0]
  const sessionsPerDayMax = Math.max(...days.map((day) => day.sessions), 1)
  const minutesPerDayMax = Math.max(...days.map((day) => day.minutes), 1)
  const busiestDay = [...days].sort((a, b) => b.sessions - a.sessions)[0]
  const longestPracticeDay = [...days].sort((a, b) => b.minutes - a.minutes)[0]
  const completionInsight = attempts
    ? `${completed.length} of ${attempts} sessions finished${left.length ? `; ${left.length} left early` : ''}.`
    : 'Your first session will give you a completion baseline.'
  const scoreInsight = scoreTrend?.text
    || (averageScore === null ? 'Complete a scored session to start a score history.' : `${scored.length} completed ${scored.length === 1 ? 'session' : 'sessions'} scored; keep practicing to reveal a trend.`)
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
        <p>Your recent sessions, your speaking habits, and what’s changing over time.</p>
      </header>

      <section className="stats-summary" aria-label="Practice summary">
        <article className="stats-summary-card">
          <span>TOTAL TIME PRACTICED</span>
          <strong>{formatTime(totalTime)}</strong>
          <small>{averageSessionMinutes === null ? 'Your first completed session sets your average.' : `${averageSessionMinutes.toFixed(1)} min per completed session on average.`}</small>
        </article>
        <article className="stats-summary-card">
          <span>SESSIONS COMPLETED</span>
          <strong>{completed.length}</strong>
          <small>{completionInsight}</small>
        </article>
        <article className="stats-summary-card">
          <span>CURRENT STREAK</span>
          <strong>{calculateStreak(records)} <small>days</small></strong>
          <small>{week.sessions ? `${week.sessions} sessions in the last 7 days.` : 'A new practice day starts your streak.'}</small>
        </article>
        <article className="stats-summary-card">
          <span>YOUR AVERAGE SCORE</span>
          <strong>{averageScore === null ? '—' : `${averageScore}%`}</strong>
          <small>{scoreInsight}</small>
        </article>
      </section>

      <section className="stats-speaking-patterns" aria-labelledby="speaking-patterns-title">
        <div className="stats-speaking-heading">
          <span className="eyebrow">SPEAKING HABITS</span>
          <h2 id="speaking-patterns-title">Patterns in your sessions</h2>
          <p>Counts come from completed sessions with captured speech; camera measures are shown only when available.</p>
        </div>
        <div className="stats-pattern-metrics">
          <article className="stats-pattern-metric">
            <span>FILLER WORDS / PRACTICE MINUTE</span>
            <strong>{averageFillersPerMinute === null ? '—' : averageFillersPerMinute.toFixed(1)} <small>/ min</small></strong>
            <p>{speechPatterns.length ? `Across ${speechPatterns.length} sessions · “um”, “uh” and similar` : 'Needs a completed session with captured speech'}</p>
          </article>
          <article className="stats-pattern-metric">
            <span>IMMEDIATE REPEATS</span>
            <strong>{averageRepeatedWordPercent === null ? '—' : `${averageRepeatedWordPercent.toFixed(1)}%`}</strong>
            <p>{speechPatterns.length ? `Of ${totalSpeechWords} captured words` : 'Words repeated right after themselves'}</p>
          </article>
          <article className="stats-pattern-metric">
            <span>WORDS PER PRACTICE MINUTE</span>
            <strong>{averageWordsPerMinute === null ? '—' : Math.round(averageWordsPerMinute)} <small>/ min</small></strong>
            <p>Transcript words divided by practice time; not speaking-only time</p>
          </article>
          <article className="stats-pattern-metric">
            <span>ON-TOPIC ESTIMATE</span>
            <strong>{averageOnTopic === null ? '—' : `${Math.round(averageOnTopic)}%`}</strong>
            <p>{onTopicRecords.length ? `Keyword estimate across ${onTopicRecords.length} sessions` : 'Not available without a captured transcript'}</p>
          </article>
          <article className="stats-pattern-metric">
            <span>CAMERA EYE CONTACT</span>
            <strong>{averageEyeContact === null ? '—' : `${Math.round(averageEyeContact)}%`}</strong>
            <p>{eyeContactRecords.length ? `Estimated from camera samples in ${eyeContactRecords.length} sessions` : 'Only available when camera gaze samples are captured'}</p>
          </article>
        </div>
        <div className="stats-personal-observations">
          <article>
            <span className="eyebrow">MOVING UP</span>
            {personalStrengths.length ? <ul>{personalStrengths.slice(0, 3).map((insight) => <li key={insight}>{insight}</li>)}</ul> : <p>There isn’t enough repeated data to call a personal strength yet. Trends appear after four comparable sessions.</p>}
          </article>
          <article>
            <span className="eyebrow">WORTH ANOTHER LOOK</span>
            {personalFocus.length ? <ul>{personalFocus.slice(0, 3).map((insight) => <li key={insight}>{insight}</li>)}</ul> : <p>No measure is moving clearly downward. Continue with a few more sessions to build a useful comparison.</p>}
          </article>
        </div>
        <p className="stats-pattern-note">Word counts and filler estimates rely on browser speech recognition, which can miss or mishear words. They are rough practice signals, not a stutter or fluency assessment.</p>
      </section>

      <section className="stats-score-trend" aria-label="Score trend">
        <ScoreTrendChart records={scored.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))} />
      </section>

      <section className="stats-charts" aria-label="Weekly practice charts">
        <DailyChart
          title="Your practice rhythm"
          description={busiestDay?.sessions
            ? `${describeChange(week.sessions, previousWeek.sessions, 'session')} Busiest day: ${busiestDay.label} (${busiestDay.sessions}).`
            : 'No sessions in the last 7 days. Start when you’re ready.'}
          data={days}
          valueKey="sessions"
          unit=""
          maxValue={sessionsPerDayMax}
        />
        <DailyChart
          title="Time you made for practice"
          description={longestPracticeDay?.minutes
            ? `${describeChange(week.minutes, previousWeek.minutes, 'minute')} Most time: ${longestPracticeDay.label} (${longestPracticeDay.minutes} min).`
            : 'Your practice time will show here after your next session.'}
          data={days}
          valueKey="minutes"
          unit="m"
          maxValue={minutesPerDayMax}
        />
      </section>

      <section className="stats-session-history" aria-labelledby="session-history-title">
        <div className="stats-section-heading">
          <span className="eyebrow">YOUR RECENT RUNS</span>
          <h2 id="session-history-title">Session by session</h2>
        </div>
        {recentSessions.length ? (
          <ol className="stats-session-list">
            {recentSessions.map((record) => (
              <li key={record.id || `${record.startedAt}-${record.topic}`}>
                <div className="stats-session-main">
                  <strong>{record.topic || 'Untitled session'}</strong>
                  <span>{record.startedAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(record.startedAt)) : ''} · {record.difficulty || 'Practice'} · {record.status === 'completed' ? 'Completed' : record.status === 'left' ? 'Left early' : 'In progress'}</span>
                </div>
                <div className="stats-session-measures">
                  {Number.isFinite(record.score) && <span><strong>{record.score}%</strong> score</span>}
                  {Number.isFinite(record.onTopicPercent) && <span>{record.onTopicPercent}% on-topic estimate</span>}
                  {Number.isFinite(record.eyeContactPercent) && <span>{record.eyeContactPercent}% camera estimate</span>}
                  {Number.isFinite(record.wordCount) && record.wordCount > 0 && <span>{record.wordCount} words</span>}
                  {Number.isFinite(record.elapsedSeconds) && <span>{formatTime(record.elapsedSeconds)}</span>}
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="stats-empty">Your completed and in-progress sessions will appear here.</p>}
      </section>

      <section className="stats-details" aria-label="Practice details">
        <article className="stats-detail-card stats-completion">
          <div>
            <span className="eyebrow">SESSIONS COMPLETED AND LEFT</span>
            <h2>{attempts ? `${completionPercent}% completed` : 'No sessions yet'}</h2>
            <p>{completed.length} completed · {left.length} left · {inProgress.length} in progress</p>
          </div>
          <div
            className="stats-donut"
            role="img"
            aria-label={attempts ? `${completionPercent}% completed; ${completed.length} completed, ${left.length} left, ${inProgress.length} in progress` : 'No sessions yet'}
            style={{ '--completed-share': `${completionPercent || 0}%` }}
          >
            <span>{attempts ? `${completionPercent}%` : '—'}</span>
          </div>
        </article>

        <article className="stats-detail-card">
          <span className="eyebrow">AREAS YOU RETURN TO</span>
          {mostPracticedCategories.length ? (
            <ol className="stats-topic-list">
              {mostPracticedCategories.slice(0, 5).map(([category, stats]) => <li key={category}><span>{category}</span><strong>{stats.count} {stats.count === 1 ? 'session' : 'sessions'}{stats.scoreCount ? ` · ${Math.round(stats.scoreTotal / stats.scoreCount)}% avg` : ''}</strong></li>)}
            </ol>
          ) : <p className="stats-empty">Your completed topics will show which areas you come back to most.</p>}
        </article>

        <article className="stats-detail-card">
          <span className="eyebrow">YOUR CATEGORY SCORES</span>
          {categoryPerformance.length ? (
            <ol className="stats-topic-list">
              {displayedCategoryPerformance.map(({ category, average, count }) => (
                <li key={category}>
                  <span>{category}{category === highestScoringCategory.category ? ' · highest' : category === categoryToRevisit?.category ? ' · revisit' : ''}</span>
                  <strong>{Math.round(average)}% · {count} scored</strong>
                </li>
              ))}
            </ol>
          ) : <p className="stats-empty">Complete at least two scored sessions in a category to see how your results compare across topics.</p>}
        </article>
      </section>

      <section className="stats-category-editor" aria-labelledby="category-editor-title">
        <div className="stats-category-editor-heading">
          <div>
            <span className="eyebrow">YOUR TOPICS</span>
            <h2 id="category-editor-title">Your practice topics</h2>
          </div>
          <p>These are the topics you’ve practiced. Change a category if it doesn’t fit the way you think about that topic.</p>
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
        <span className="eyebrow">LAST TIME YOU PRACTICED</span>
        <p>{latest
          ? `${latest.topic} · ${latest.status === 'completed' ? 'Completed' : latest.status === 'left' ? 'Left early' : 'In progress'}${Number.isFinite(latest.score) ? ` · ${latest.score}% score` : ''}${Number.isFinite(latest.onTopicPercent) ? ` · ${latest.onTopicPercent}% on-topic estimate` : ''}`
          : 'Start a practice session and your own history will build here.'}</p>
        <span className="stats-notes-count">{notes.length ? `${notes.length} saved ${notes.length === 1 ? 'note' : 'notes'} for your topics` : 'No saved topic notes yet'}</span>
      </div>
    </main>
  )
}
