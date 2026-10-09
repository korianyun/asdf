import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const children = [
  spawn(process.execPath, ['server.js', '--api-only'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' }),
]
let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM')
  })
  process.exitCode = exitCode
}

children.forEach((child) => {
  child.on('error', (error) => {
    console.error(`Development server could not start: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code || (signal ? 1 : 0))
  })
})

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
