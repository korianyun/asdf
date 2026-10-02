import { useLocation } from 'react-router'
import PracticePage from './practice'

export default function NewPage() {
  const { pathname } = useLocation()
  const view = pathname.endsWith('/setup') ? 'setup' : pathname.endsWith('/preview') ? 'preview' : pathname.endsWith('/session') ? 'session' : pathname.endsWith('/resume') ? 'resume' : 'home'
  return <PracticePage mode="new" view={view} />
}