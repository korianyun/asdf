import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleAuth } from 'google-auth-library'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.join(root, 'dist')
const apiOnly = process.argv.includes('--api-only')
const port = Number(process.env.API_PORT || (apiOnly ? 3001 : process.env.PORT || 3000))
const host = apiOnly ? '127.0.0.1' : process.env.HOST || '0.0.0.0'
const maxRequestBytes = 4_300_000
const maxImageBytes = 3 * 1024 * 1024
const rateLimitWindowMs = 10 * 60 * 1000
const rateLimitMaxRequests = 10
const requestsByAddress = new Map()
const googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
const riskLevels = new Map([
  ['VERY_UNLIKELY', 0],
  ['UNLIKELY', 1],
  ['POSSIBLE', 2],
  ['LIKELY', 3],
  ['VERY_LIKELY', 4],
])

function jsonResponse(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin || !request.headers.host) return false
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function checkRateLimit(request) {
  const now = Date.now()
  const address = request.socket.remoteAddress || 'unknown'
  const previous = requestsByAddress.get(address)
  if (!previous || now - previous.startedAt >= rateLimitWindowMs) {
    requestsByAddress.set(address, { startedAt: now, count: 1 })
    return true
  }
  previous.count += 1
  if (requestsByAddress.size > 1000) {
    for (const [key, entry] of requestsByAddress) {
      if (now - entry.startedAt >= rateLimitWindowMs) requestsByAddress.delete(key)
    }
  }
  return previous.count <= rateLimitMaxRequests
}

function decodeImage(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match) return null

  const [, mimeSubtype, encoded] = match
  const content = Buffer.from(encoded, 'base64')
  if (!content.length || content.length > maxImageBytes || content.toString('base64') !== encoded) return null

  const isJpeg = mimeSubtype === 'jpeg' && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
  const isPng = mimeSubtype === 'png' && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isWebp = mimeSubtype === 'webp'
    && content.toString('ascii', 0, 4) === 'RIFF'
    && content.toString('ascii', 8, 12) === 'WEBP'
  if (!isJpeg && !isPng && !isWebp) return null

  return encoded
}

async function readJsonBody(request, response) {
  const length = Number(request.headers['content-length'] || 0)
  if (length > maxRequestBytes) {
    jsonResponse(response, 413, { message: 'Choose an image under 3 MB.' })
    return null
  }

  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > maxRequestBytes) {
      jsonResponse(response, 413, { message: 'Choose an image under 3 MB.' })
      return null
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

async function moderateImage(request, response) {
  if (request.method !== 'POST') {
    jsonResponse(response, 405, { message: 'Use POST to check a profile photo.' })
    return
  }
  if (!isSameOrigin(request)) {
    jsonResponse(response, 403, { message: 'This photo check must come from the Voice Up site.' })
    return
  }
  if (!checkRateLimit(request)) {
    jsonResponse(response, 429, { message: 'Too many photo checks. Please try again later.' })
    return
  }
  if (!request.headers['content-type']?.startsWith('application/json')) {
    jsonResponse(response, 415, { message: 'The photo check request must be JSON.' })
    return
  }

  const body = await readJsonBody(request, response)
  if (body === null) {
    if (!response.headersSent) jsonResponse(response, 400, { message: 'The photo check request was invalid.' })
    return
  }

  const content = decodeImage(body.image)
  if (!content) {
    jsonResponse(response, 400, { message: 'Choose a valid JPEG, PNG, or WebP image under 3 MB.' })
    return
  }

  let accessToken
  try {
    const authClient = await googleAuth.getClient()
    accessToken = await authClient.getAccessToken()
  } catch (error) {
    console.error(`Google Cloud Vision credentials are unavailable: ${error.message}`)
    jsonResponse(response, 503, { message: 'Photo checking is not configured on this server yet.' })
    return
  }
  if (!accessToken.token) {
    jsonResponse(response, 503, { message: 'Photo checking is not configured on this server yet.' })
    return
  }

  try {
    const visionResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
        ...(process.env.GOOGLE_CLOUD_QUOTA_PROJECT
          ? { 'x-goog-user-project': process.env.GOOGLE_CLOUD_QUOTA_PROJECT }
          : {}),
      },
      body: JSON.stringify({
        requests: [{
          image: { content },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!visionResponse.ok) {
      console.error(`Google Cloud Vision photo check failed with status ${visionResponse.status}.`)
      jsonResponse(response, 502, { message: 'Photo moderation is temporarily unavailable. Try again later.' })
      return
    }

    const result = await visionResponse.json()
    const safeSearch = result.responses?.[0]?.safeSearchAnnotation
    const categories = ['adult', 'racy', 'violence']
    const verified = safeSearch && categories.every((category) => riskLevels.has(safeSearch[category]))
    if (!verified) {
      jsonResponse(response, 502, { message: 'The photo could not be verified. Choose another photo and try again.' })
      return
    }

    const flagged = categories.some((category) => riskLevels.get(safeSearch[category]) >= riskLevels.get('POSSIBLE'))
    jsonResponse(response, 200, {
      safe: !flagged,
      message: flagged ? 'This photo did not pass the appropriateness check. Choose another photo.' : 'This photo passed the appropriateness check.',
    })
  } catch (error) {
    console.error(`Google Cloud Vision photo check failed: ${error.message}`)
    jsonResponse(response, 502, { message: 'Photo moderation is temporarily unavailable. Try again later.' })
  }
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

async function serveStatic(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405)
    response.end('Method not allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    response.writeHead(400)
    response.end('Invalid URL')
    return
  }

  const requestedPath = path.resolve(distDirectory, `.${pathname}`)
  let filePath = requestedPath.startsWith(`${distDirectory}${path.sep}`) ? requestedPath : ''
  try {
    if (!filePath || !(await stat(filePath)).isFile()) filePath = ''
  } catch {
    filePath = ''
  }
  if (!filePath) filePath = path.join(distDirectory, 'index.html')

  try {
    const content = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(503)
      response.end('Build the app before starting the production server.')
      return
    }
    console.error(`Static file could not be served: ${error.message}`)
    response.writeHead(500)
    response.end('The app could not be served.')
  }
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname === '/api/moderate-image') {
    void moderateImage(request, response)
    return
  }
  if (pathname.startsWith('/api/')) {
    jsonResponse(response, 404, { message: 'API route not found.' })
    return
  }
  if (apiOnly) {
    response.writeHead(404)
    response.end('Not found')
    return
  }
  void serveStatic(request, response)
})

server.listen(port, host, () => {
  console.log(apiOnly ? `Voice Up photo moderation API listening on http://${host}:${port}` : `Voice Up listening on http://${host}:${port}`)
})
