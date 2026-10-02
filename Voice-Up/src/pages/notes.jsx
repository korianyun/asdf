import { useRef, useState } from 'react'
import { deleteNote, readNotes, renameNote, saveNote } from '../session'

export default function NotesPage() {
  const [notes, setNotes] = useState(readNotes)
  const [activeTopic, setActiveTopic] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [titleError, setTitleError] = useState('')
  const dialogRef = useRef(null)
  const activeNote = notes.find((note) => note.topic === activeTopic)

  function openNote(topic) {
    setActiveTopic(topic)
    setTitleDraft(topic)
    setTitleError('')
    dialogRef.current?.showModal()
  }

  function createNote() {
    let topic = 'New note'
    let suffix = 2
    while (notes.some((note) => note.topic === topic)) {
      topic = `New note ${suffix}`
      suffix += 1
    }
    saveNote(topic, '')
    setNotes(readNotes())
    openNote(topic)
  }

  function updateContent(content) {
    saveNote(activeTopic, content)
    setNotes(readNotes())
  }

  function removeNote(topic) {
    if (!window.confirm(`Delete the note "${topic}"? This cannot be undone.`)) return
    setNotes(deleteNote(topic))
    if (activeTopic === topic) {
      dialogRef.current?.close()
      setActiveTopic('')
      setTitleDraft('')
    }
  }

  function commitTitle() {
    const nextTopic = titleDraft.trim()
    if (!nextTopic) {
      setTitleError('A note needs a title.')
      return false
    }
    if (nextTopic === activeTopic) return true
    if (!renameNote(activeTopic, nextTopic)) {
      setTitleError('A note with that title already exists.')
      return false
    }
    setActiveTopic(nextTopic)
    setNotes(readNotes())
    setTitleError('')
    return true
  }

  return (
    <main className="practice-page notes-page">
      <div className="notes-heading">
        <span className="eyebrow">VOICE UP / NOTES</span>
        <h1>Your notes.</h1>
      </div>
      <section className="notes-grid" aria-label="Your notes">
        <button className="note-card note-create" onClick={createNote}>
          <span className="note-create-mark" aria-hidden="true">+</span>
          <span>New note</span>
        </button>
        {notes.map((note) => (
          <article key={note.topic} className="note-card note-card-saved">
            <button className="note-card-open" onClick={() => openNote(note.topic)}>
              <span className="note-card-topic">{note.topic}</span>
              <span className="note-card-preview">{note.content || 'Start collecting your thoughts...'}</span>
              <span className="note-card-footer">OPEN NOTE <span aria-hidden="true">↗</span></span>
            </button>
            <button className="note-delete" aria-label={`Delete ${note.topic} note`} title="Delete note" onClick={() => removeNote(note.topic)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2m3 0-1 14H6L5 6" />
                <path d="M10 11v5m4-5v5" />
              </svg>
            </button>
          </article>
        ))}
        {!notes.length && <p className="notes-empty">Your topic notes and ideas will live here.</p>}
      </section>
      <dialog ref={dialogRef} className="notes-dialog" onClose={() => setTitleError('')}>
        <div className="notes-dialog-top">
          <span className="eyebrow">VOICE UP / NOTE</span>
          <button className="notes-dialog-close" aria-label="Close note" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        {activeNote && (
          <div className="notes-dialog-content">
            <label className="notes-title-label" htmlFor="note-title">NOTE TITLE</label>
            <input id="note-title" className="notes-title-input" value={titleDraft} maxLength={100} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitle} />
            {titleError && <p className="notes-title-error" role="status">{titleError}</p>}
            <textarea className="notes-body-input" aria-label="Note contents" placeholder="Start typing..." value={activeNote.content} onChange={(event) => updateContent(event.target.value)} />
            <button className="primary-button notes-done" onClick={() => {
              if (commitTitle()) dialogRef.current?.close()
            }}>Done <span aria-hidden="true">→</span></button>
          </div>
        )}
      </dialog>
    </main>
  )
}