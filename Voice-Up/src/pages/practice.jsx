import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { evaluateTranscript, formatTime, readNotes, readSession, saveNote, saveSession } from '../session'

const difficulties = ['Easy', 'Medium', 'Hard', 'Expert']

const randomTopics = [
  'Octopuses', 'Antikythera', 'Fog', 'Magnetoreception', 'Mycorrhizae',
  'Voynich', 'Placebo', 'Agrivoltaics', 'Pozzolana', 'Tardigrades',
  'Corals', 'Gutenberg', 'Nitinol', 'Albedo', 'Cooperation',
  'Satellites', 'Cetaceans', 'Permaculture', 'Bioluminescence', 'CRISPR',
  'Cahokia', 'Algorithms', 'Architecture', 'Mangroves', 'Anthocyanins',
]

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
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
    return { horizontal: (iris.x - left) / (right - left), vertical: (iris.y - top) / (bottom - top) }
  }
  const leftEye = eyeGaze(468, 33, 133, 159, 145)
  const rightEye = eyeGaze(473, 362, 263, 386, 374)
  const nose = landmarks[1]
  const outerLeft = landmarks[33]
  const outerRight = landmarks[263]
  if (!leftEye || !rightEye || !nose || !outerLeft || !outerRight) return false
  const eyeWidth = Math.abs(outerRight.x - outerLeft.x)
  const facingForward = Math.abs(nose.x - (outerLeft.x + outerRight.x) / 2) < eyeWidth * .18
  const eyesCentered = [leftEye, rightEye].every((eye) => eye.horizontal >= .3 && eye.horizontal <= .7 && eye.vertical >= .2 && eye.vertical <= .8)
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
      ? `${eyeContactPercent}% estimated eye contact`
      : 'Preparing eye-contact check'
  return (
    <aside className="camera-preview" aria-label="Camera and eye-contact preview">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
      <span className="camera-status"><i aria-hidden="true" />{status}</span>
    </aside>
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
  const videoRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const gazeStatsRef = useRef({ samples: 0, direct: 0 })
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
  const [randomized, setRandomized] = useState(null)
  const [spinning, setSpinning] = useState(false)

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
            gazeStats.samples += 1
            if (result.faceLandmarks[0] && isLookingAtCamera(result.faceLandmarks[0])) gazeStats.direct += 1
            setEyeContactPercent(Math.round((gazeStats.direct / gazeStats.samples) * 100))
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

  useEffect(() => {
    if (session.status !== 'running') return undefined
    const interval = window.setInterval(() => {
      setSession((current) => {
        const remainingSeconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
        const next = { ...current, remainingSeconds, status: remainingSeconds === 0 ? 'complete' : 'running' }
        const gazeStats = gazeStatsRef.current
        next.gazeSamples = gazeStats.samples
        next.eyeContactSamples = gazeStats.direct
        next.eyeContactPercent = gazeStats.samples ? Math.round((gazeStats.direct / gazeStats.samples) * 100) : null
        if (remainingSeconds === 0) {
          next.evaluation = evaluateTranscript(current.transcript || transcript, current.difficulty, next.eyeContactPercent)
          recognitionRef.current?.stop()
        }
        saveSession(next)
        return next
      })
    }, 250)
    return () => window.clearInterval(interval)
  }, [session.status, transcript])

  function exit() {
    recognitionRef.current?.stop()
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraStream(null)
    navigate('/new')
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
        status: 'running',
        remainingSeconds: nextSession.remainingSeconds || nextSession.durationSeconds,
        endsAt: Date.now() + (nextSession.remainingSeconds || nextSession.durationSeconds) * 1000,
        transcript: nextSession.status === 'running' ? nextSession.transcript || '' : '',
      }
      saveSession(started)
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
      navigate(mode === 'random' ? '/random/session' : '/new/session')
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
      topic: nextTopic.trim(),
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
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

  function randomize() {
    setSpinning(true)
    setRandomized(randomItem(randomTopics))
    window.setTimeout(() => setSpinning(false), 700)
  }

  function startRandom() {
    configureSession(randomized, 60 * (Math.floor(Math.random() * 5) + 1), randomItem(difficulties))
    navigate('/random/preview')
  }

  function resume() {
    let saved = readSession()
    if (!saved) return navigate('/new/setup')
    if (saved.status === 'complete') {
      saved = { ...saved, status: 'ready', remainingSeconds: saved.durationSeconds, transcript: '', evaluation: undefined }
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
      <div className="setup-grid">
        <section className="setup-field topic-field"><label htmlFor="practice-topic">Topic</label><input id="practice-topic" maxLength="100" placeholder="e.g. Why do cities need green spaces?" value={topic} onChange={(event) => setTopic(event.target.value)} /></section>
        <section className="setup-field"><label>Timer</label><div className="time-inputs"><label><input aria-label="Minutes" type="number" min="0" max="30" value={minutes} onChange={(event) => setMinutes(Math.min(30, Math.max(0, Number(event.target.value))))} /><span>MIN</span></label><b>:</b><label><input aria-label="Seconds" type="number" min="0" max="59" step="15" value={seconds} onChange={(event) => setSeconds(Math.min(59, Math.max(0, Number(event.target.value))))} /><span>SEC</span></label></div><small>30 seconds to 30 minutes</small></section>
        <section className="setup-field difficulty-field"><label>Difficulty</label><div className="difficulty-options">{difficulties.map((item) => <button key={item} className={difficulty === item ? 'difficulty-option selected' : 'difficulty-option'} onClick={() => setDifficulty(item)}>{item}</button>)}</div><small>Higher levels expect more detail and stronger reasoning.</small></section>
      </div>
      {permissionError && <p className="inline-error">{permissionError}</p>}
      <button className="primary-button setup-submit" disabled={isValidatingTopic} onClick={startConfigured}>{isValidatingTopic ? 'Checking topic...' : 'Continue to timer'} <span>→</span></button>
    </main>
  }

  if ((mode === 'new' || mode === 'random') && view === 'preview') {
    return <main className="practice-page prestart-page">
      <ExitButton onClick={exit} />
      <header className="prestart-heading"><span className="eyebrow">{mode === 'random' ? 'YOUR RANDOM TOPIC' : 'READY WHEN YOU ARE'}</span><h1>Find your first words.</h1><p>Take a moment to gather your thoughts before the timer starts.</p></header>
      <CircularTimer session={session} />
      <div className="prestart-actions"><button className="secondary-button notes-button" onClick={openNotes}>Notes <span aria-hidden="true">↗</span></button><button className="primary-button" onClick={() => void begin(session)}>Start <span aria-hidden="true">→</span></button></div>
      {permissionError && <p className="inline-error">{permissionError}</p>}
      <p className="resume-detail">Microphone and camera access are requested when you start.</p>
      <TopicNotesDialog dialogRef={noteDialogRef} topic={session.topic} note={session.note || ''} onChange={updateNote} />
    </main>
  }

  if (mode === 'random' && view !== 'session') {
    return <main className="practice-page random-page">
      <ExitButton onClick={exit} />
      <div className="random-heading"><span className="eyebrow">OFF THE CUFF</span><h1>Get a little<br />uncomfortable.</h1><p>A surprise topic, a fresh perspective, and a few minutes to make it yours.</p></div>
      <div className="random-result" aria-live="polite"><span className="random-label">YOUR TOPIC</span><p key={randomized || 'empty'} className={spinning ? 'topic-spinning' : ''}>{randomized || 'Ready when you are.'}</p>{randomized && <div className="random-details"><span>01–05 MIN</span><span>DIFFICULTY ASSIGNED AT START</span></div>}</div>
      <div className="random-actions"><button className="secondary-button" onClick={randomize}>↻ <span>Randomize</span></button>{randomized && <button className="primary-button" onClick={startRandom}>Start this topic <span>→</span></button>}</div>
      {permissionError && <p className="inline-error">{permissionError}</p>}
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
    const evaluation = session.evaluation || evaluateTranscript(session.transcript || transcript, session.difficulty)
    return <main className={`practice-page session-page ${finished ? 'evaluation-page' : ''}`}>
      <ExitButton onClick={exit} />
      {!finished ? <>
        <div className="session-topline"><span className="eyebrow">{mode === 'random' ? 'SURPRISE SESSION' : 'SPEAK YOUR MIND'}</span><span>{session.difficulty} · {formatTime(session.durationSeconds)} total</span></div>
        <CircularTimer session={session} running />
        <div className="session-tools"><button className="secondary-button notes-button" onClick={openNotes}>Notes <span aria-hidden="true">↗</span></button><div><strong>{session.topic}</strong><small>{transcript ? `${transcript.split(/\s+/).filter(Boolean).length} words captured` : 'Your topic note'}</small></div></div>
        <div className="capture-status"><span className="capture-dot"><MicrophoneIcon /></span><span>Listening while you speak</span>{permissionError && <small>{permissionError}</small>}</div>
        <TopicNotesDialog dialogRef={noteDialogRef} topic={session.topic} note={session.note || ''} onChange={updateNote} />
        {cameraStream && <CameraPreview videoRef={videoRef} eyeContactPercent={eyeContactPercent} gazeModelReady={gazeModelReady} gazeError={gazeError} />}
      </> : <>
        <div className="evaluation-heading"><span className="eyebrow">SESSION COMPLETE</span><h1>{session.topic}</h1><p>{session.difficulty} practice · {formatTime(session.durationSeconds)}</p></div>
        <div className="evaluation-content"><div className={`score-block score-${evaluation.result}`}><span>YOUR SCORE</span><strong>{evaluation.score}</strong><small>OUT OF 100</small></div><div className="feedback-block"><span className="eyebrow">REFLECTION</span><p>{evaluation.feedback}</p><small>Practice feedback is based on the speech transcript captured in your browser. No AI evaluation service is connected.</small><button className="primary-button" onClick={() => navigate('/new/setup')}>Practice again <span>→</span></button></div></div>
      </>}
    </main>
  }

  return <main className="practice-page resume-page"><ExitButton onClick={exit} /><header className="resume-heading"><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h1>One thought at a time.</h1></header><CircularTimer session={session} actionLabel="Resume" onAction={resume} /><p className="resume-detail">{session.difficulty} practice <span aria-hidden="true">·</span> {formatTime(session.durationSeconds)} total</p></main>
}
