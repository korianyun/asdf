import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { createBackup, getBackupSummary, restoreBackup } from '../session'

async function requestPhotoReview(image) {
    const response = await fetch('/api/moderate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
    })
    let result
    try {
        result = await response.json()
    } catch (error) {
        throw new Error('Photo moderation returned an invalid response.', { cause: error })
    }
    if (!response.ok) throw new Error(result.message || 'Photo moderation is unavailable.')
    if (!result.safe) throw new Error(result.message || 'Choose a more appropriate profile photo.')
}

export default function ProfilePage() {
    const backupInputRef = useRef(null)
    const restoreDialogRef = useRef(null)
    const [picture, setPicture] = useState(() => {
        try {
            return localStorage.getItem('voice-up-profile-picture') || ''
        } catch {
            return ''
        }
    })
    const [pictureApproved, setPictureApproved] = useState(false)
    const [pictureError, setPictureError] = useState('')
    const [backupMessage, setBackupMessage] = useState('')
    const [backupError, setBackupError] = useState('')
    const [restoreCandidate, setRestoreCandidate] = useState(null)
    const [restoreSummary, setRestoreSummary] = useState(null)
    const [photoConsent, setPhotoConsent] = useState(false)
    const [restorePhotoConsent, setRestorePhotoConsent] = useState(false)
    const [isCheckingPhoto, setIsCheckingPhoto] = useState(false)

    async function changePicture(event) {
        const input = event.target
        const file = input.files?.[0]
        if (!file) return
        event.target.value = ''
        if (!photoConsent) {
            setPictureError('Consent is required before sending a photo for review.')
            return
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setPictureError('Choose a JPEG, PNG, or WebP image.')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            setPictureError('Choose an image under 3 MB.')
            return
        }

        setIsCheckingPhoto(true)
        setPictureError('')
        try {
            const image = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result))
                reader.onerror = () => reject(new Error('The selected photo could not be read.'))
                reader.readAsDataURL(file)
            })
            await requestPhotoReview(image)
            localStorage.setItem('voice-up-profile-picture', image)
            setPicture(image)
            setPictureApproved(true)
            setPictureError('')
        } catch (error) {
            setPictureError(error.message || 'The photo could not be checked or saved.')
        } finally {
            setIsCheckingPhoto(false)
        }
    }

    async function checkCurrentPicture() {
        if (!picture || !photoConsent) {
            setPictureError('Consent is required before sending a photo for review.')
            return
        }
        setIsCheckingPhoto(true)
        setPictureError('')
        try {
            await requestPhotoReview(picture)
            setPictureApproved(true)
            setPictureError('')
        } catch (error) {
            setPictureApproved(false)
            setPictureError(error.message || 'The photo could not be checked.')
        } finally {
            setIsCheckingPhoto(false)
        }
    }

    function exportBackup() {
        try {
            const backup = createBackup()
            const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(file)
            const download = document.createElement('a')
            download.href = url
            download.download = `voice-up-backup-${new Date().toISOString().slice(0, 10)}.json`
            document.body.append(download)
            download.click()
            download.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
            setBackupError('')
            setBackupMessage('Your backup has been downloaded.')
        } catch (error) {
            setBackupMessage('')
            setBackupError(`Backup could not be created: ${error.message}`)
        }
    }

    async function selectBackup(event) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        try {
            const backup = JSON.parse(await file.text())
            const summary = getBackupSummary(backup)
            setRestoreCandidate(backup)
            setRestoreSummary(summary)
            setBackupError('')
            setBackupMessage('')
            restoreDialogRef.current?.showModal()
        } catch (error) {
            setBackupMessage('')
            setBackupError(`Backup could not be opened: ${error.message}`)
        }
    }

    async function confirmRestore() {
        if (!restoreCandidate) return
        const backupPicture = restoreCandidate.data.profilePicture
        if (backupPicture && !restorePhotoConsent) {
            setBackupError('Consent is required before sending the backup photo for review.')
            return
        }

        setIsCheckingPhoto(true)
        try {
            if (backupPicture) await requestPhotoReview(backupPicture)
            restoreBackup(restoreCandidate)
            setPicture(backupPicture || '')
            setPictureApproved(Boolean(backupPicture))
            setRestoreCandidate(null)
            setRestoreSummary(null)
            restoreDialogRef.current?.close()
            setBackupError('')
            setBackupMessage('Backup restored. Your saved data has been replaced.')
        } catch (error) {
            setBackupMessage('')
            setBackupError(error.message)
        } finally {
            setIsCheckingPhoto(false)
        }
    }

    return (
        <main className="practice-page profile-page">
            <section className="profile-card">
                <div className="profile-picture-wrap">
                    <div className="profile-picture">
                        {picture && pictureApproved ? <img src={picture} alt="Your profile" /> : <span>PROFILE</span>}
                    </div>
                    <input id="profile-picture-input" className="profile-picture-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changePicture(event)} disabled={!photoConsent || isCheckingPhoto} />
                    <label className="profile-picture-picker" htmlFor="profile-picture-input">Change photo</label>
                </div>
                <p className="profile-photo-hint">Photos are checked before being saved.</p>
                {isCheckingPhoto && <p className="profile-photo-progress" role="status">Checking photo…</p>}
                {picture && !pictureApproved && <button className="secondary-button profile-photo-check" type="button" onClick={() => void checkCurrentPicture()} disabled={!photoConsent || isCheckingPhoto}>{isCheckingPhoto ? 'Checking…' : 'Check current photo'}</button>}
                <details className="profile-photo-settings">
                    <summary>Photo review &amp; privacy</summary>
                    <p className="profile-photo-disclosure">Profile photos are checked for adult, suggestive, and violent content before being saved on this device. Automated checks are not perfect. Your photo is sent to Google Cloud Vision for review.</p>
                    <label className="profile-photo-consent">
                        <input type="checkbox" checked={photoConsent} onChange={(event) => setPhotoConsent(event.target.checked)} disabled={isCheckingPhoto} />
                        <span>I agree to send current or selected profile photos to Google Cloud Vision for an appropriateness check.</span>
                    </label>
                </details>
                <div className="profile-account-details">
                    <div><span>Account made</span><strong>__________</strong></div>
                    <div><span>Email</span><strong>_________</strong></div>
                    <div><span>Password</span><strong>**********</strong></div>
                </div>
                {pictureError && <p className="profile-picture-error" role="status">{pictureError}</p>}
            </section>
            <section className="profile-backup" aria-labelledby="backup-title">
                <div>
                    <span className="eyebrow">YOUR DATA</span>
                    <h2 id="backup-title">Backup and restore</h2>
                    <p>Save your practice history, notes, current session, categories, and profile photo in a backup file.</p>
                </div>
                <div className="profile-backup-actions">
                    <button className="primary-button" type="button" onClick={exportBackup}>Download backup</button>
                    <input
                        ref={backupInputRef}
                        className="profile-backup-input"
                        type="file"
                        accept="application/json,.json"
                        aria-label="Choose a Voice Up backup file"
                        onChange={(event) => void selectBackup(event)}
                    />
                    <button className="secondary-button" type="button" onClick={() => backupInputRef.current?.click()}>Restore backup</button>
                </div>
                {backupError && <p className="profile-backup-feedback profile-backup-error" role="alert">{backupError}</p>}
                {backupMessage && <p className="profile-backup-feedback" role="status">{backupMessage}</p>}
            </section>
            <Link className="profile-about-link" to="/about">About Voice Up <span aria-hidden="true">→</span></Link>
            <dialog
                ref={restoreDialogRef}
                className="backup-restore-dialog"
                aria-labelledby="backup-restore-title"
                aria-describedby="backup-restore-description"
                onClose={() => {
                    setRestoreCandidate(null)
                    setRestoreSummary(null)
                    setRestorePhotoConsent(false)
                }}
            >
                <span className="eyebrow">VOICE UP / RESTORE</span>
                <h2 id="backup-restore-title">Replace saved data?</h2>
                {restoreSummary && (
                    <p id="backup-restore-description">
                        This backup contains {restoreSummary.sessions} {restoreSummary.sessions === 1 ? 'practice session' : 'practice sessions'} and {restoreSummary.notes} {restoreSummary.notes === 1 ? 'note' : 'notes'}.
                        {restoreSummary.hasProfilePicture ? ' It also includes a profile photo.' : ''} Restoring replaces your current saved data.
                    </p>
                )}
                {restoreSummary?.hasProfilePicture && (
                    <>
                        <p className="backup-photo-disclosure">The profile photo in this backup will be sent to Google Cloud Vision for an appropriateness check before any backup data is restored.</p>
                        <label className="profile-photo-consent">
                            <input type="checkbox" checked={restorePhotoConsent} onChange={(event) => setRestorePhotoConsent(event.target.checked)} disabled={isCheckingPhoto} />
                            <span>I agree to send the backup photo to Google Cloud Vision for review.</span>
                        </label>
                    </>
                )}
                {backupError && <p className="profile-backup-feedback profile-backup-error" role="alert">{backupError}</p>}
                <div className="backup-restore-actions">
                    <button className="secondary-button" type="button" autoFocus disabled={isCheckingPhoto} onClick={() => restoreDialogRef.current?.close()}>Cancel</button>
                    <button className="primary-button" type="button" disabled={isCheckingPhoto || (restoreSummary?.hasProfilePicture && !restorePhotoConsent)} onClick={() => void confirmRestore()}>{isCheckingPhoto ? 'Checking photo…' : 'Replace and restore'}</button>
                </div>
            </dialog>
        </main>
    )
}