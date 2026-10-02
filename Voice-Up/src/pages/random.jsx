import { useLocation } from 'react-router'
import PracticePage from './practice'

export default function RandomPage() {
  const { pathname } = useLocation()
  const view = pathname.endsWith('/preview') ? 'preview' : pathname.endsWith('/session') ? 'session' : 'setup'
  return <PracticePage mode="random" view={view} />
}