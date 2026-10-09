import { isTopicCategory } from './topicCategory.js'

const SESSION_KEY = 'voice-up-last-session'
const NOTES_KEY = 'voice-up-notes'
const PRACTICE_HISTORY_KEY = 'voice-up-practice-history'
const PROFILE_PICTURE_KEY = 'voice-up-profile-picture'
const TOPIC_CATEGORIES_KEY = 'voice-up-topic-categories'
const BACKUP_FORMAT = 'voice-up-backup'
const BACKUP_VERSION = 1

function normalizeTopic(topic) {
  return typeof topic === 'string' ? topic.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : ''
}

function readStoredJson(key, fallback) {
  const value = localStorage.getItem(key)
  return value === null ? fallback : JSON.parse(value)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isProfilePicture(value) {
  return value === null || (typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value))
}

function validateBackup(backup) {
  if (
    !isRecord(backup)
    || backup.format !== BACKUP_FORMAT
    || backup.version !== BACKUP_VERSION
    || !isRecord(backup.data)
  ) {
    throw new Error('This file is not a supported Voice Up backup.')
  }

  const { data } = backup
  if (
    !(data.session === null || isRecord(data.session))
    || !Array.isArray(data.notes)
    || !data.notes.every((note) => isRecord(note) && typeof note.topic === 'string' && typeof note.content === 'string')
    || !Array.isArray(data.practiceHistory)
    || !data.practiceHistory.every((record) => isRecord(record) && typeof record.topic === 'string')
    || !isProfilePicture(data.profilePicture)
    || !isRecord(data.topicCategories)
    || !Object.entries(data.topicCategories).every(([topic, category]) => topic.length > 0 && isTopicCategory(category))
  ) {
    throw new Error('The backup file is incomplete or contains invalid data.')
  }

  return backup
}

export function createBackup() {
  return validateBackup({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      session: readStoredJson(SESSION_KEY, null),
      notes: readStoredJson(NOTES_KEY, []),
      practiceHistory: readStoredJson(PRACTICE_HISTORY_KEY, []),
      profilePicture: localStorage.getItem(PROFILE_PICTURE_KEY),
      topicCategories: readStoredJson(TOPIC_CATEGORIES_KEY, {}),
    },
  })
}

export function getBackupSummary(backupFile) {
  const backup = validateBackup(backupFile)
  return {
    notes: backup.data.notes.length,
    sessions: backup.data.practiceHistory.length,
    hasProfilePicture: Boolean(backup.data.profilePicture),
  }
}

export function restoreBackup(backupFile) {
  const { data } = validateBackup(backupFile)
  const entries = [
    [SESSION_KEY, data.session],
    [NOTES_KEY, data.notes],
    [PRACTICE_HISTORY_KEY, data.practiceHistory],
    [PROFILE_PICTURE_KEY, data.profilePicture],
    [TOPIC_CATEGORIES_KEY, data.topicCategories],
  ]
  const previousValues = entries.map(([key]) => [key, localStorage.getItem(key)])

  try {
    entries.forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(value))
    })
  } catch (error) {
    try {
      previousValues.forEach(([key, value]) => {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      })
    } catch (rollbackError) {
      throw new Error(`The backup could not be restored, and saved data could not be rolled back: ${rollbackError.message}`, { cause: rollbackError })
    }
    throw new Error(`The backup could not be restored: ${error.message}`, { cause: error })
  }
}

export function readTopicCategories() {
  try {
    const categories = readStoredJson(TOPIC_CATEGORIES_KEY, {})
    return isRecord(categories) ? categories : {}
  } catch {
    return {}
  }
}

export function saveTopicCategory(topic, category) {
  const normalizedTopic = normalizeTopic(topic)
  if (!normalizedTopic || !isTopicCategory(category)) {
    throw new TypeError('A topic and category are required.')
  }

  const savedCategories = readStoredJson(TOPIC_CATEGORIES_KEY, {})
  if (!isRecord(savedCategories)) throw new Error('Saved topic categories are invalid and could not be updated.')
  const categories = Object.assign(Object.create(null), savedCategories)
  categories[normalizedTopic] = category

  const history = readStoredJson(PRACTICE_HISTORY_KEY, [])
  if (!Array.isArray(history)) throw new Error('Saved practice history is invalid and could not be updated.')
  let historyChanged = false
  const updatedHistory = history.map((record) => {
    if (normalizeTopic(record.topic || '') !== normalizedTopic) return record
    historyChanged = true
    return { ...record, category }
  })

  const session = readStoredJson(SESSION_KEY, null)
  const updatedSession = session && normalizeTopic(session.topic) === normalizedTopic
    ? { ...session, category }
    : session
  const entries = [
    [TOPIC_CATEGORIES_KEY, categories],
    ...(historyChanged ? [[PRACTICE_HISTORY_KEY, updatedHistory]] : []),
    ...(updatedSession !== session ? [[SESSION_KEY, updatedSession]] : []),
  ]
  const previousValues = entries.map(([key]) => [key, localStorage.getItem(key)])

  try {
    entries.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
  } catch (error) {
    try {
      previousValues.forEach(([key, value]) => {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      })
    } catch (rollbackError) {
      throw new Error(`The category could not be saved, and saved data could not be rolled back: ${rollbackError.message}`, { cause: rollbackError })
    }
    throw new Error(`The category could not be saved: ${error.message}`, { cause: error })
  }
}

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

export function readPracticeHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(PRACTICE_HISTORY_KEY) || '[]')
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

export function savePracticeRecord(record) {
  const history = readPracticeHistory()
  const index = history.findIndex((item) => item.id === record.id)
  if (index === -1) history.unshift(record)
  else history[index] = { ...history[index], ...record }
  localStorage.setItem(PRACTICE_HISTORY_KEY, JSON.stringify(history))
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

const topicStopWords = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'between', 'by', 'can', 'challenges',
  'connection', 'different', 'everyday', 'exploring', 'facts', 'for', 'from', 'future', 'how',
  'in', 'interesting', 'introduction', 'is', 'it', 'learn', 'lessons', 'life', 'makes', 'new',
  'of', 'on', 'opportunities', 'people', 'perspectives', 'related', 'role', 'the', 'to', 'we',
  'what', 'world',
])

function topicWordSet(text) {
  return new Set(
    text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)
      ?.map((word) => {
        if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
        if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2)
        if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
        return word
      })
      .filter((word) => word.length > 2 && !topicStopWords.has(word)) || [],
  )
}

function getTopicRelevance(transcript, topic) {
  const topicWords = topicWordSet(topic)
  const transcriptWords = topicWordSet(transcript)
  if (!topicWords.size || !transcriptWords.size) return null

  const matchingWords = [...topicWords].filter((word) => transcriptWords.has(word))
  const topicCoverage = matchingWords.length / topicWords.size
  const transcriptDensity = matchingWords.length / transcriptWords.size
  return Math.round((topicCoverage * 0.5 + transcriptDensity * 0.5) * 100)
}

export function evaluateTranscript(transcript, difficulty, eyeContactPercent = null, topic = '') {
  const words = transcript.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const uniqueWords = new Set(words.map((word) => word.toLowerCase())).size
  const difficultyPenalty = { Easy: 0, Medium: 8, Hard: 16, Expert: 24 }[difficulty] ?? 0
  const eyeContactAdjustment = eyeContactPercent === null ? 0 : Math.round((eyeContactPercent - 50) * 0.16)
  const speakingScore = Math.max(1, Math.min(100, Math.round(25 + Math.min(wordCount, 140) * 0.48 + Math.min(uniqueWords, 50) * 0.3 - difficultyPenalty + eyeContactAdjustment)))
  const onTopicPercent = topic ? getTopicRelevance(transcript, topic) : null
  const score = onTopicPercent === null
    ? speakingScore
    : Math.round(speakingScore * 0.7 + onTopicPercent * 0.3)
  const result = score >= 80 ? 'strong' : score >= 55 ? 'steady' : 'developing'
  const speakingFeedback = wordCount
    ? `You spoke ${wordCount} words and used ${uniqueWords} distinct words. ${wordCount >= 70 ? 'You sustained your explanation well, giving yourself room to develop the topic.' : 'Your next step is to expand each point with a concrete example or supporting detail.'} ${uniqueWords / wordCount > 0.65 ? 'Your language stayed varied and specific.' : 'Try varying your phrasing and signposting how each idea connects.'} ${difficulty === 'Expert' ? 'Expert practice rewards precise evidence, nuance, and a clear line of reasoning; aim to support each claim with a specific example.' : difficulty === 'Hard' ? 'At this difficulty, strengthen your reasoning with evidence and address at least one complication or counterpoint.' : difficulty === 'Medium' ? 'For an even clearer response, organize it around two or three points and finish with a concise takeaway.' : 'Keep building confidence by speaking in complete thoughts and giving one example for each main idea.'}`
    : 'No speech transcript was captured. Check that your browser supports speech recognition and that microphone permission is enabled, then try another session. This score reflects the missing transcript, not your ability.'
  const eyeContactFeedback = eyeContactPercent === null
    ? 'Eye contact could not be assessed because no camera gaze samples were captured.'
    : `Your estimated eye contact with the camera was ${eyeContactPercent}%. Try returning your gaze to the lens between glances at your notes.`
  const topicFeedback = onTopicPercent === null
    ? 'Topic relevance could not be estimated from this transcript.'
    : `Estimated on-topic relevance: ${onTopicPercent}%. Topic relevance contributes 30% of your score and is estimated from words shared with the topic; related wording may not be recognized.`
  return { score, result, feedback: `${speakingFeedback} ${topicFeedback} ${eyeContactFeedback}`, wordCount, eyeContactPercent, onTopicPercent }
}