import { useState } from 'react'
import { Link } from 'react-router'

export default function ProfilePage() {
    const [picture, setPicture] = useState(() => {
        try {
            return localStorage.getItem('voice-up-profile-picture') || ''
        } catch {
            return ''
        }
    })
    const [pictureError, setPictureError] = useState('')

    function changePicture(event) {
        const file = event.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setPictureError('Choose an image file to update your picture.')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            setPictureError('Choose an image under 3 MB.')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            try {
                const image = String(reader.result)
                localStorage.setItem('voice-up-profile-picture', image)
                setPicture(image)
                setPictureError('')
            } catch {
                setPictureError('This image could not be saved in this browser.')
            }
        }
        reader.readAsDataURL(file)
        event.target.value = ''
    }

    return (
        <main className="practice-page profile-page">
            <section className="profile-card">
                <div className="profile-picture-wrap">
                    <div className="profile-picture">
                        {picture ? <img src={picture} alt="Your profile" /> : <span>PROFILE</span>}
                    </div>
                    <input id="profile-picture-input" className="profile-picture-input" type="file" accept="image/*" onChange={changePicture} />
                    <label className="profile-picture-picker" htmlFor="profile-picture-input">Change photo</label>
                </div>
                <div className="profile-account-details">
                    <div><span>Account made</span><strong>__________</strong></div>
                    <div><span>Email</span><strong>_________</strong></div>
                    <div><span>Password</span><strong>**********</strong></div>
                </div>
                {pictureError && <p className="profile-picture-error" role="status">{pictureError}</p>}
            </section>
            <Link className="profile-about-link" to="/about">About Voice Up <span aria-hidden="true">→</span></Link>
        </main>
    )
}