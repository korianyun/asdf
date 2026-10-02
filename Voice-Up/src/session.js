const SESSION_KEY = 'voice-up-last-session'
const NOTES_KEY = 'voice-up-notes'

export function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!saved) return null
    if (saved.status === 'running' && saved.endsAt) {
      saved.remainingSeconds = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000))
      if (!saved.remainingSeconds) saved.status = 'complete'
    }
    return saved
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function readNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveNote(topic, content) {
  const notes = readNotes()
  const index = notes.findIndex((note) => note.topic === topic)
  const note = { topic, content, updatedAt: Date.now() }
  if (index === -1) notes.unshift(note)
  else notes[index] = note
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

export function deleteNote(topic) {
  const notes = readNotes().filter((note) => note.topic !== topic)
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  return notes
}

export function renameNote(previousTopic, nextTopic) {
  const notes = readNotes()
  if (notes.some((note) => note.topic === nextTopic && note.topic !== previousTopic)) return false
  const noteIndex = notes.findIndex((note) => note.topic === previousTopic)
  if (noteIndex === -1) return false
  notes[noteIndex] = { ...notes[noteIndex], topic: nextTopic, updatedAt: Date.now() }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  return true
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function evaluateTranscript(transcript, difficulty, eyeContactPercent = null) {
  const words = transcript.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const uniqueWords = new Set(words.map((word) => word.toLowerCase())).size
  const difficultyPenalty = { Easy: 0, Medium: 8, Hard: 16, Expert: 24 }[difficulty] ?? 0
  const eyeContactAdjustment = eyeContactPercent === null ? 0 : Math.round((eyeContactPercent - 50) * 0.16)
  const score = Math.max(1, Math.min(100, Math.round(25 + Math.min(wordCount, 140) * 0.48 + Math.min(uniqueWords, 50) * 0.3 - difficultyPenalty + eyeContactAdjustment)))
  const result = score >= 80 ? 'strong' : score >= 55 ? 'steady' : 'developing'
  const speakingFeedback = wordCount
    ? `You spoke ${wordCount} words and used ${uniqueWords} distinct words. ${wordCount >= 70 ? 'You sustained your explanation well, giving yourself room to develop the topic.' : 'Your next step is to expand each point with a concrete example or supporting detail.'} ${uniqueWords / wordCount > 0.65 ? 'Your language stayed varied and specific.' : 'Try varying your phrasing and signposting how each idea connects.'} ${difficulty === 'Expert' ? 'Expert practice rewards precise evidence, nuance, and a clear line of reasoning; aim to support each claim with a specific example.' : difficulty === 'Hard' ? 'At this difficulty, strengthen your reasoning with evidence and address at least one complication or counterpoint.' : difficulty === 'Medium' ? 'For an even clearer response, organize it around two or three points and finish with a concise takeaway.' : 'Keep building confidence by speaking in complete thoughts and giving one example for each main idea.'}`
    : 'No speech transcript was captured. Check that your browser supports speech recognition and that microphone permission is enabled, then try another session. This score reflects the missing transcript, not your ability.'
  const eyeContactFeedback = eyeContactPercent === null
    ? 'Eye contact could not be assessed because no camera gaze samples were captured.'
    : `Your estimated eye contact with the camera was ${eyeContactPercent}%. Try returning your gaze to the lens between glances at your notes.`
  return { score, result, feedback: `${speakingFeedback} ${eyeContactFeedback}`, wordCount, eyeContactPercent }
}