import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { evaluateTranscript, formatTime, readNotes, readSession, readTopicCategories, saveNote, savePracticeRecord, saveSession, summarizeSpeechPatterns } from '../session'
import { categorizeTopic, getTopicCategory } from '../topicCategory'

const difficulties = ['Easy', 'Medium', 'Hard', 'Expert']

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const randomTopicSeeds = [
  'Octopuses', 'Antikythera', 'Fog', 'Magnetoreception', 'Mycorrhizae',
  'Voynich', 'Placebo', 'Agrivoltaics', 'Pozzolana', 'Tardigrades',
  'Corals', 'Gutenberg', 'Nitinol', 'Albedo', 'Cooperation',
  'Satellites', 'Cetaceans', 'Permaculture', 'Bioluminescence', 'CRISPR',
  'Cahokia', 'Algorithms', 'Architecture', 'Mangroves', 'Anthocyanins',
  'Ancient libraries', 'Auroras', 'Bamboo', 'Bees', 'Bird migration',
  'Black holes', 'Butterflies', 'Cartography', 'Cave paintings', 'Cloud forests',
  'Comets', 'Coral reefs', 'Deserts', 'Dinosaurs', 'Dreams',
  'Eclipses', 'Ecosystems', 'Emperor penguins', 'Floating gardens', 'Fossils',
  'Glaciers', 'Gravity', 'Hibernation', 'Honeybees', 'Icebergs',
  'Inventions', 'Islands', 'Jellyfish', 'Kelp forests', 'Lighthouses',
  'Meteor showers', 'Migration', 'Moon gardens', 'Mountain ranges', 'Museums',
  'National parks', 'Northern lights', 'Ocean currents', 'Parks', 'Pine forests',
  'Planetariums', 'Rainbows', 'Rainforests', 'Recycling', 'Renewable energy',
  'Rivers', 'Robotics', 'Seeds', 'Snowflakes', 'Solar eclipses',
  'Solar power', 'Space exploration', 'Spiders', 'Stargazing', 'Storytelling',
  'Telescope design', 'Tide pools', 'Tree rings', 'Volcanoes', 'Waterfalls',
  'Weather patterns', 'Wetlands', 'Wind farms', 'World languages', 'Zebras',
]

const randomTopicTemplates = [
  'The history of {topic}',
  'The science behind {topic}',
  'The future of {topic}',
  'The role of {topic} in everyday life',
  '{topic} around the world',
  '{topic} in art and culture',
  'The connection between {topic} and nature',
  'The connection between {topic} and technology',
  'How people learn about {topic}',
  'Interesting facts about {topic}',
  'New discoveries related to {topic}',
  'The impact of {topic} on communities',
  'Exploring {topic}',
  'What makes {topic} fascinating',
  'Different perspectives on {topic}',
  'How {topic} connect to daily life',
  'Lessons we can learn from {topic}',
  'Challenges and opportunities in {topic}',
  'The importance of {topic}',
  'An introduction to {topic}',
]

const randomTopics = [...new Set([
  ...randomTopicSeeds,
  ...randomTopicSeeds.flatMap((topic) => randomTopicTemplates.map((template) => template.replace('{topic}', topic))),
])]

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function DiceButton({ field, onClick }) {
  return (
    <button className="setup-dice-button" type="button" aria-label={`Randomize ${field}`} title={`Randomize ${field}`} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="8.5" cy="8.5" r="1" />
        <circle cx="15.5" cy="8.5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="8.5" cy="15.5" r="1" />
        <circle cx="15.5" cy="15.5" r="1" />
      </svg>
    </button>
  )
}

function isLookingAtCamera(landmarks) {
  const eyeGaze = (irisIndex, cornerAIndex, cornerBIndex, upperIndex, lowerIndex) => {
    const iris = landmarks[irisIndex]
    const cornerA = landmarks[cornerAIndex]
    const cornerB = landmarks[cornerBIndex]
    const upper = landmarks[upperIndex]
    const lower = landmarks[lowerIndex]
    if (!iris || !cornerA || !cornerB || !upper || !lower) return null
    const left = Math.min(cornerA.x, cornerB.x)
    const right = Math.max(cornerA.x, cornerB.x)
    const top = Math.min(upper.y, lower.y)
    const bottom = Math.max(upper.y, lower.y)
    if (right === left || bottom === top) return null
    return { horizontal: (iris.x - left) / (right - left), vertical: (iris.y - top) / (bottom - top) }
  }
  const leftEye = eyeGaze(468, 33, 133, 159, 145)
  const rightEye = eyeGaze(473, 362, 263, 386, 374)
  const nose = landmarks[1]
  const outerLeft = landmarks[33]
  const outerRight = landmarks[263]
  if (!leftEye || !rightEye || !nose || !outerLeft || !outerRight) return null
  const eyeWidth = Math.abs(outerRight.x - outerLeft.x)
  if (!eyeWidth) return null
  const facingForward = Math.abs(nose.x - (outerLeft.x + outerRight.x) / 2) < eyeWidth * .25
  const eyesCentered = [leftEye, rightEye].every((eye) => eye.horizontal >= .25 && eye.horizontal <= .75 && eye.vertical >= .15 && eye.vertical <= .85)
  return facingForward && eyesCentered
}

function initialSession() {
  return {
    topic: '',
    durationSeconds: 300,
    remainingSeconds: 300,
    difficulty: 'Medium',
    status: 'setup',
    transcript: '',
    note: '',
  }
}

export function CircularTimer({ session, onAction, actionLabel, running = false }) {
  const progress = session.durationSeconds ? session.remainingSeconds / session.durationSeconds : 1
  const percentage = Math.min(100, Math.max(0, progress * 100))
  return (
    <div className={`timer-wrap ${actionLabel ? '' : 'timer-wrap-compact'}`}>
      <div className={`timer-ring ${running ? 'timer-ring-running' : ''}`} style={{ '--timer-progress': `${percentage}%` }}>
        <div className="timer-face">
          <span className="timer-kicker">YOUR TOPIC</span>
          <h1>{session.topic}</h1>
          <span className="timer-time">{formatTime(session.remainingSeconds)}</span>
          <span className="timer-meta">{session.difficulty} practice</span>
        </div>
      </div>
      {actionLabel && <button className="primary-button timer-action" onClick={onAction}>{actionLabel}</button>}
    </div>
  )
}

function TopicNotesDialog({ dialogRef, topic, note, onChange }) {
  return (
    <dialog ref={dialogRef} className="topic-notes-dialog">
      <div className="topic-notes-heading">
        <span className="eyebrow">SESSION NOTES</span>
        <button className="notes-dialog-close" aria-label="Close notes" onClick={() => dialogRef.current?.close()}>×</button>
      </div>
      <div className="topic-notes-content">
        <span className="topic-notes-label">TOPIC</span>
        <h2>{topic}</h2>
        <textarea autoFocus aria-label={`${topic} notes`} placeholder="Research, outline, or collect your thoughts..." value={note} onChange={(event) => onChange(event.target.value)} />
      </div>
    </dialog>
  )
}

function CameraPreview({ videoRef, eyeContactPercent, gazeModelReady, gazeError }) {
  const status = gazeError
    ? 'Gaze estimate unavailable'
    : gazeModelReady && eyeContactPercent !== null
      ? `${eyeContactPercent}% camera-facing gaze`
      : 'Preparing eye-contact check'
  return (
    <aside className="camera-preview" aria-label="Camera and eye-contact preview">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
      <span className="camera-status"><i aria-hidden="true" />{status}</span>
      <span className="camera-status-detail">Only visible face samples are counted.</span>
    </aside>
  )
}

function TopicNotesPanel({ topic, note, onChange, isOpen, onToggle, dimensions, onDimensionsChange, resizeDragRef }) {
  function startResize(event) {
    event.preventDefault()
    resizeDragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: dimensions.width,
      height: dimensions.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resize(event) {
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    onDimensionsChange({
      width: Math.min(window.innerWidth - 32, Math.max(280, drag.width - (event.clientX - drag.x))),
      height: Math.min(window.innerHeight - 40, Math.max(230, drag.height - (event.clientY - drag.y))),
    })
  }

  function stopResize(event) {
    if (resizeDragRef.current?.pointerId !== event.pointerId) return
    resizeDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section
      className={`session-notes-widget session-notes-widget-large ${isOpen ? 'session-notes-widget-open' : 'session-notes-widget-closed'}`}
      style={isOpen ? { '--notes-panel-width': `${dimensions.width}px`, '--notes-panel-height': `${dimensions.height}px` } : undefined}
      aria-label="Session notes"
    >
      <button
        className="session-notes-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="session-notes-panel"
        onClick={onToggle}
      >
        <span aria-hidden="true">{isOpen ? '▾' : '▴'}</span>
        {isOpen ? 'Hide session notes' : 'Open session notes'}
      </button>
      {isOpen && (
        <div id="session-notes-panel" className="session-notes-panel session-notes-large">
          <div className="session-notes-heading">
            <button
              className="session-notes-resize-handle"
              type="button"
              aria-label="Resize session notes panel by dragging"
              title="Drag to resize"
              onPointerDown={startResize}
              onPointerMove={resize}
              onPointerUp={stopResize}
              onPointerCancel={stopResize}
            >
              <span aria-hidden="true">⤡</span>
              <span>Resize panel</span>
            </button>
            <strong>SESSION NOTES</strong>
          </div>
          <div className="topic-notes-content">
            <span className="topic-notes-label">TOPIC</span>
            <h2>{topic}</h2>
            <textarea
              aria-label={`${topic} notes`}
              placeholder="Research, outline, or collect your thoughts..."
              value={note}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          <p className="session-notes-resize-hint">Drag the “Resize panel” control in the upper-left corner to change the panel size.</p>
        </div>
      )}
    </section>
  )
}

function ExitButton({ onClick }) {
  return <button className="exit-button" aria-label="Exit session" title="Exit" onClick={onClick}>×</button>
}

function MicrophoneIcon() {
  return <span className="mic-icon" aria-hidden="true">●</span>
}

export default function PracticePage({ mode = 'new', view = 'setup' }) {
  const navigate = useNavigate()
  const recognitionRef = useRef(null)
  const noteDialogRef = useRef(null)
  const leaveRunDialogRef = useRef(null)
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const gazeStatsRef = useRef({ samples: 0, direct: 0 })
  const randomTopicsRef = useRef([])
  const lastRandomTopicRef = useRef(null)
  const [session, setSession] = useState(() => readSession() || initialSession())
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState(5)
  const [seconds, setSeconds] = useState(0)
  const [difficulty, setDifficulty] = useState('Medium')
  const [permissionError, setPermissionError] = useState('')
  const [isValidatingTopic, setIsValidatingTopic] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [cameraStream, setCameraStream] = useState(null)
  const [eyeContactPercent, setEyeContactPercent] = useState(null)
  const [gazeModelReady, setGazeModelReady] = useState(false)
  const [gazeError, setGazeError] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [rollingDice, setRollingDice] = useState('')
  const [rollKey, setRollKey] = useState(0)
  const [sessionNotesOpen, setSessionNotesOpen] = useState(true)
  const [sessionNotesDimensions, setSessionNotesDimensions] = useState({ width: 480, height: 500 })
  const sessionNotesResizeRef = useRef(null)

  useEffect(() => () => {
    recognitionRef.current?.stop()
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    landmarkerRef.current?.close()
  }, [])

  useEffect(() => {
    if (!cameraStream || session.status !== 'running') return undefined
    let cancelled = false
    let animationFrame = 0
    let landmarker
    let lastSampleAt = 0

    async function trackGaze() {
      try {
        const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm')
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setGazeModelReady(true)
        const video = videoRef.current
        if (!video) return
        video.srcObject = cameraStream
        await video.play()

        function sampleFrame(timestamp) {
          if (cancelled) return
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && timestamp - lastSampleAt >= 250) {
            lastSampleAt = timestamp
            const result = landmarker.detectForVideo(video, timestamp)
            const gazeStats = gazeStatsRef.current
            const faceLandmarks = result.faceLandmarks[0]
            if (faceLandmarks) {
              const isLookingNearCamera = isLookingAtCamera(faceLandmarks)
              if (isLookingNearCamera !== null) {
                gazeStats.samples += 1
                if (isLookingNearCamera) gazeStats.direct += 1
                setEyeContactPercent(Math.round((gazeStats.direct / gazeStats.samples) * 100))
              }
            }
          }
          animationFrame = window.requestAnimationFrame(sampleFrame)
        }

        animationFrame = window.requestAnimationFrame(sampleFrame)
      } catch {
        if (!cancelled) setGazeError(true)
      }
    }

    void trackGaze()
    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
      landmarker?.close()
      if (landmarkerRef.current === landmarker) landmarkerRef.current = null
    }
  }, [cameraStream, session.status])

  useEffect(() => {
    if (session.status !== 'complete') return
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
  }, [session.status])

  const finishSession = useCallback((current, elapsedSeconds) => {
    const gazeStats = gazeStatsRef.current
    const eyeContactPercent = gazeStats.samples ? Math.round((gazeStats.direct / gazeStats.samples) * 100) : null
    const evaluation = evaluateTranscript(current.transcript || transcript, current.difficulty, eyeContactPercent, current.topic)
    const next = {
      ...current,
      status: 'complete',
      remainingSeconds: 0,
      accumulatedElapsedSeconds: elapsedSeconds,
      endsAt: undefined,
      gazeSamples: gazeStats.samples,
      eyeContactSamples: gazeStats.direct,
      eyeContactPercent,
      evaluation,
    }
    savePracticeRecord({
      id: current.id,
      topic: current.topic,
      category: current.category || categorizeTopic(current.topic),
      difficulty: current.difficulty,
      startedAt: current.startedAt,
      durationSeconds: current.durationSeconds,
      elapsedSeconds,
      status: 'completed',
      score: evaluation.score,
      eyeContactPercent,
      onTopicPercent: evaluation.onTopicPercent,
      wordCount: evaluation.wordCount,
      fillerWordCount: evaluation.fillerWordCount,
      repeatedWordCount: evaluation.repeatedWordCount,
    })
    recognitionRef.current?.stop()
    saveSession(next)
    return next
  }, [transcript])

  useEffect(() => {
    if (session.status !== 'running') return undefined
    const interval = window.setInterval(() => {
      setSession((current) => {
        const remainingSeconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
        const elapsedSeconds = Math.min(
          current.durationSeconds,
          (current.accumulatedElapsedSeconds || 0)
            + (current.remainingAtStart || current.durationSeconds)
            - remainingSeconds,
        )
        const next = remainingSeconds === 0
          ? finishSession(current, current.durationSeconds)
          : {
            ...current,
            remainingSeconds,
            accumulatedElapsedSeconds: elapsedSeconds,
            gazeSamples: gazeStatsRef.current.samples,
            eyeContactSamples: gazeStatsRef.current.direct,
            eyeContactPercent: gazeStatsRef.current.samples
              ? Math.round((gazeStatsRef.current.direct / gazeStatsRef.current.samples) * 100)
              : null,
          }
        saveSession(next)
        return next
      })
    }, 250)
    return () => window.clearInterval(interval)
  }, [finishSession, session.status, transcript])

  function stopTimerAndViewResults() {
    setSession((current) => {
      if (current.status !== 'running') return current
      const remainingSeconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
      const elapsedSeconds = Math.min(
        current.durationSeconds,
        (current.accumulatedElapsedSeconds || 0)
          + (current.remainingAtStart || current.durationSeconds)
          - remainingSeconds,
      )
      return finishSession(current, elapsedSeconds)
    })
  }

  function exit() {
    if (session.status === 'running') {
      const remainingSeconds = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000))
      const elapsedSeconds = Math.min(
        session.durationSeconds,
        (session.accumulatedElapsedSeconds || 0) + (session.remainingAtStart || session.durationSeconds) - remainingSeconds,
      )
      const pausedSession = {
        ...session,
        status: 'ready',
        remainingSeconds,
        accumulatedElapsedSeconds: elapsedSeconds,
        endsAt: undefined,
      }
      saveSession(pausedSession)
      const speechPatterns = summarizeSpeechPatterns(session.transcript || transcript)
      savePracticeRecord({
        id: session.id,
        topic: session.topic,
        category: session.category || categorizeTopic(session.topic),
        difficulty: session.difficulty,
        startedAt: session.startedAt,
        durationSeconds: session.durationSeconds,
        elapsedSeconds,
        status: 'left',
        score: null,
        eyeContactPercent: session.eyeContactPercent ?? null,
        ...speechPatterns,
      })
    }
    recognitionRef.current?.stop()
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraStream(null)
    navigate('/new')
  }

  function requestExit() {
    if (session.status === 'running') {
      leaveRunDialogRef.current?.showModal()
      return
    }
    exit()
  }

  async function begin(nextSession) {
    setPermissionError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Microphone and camera access are needed before continuing. This browser does not provide camera capture.')
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      setTranscript('')
      setGazeError(false)
      setGazeModelReady(false)
      gazeStatsRef.current = {
        samples: nextSession.gazeSamples || 0,
        direct: nextSession.eyeContactSamples || 0,
      }
      setEyeContactPercent(nextSession.eyeContactPercent ?? null)
      const started = {
        ...nextSession,
        id: nextSession.id || createSessionId(),
        startedAt: nextSession.startedAt || Date.now(),
        accumulatedElapsedSeconds: nextSession.accumulatedElapsedSeconds
          ?? Math.max(0, nextSession.durationSeconds - nextSession.remainingSeconds),
        remainingAtStart: nextSession.remainingSeconds || nextSession.durationSeconds,
        status: 'running',
        remainingSeconds: nextSession.remainingSeconds || nextSession.durationSeconds,
        endsAt: Date.now() + (nextSession.remainingSeconds || nextSession.durationSeconds) * 1000,
        transcript: nextSession.status === 'running' ? nextSession.transcript || '' : '',
      }
      saveSession(started)
      const speechPatterns = summarizeSpeechPatterns(started.transcript || '')
      savePracticeRecord({
        id: started.id,
        topic: started.topic,
        category: started.category || categorizeTopic(started.topic),
        difficulty: started.difficulty,
        startedAt: started.startedAt,
        durationSeconds: started.durationSeconds,
        elapsedSeconds: started.accumulatedElapsedSeconds,
        status: 'in-progress',
        score: null,
        eyeContactPercent: started.eyeContactPercent ?? null,
        ...speechPatterns,
      })
      setSession(started)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = navigator.language || 'en-US'
        recognition.onresult = (event) => {
          let captured = ''
          for (let index = 0; index < event.results.length; index += 1) captured += `${event.results[index][0].transcript} `
          setTranscript(captured.trim())
          setSession((current) => {
            const next = { ...current, transcript: captured.trim() }
            saveSession(next)
            return next
          })
        }
        recognition.onerror = () => setPermissionError('Microphone access is needed to capture speech. Check your browser’s microphone permission.')
        recognitionRef.current = recognition
        recognition.start()
      }
      navigate('/new/session')
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
      setCameraStream(null)
      setPermissionError('Microphone and camera access are needed before continuing. Allow both permissions in your browser, then try again.')
    }
  }

  function configureSession(nextTopic = topic, nextDuration = minutes * 60 + seconds, nextDifficulty = difficulty) {
    const created = {
      ...initialSession(),
      id: createSessionId(),
      topic: nextTopic.trim(),
      category: getTopicCategory(nextTopic, readTopicCategories()),
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      accumulatedElapsedSeconds: 0,
      difficulty: nextDifficulty,
      status: 'ready',
    }
    saveSession(created)
    setSession(created)
    return created
  }

  async function startConfigured() {
    const durationSeconds = minutes * 60 + seconds
    if (durationSeconds < 30 || durationSeconds > 1800) {
      setPermissionError('Choose a time between 30 seconds and 30 minutes.')
      return
    }
    setIsValidatingTopic(true)
    setPermissionError('')
    try {
      const { validateTopic } = await import('../topicValidation')
      const topicError = validateTopic(topic)
      if (topicError) {
        setPermissionError(topicError)
        return
      }
      const created = configureSession()
      setSession(created)
      navigate('/new/preview')
    } finally {
      setIsValidatingTopic(false)
    }
  }

  function rollDice(field) {
    setRollingDice(field)
    setRollKey((key) => key + 1)
  }

  function randomizeTopic() {
    rollDice('topic')
    setSpinning(true)
    if (!randomTopicsRef.current.length) {
      const shuffledTopics = [...randomTopics]
      for (let index = shuffledTopics.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        const topicAtIndex = shuffledTopics[index]
        shuffledTopics[index] = shuffledTopics[swapIndex]
        shuffledTopics[swapIndex] = topicAtIndex
      }
      if (shuffledTopics[shuffledTopics.length - 1] === lastRandomTopicRef.current) {
        const lastIndex = shuffledTopics.length - 1
        const firstTopic = shuffledTopics[0]
        shuffledTopics[0] = shuffledTopics[lastIndex]
        shuffledTopics[lastIndex] = firstTopic
      }
      randomTopicsRef.current = shuffledTopics
    }
    const nextTopic = randomTopicsRef.current.pop()
    lastRandomTopicRef.current = nextTopic
    setTopic(nextTopic)
    setPermissionError('')
  }

  function randomizeTimer() {
    rollDice('timer')
    const durationSeconds = Math.floor(Math.random() * (5 * 60 - 30 + 1)) + 30
    setMinutes(Math.floor(durationSeconds / 60))
    setSeconds(durationSeconds % 60)
  }

  function randomizeDifficulty() {
    rollDice('difficulty')
    setDifficulty(randomItem(difficulties))
  }

  function resume() {
    let saved = readSession()
    if (!saved) return navigate('/new/setup')
    if (saved.status === 'complete') {
      saved = {
        ...saved,
        id: createSessionId(),
        startedAt: undefined,
        accumulatedElapsedSeconds: 0,
        status: 'ready',
        remainingSeconds: saved.durationSeconds,
        transcript: '',
        gazeSamples: 0,
        eyeContactSamples: 0,
        eyeContactPercent: null,
        evaluation: undefined,
      }
      saveSession(saved)
    }
    void begin(saved)
  }

  function updateNote(value) {
    setSession((current) => {
      const next = { ...current, note: value }
      saveSession(next)
      saveNote(current.topic, value)
      return next
    })
  }

  function openNotes() {
    const savedNote = readNotes().find((note) => note.topic === session.topic)
    const note = session.note || savedNote?.content || ''
    setSession((current) => ({ ...current, note }))
    saveNote(session.topic, note)
    noteDialogRef.current?.showModal()
  }

  if (mode === 'new' && view === 'home') {
    return <main className="practice-page new-landing">
      <div className="landing-copy"><span className="eyebrow">VOICE UP / PRACTICE</span><h1>Make space<br />for your voice.</h1><p>Choose a topic, set your pace, and practice speaking with intention.</p></div>
      <button className="plus-button" aria-label="Create a practice session" onClick={() => navigate('/new/setup')}><span>+</span><small>NEW SESSION</small></button>
    </main>
  }

  if (mode === 'new' && view === 'setup') {
    return <main className="practice-page setup-page">
      <ExitButton onClick={exit} />
      <div className="setup-heading"><span className="eyebrow">BUILD YOUR SESSION</span><h1>What would you like to explore?</h1><p>Set a topic, a time limit, and the level of challenge.</p></div>
      <div className="setup-layout">
        <div className="setup-grid">
          <section className="setup-field topic-field">
            <label htmlFor="practice-topic">Topic</label>
            <div className="setup-field-control">
              <input
                key={spinning ? `topic-${rollKey}` : 'topic'}
                id="practice-topic"
                className={spinning ? 'topic-spinning' : ''}
                maxLength="100"
                placeholder="e.g. Why do cities need green spaces?"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onAnimationEnd={() => {
                  setSpinning(false)
                  setRollingDice((current) => current === 'topic' ? '' : current)
                }}
              />
              <DiceButton field="topic" onClick={randomizeTopic} />
            </div>
          </section>
          <section className="setup-field">
            <label>Timer</label>
            <div className="setup-field-control">
              <div
                key={rollingDice === 'timer' ? `timer-${rollKey}` : 'timer'}
                className={`time-inputs${rollingDice === 'timer' ? ' setup-value-roll' : ''}`}
                onAnimationEnd={() => setRollingDice((current) => current === 'timer' ? '' : current)}
              ><label><input aria-label="Minutes" type="number" min="0" max="30" value={minutes} onChange={(event) => setMinutes(Math.min(30, Math.max(0, Number(event.target.value))))} /><span>MIN</span></label><b>:</b><label><input aria-label="Seconds" type="number" min="0" max="59" step="15" value={seconds} onChange={(event) => setSeconds(Math.min(59, Math.max(0, Number(event.target.value))))} /><span>SEC</span></label></div>
              <DiceButton field="timer" onClick={randomizeTimer} />
            </div>
            <small>30 seconds to 30 minutes</small>
          </section>
          <section className="setup-field difficulty-field">
            <label>Difficulty</label>
            <div className="setup-field-control">
              <div className="difficulty-options">{difficulties.map((item) => <button key={item} className={difficulty === item ? 'difficulty-option selected' : 'difficulty-option'} onClick={() => setDifficulty(item)}>{difficulty === item && rollingDice === 'difficulty' ? <span key={`difficulty-${rollKey}`} className="setup-value-roll" onAnimationEnd={() => setRollingDice((current) => current === 'difficulty' ? '' : current)}>{item}</span> : item}</button>)}</div>
              <DiceButton field="difficulty" onClick={randomizeDifficulty} />
            </div>
            <small>Higher levels expect more detail and stronger reasoning.</small>
          </section>
        </div>
      </div>
      {permissionError && <p className="inline-error">{permissionError}</p>}
      <button className="primary-button setup-submit" disabled={isValidatingTopic} onClick={startConfigured}>{isValidatingTopic ? 'Checking topic...' : 'Continue to timer'} <span>→</span></button>
    </main>
  }

  if (mode === 'new' && view === 'preview') {
    return <main className="practice-page prestart-page">
      <ExitButton onClick={exit} />
      <header className="prestart-heading"><span className="eyebrow">READY WHEN YOU ARE</span><h1>Find your first words.</h1><p>Take a moment to gather your thoughts before the timer starts.</p></header>
      <CircularTimer session={session} />
      <div className="prestart-actions"><button className="secondary-button notes-button" onClick={openNotes}>Notes <span aria-hidden="true">↗</span></button><button className="primary-button" onClick={() => void begin(session)}>Start <span aria-hidden="true">→</span></button></div>
      {permissionError && <p className="inline-error">{permissionError}</p>}
      <p className="resume-detail">Microphone and camera access are requested when you start.</p>
      <TopicNotesDialog dialogRef={noteDialogRef} topic={session.topic} note={session.note || ''} onChange={updateNote} />
    </main>
  }

  if (mode === 'new' && view === 'resume') {
    const saved = readSession()
    return (
      <main className="practice-page resume-page">
        <ExitButton onClick={exit} />
        {saved ? <>
          <header className="resume-heading">
            <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
            <h1>One thought at a time.</h1>
          </header>
          <div className="resume-timer">
            <CircularTimer session={saved} actionLabel={saved.status === 'complete' ? 'Practice again' : 'Resume'} onAction={resume} />
            <p className="resume-detail">{saved.difficulty} practice <span aria-hidden="true">·</span> {formatTime(saved.durationSeconds)} total</p>
          </div>
        </> : <div className="resume-empty">
          <span className="eyebrow">YOUR NEXT SESSION</span>
          <h1>No session to resume yet.</h1>
          <button className="primary-button" onClick={() => navigate('/new/setup')}>Create a session <span>→</span></button>
        </div>}
      </main>
    )
  }

  if (view === 'session') {
    const finished = session.status === 'complete'
    const evaluation = Number.isFinite(session.evaluation?.onTopicPercent)
      ? session.evaluation
      : evaluateTranscript(session.transcript || transcript, session.difficulty, session.eyeContactPercent ?? null, session.topic)
    return <main className={`practice-page session-page ${finished ? 'evaluation-page' : 'session-speaking'}`}>
      <ExitButton onClick={requestExit} />
      {!finished ? <>
        <div className="session-topline"><span className="eyebrow">SPEAK YOUR MIND</span><span>{session.difficulty} · {formatTime(session.durationSeconds)} total</span></div>
        <CircularTimer session={session} running />
        <div className="session-tools"><div><strong>{session.topic}</strong><small>{transcript ? `${transcript.split(/\s+/).filter(Boolean).length} words captured` : 'Your topic note'}</small></div></div>
        <div className="capture-status"><span className="capture-dot"><MicrophoneIcon /></span><span>Listening while you speak</span>{permissionError && <small>{permissionError}</small>}</div>
        <button className="session-stop-button" type="button" onClick={stopTimerAndViewResults}>Stop timer and view results <span aria-hidden="true">→</span></button>
        <TopicNotesPanel
          topic={session.topic}
          note={session.note || ''}
          onChange={updateNote}
          isOpen={sessionNotesOpen}
          onToggle={() => setSessionNotesOpen((isOpen) => !isOpen)}
          dimensions={sessionNotesDimensions}
          onDimensionsChange={setSessionNotesDimensions}
          resizeDragRef={sessionNotesResizeRef}
        />
        {cameraStream && <CameraPreview videoRef={videoRef} eyeContactPercent={eyeContactPercent} gazeModelReady={gazeModelReady} gazeError={gazeError} />}
        <dialog
          ref={leaveRunDialogRef}
          className="leave-run-dialog"
          aria-labelledby="leave-run-title"
          aria-describedby="leave-run-description"
        >
          <h2 id="leave-run-title">Leave this run?</h2>
          <p id="leave-run-description">Your current session will remain saved so you can resume it later.</p>
          <div className="leave-run-actions">
            <button className="secondary-button" autoFocus onClick={() => leaveRunDialogRef.current?.close()}>Stay in run</button>
            <button className="primary-button" onClick={() => {
              leaveRunDialogRef.current?.close()
              exit()
            }}>Leave run</button>
          </div>
        </dialog>
      </> : <>
        <div className="evaluation-heading"><span className="eyebrow">SESSION COMPLETE</span><h1>{session.topic}</h1><p>{session.difficulty} practice · {formatTime(session.durationSeconds)}</p></div>
        <div className="evaluation-content"><div className={`score-block score-${evaluation.result}`}><span>YOUR SCORE</span><strong>{evaluation.score}</strong><small>OUT OF 100</small>{Number.isFinite(evaluation.onTopicPercent) && <small>ON TOPIC: {evaluation.onTopicPercent}%</small>}</div><div className="feedback-block"><span className="eyebrow">REFLECTION</span><p>{evaluation.feedback}</p><small>Practice feedback is based on the speech transcript captured in your browser. Topic relevance uses a keyword estimate; no AI evaluation service is connected.</small><button className="primary-button" onClick={() => navigate('/new/setup')}>Practice again <span>→</span></button></div></div>
      </>}
    </main>
  }

  return <main className="practice-page resume-page"><ExitButton onClick={exit} /><header className="resume-heading"><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h1>One thought at a time.</h1></header><CircularTimer session={session} actionLabel="Resume" onAction={resume} /><p className="resume-detail">{session.difficulty} practice <span aria-hidden="true">·</span> {formatTime(session.durationSeconds)} total</p></main>
}
