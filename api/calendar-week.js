import { google } from 'googleapis'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const KEY_BASE64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
const KEY_PLAIN = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
const CACHE_TTL_MS = 10 * 60 * 1000
const cache = { data: null, expiresAt: 0, key: '' }

function loadPrivateKey(){
  if(KEY_BASE64){
    return Buffer.from(KEY_BASE64, 'base64').toString('utf8')
  }
  return (KEY_PLAIN || '').replace(/\\n/g, '\n')
}

function requireEnv(){
  const missing = []
  if(!CALENDAR_ID) missing.push('GOOGLE_CALENDAR_ID')
  if(!SERVICE_EMAIL) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  if(!KEY_BASE64 && !KEY_PLAIN) missing.push('GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_BASE64')
  if(missing.length) throw new Error(`Missing env: ${missing.join(', ')}`)
}

function buildAuth(){
  const key = loadPrivateKey()
  return new google.auth.JWT({
    email: SERVICE_EMAIL,
    key,
    scopes: SCOPES
  })
}

function normalizeDate(dateLike){
  const d = new Date(dateLike || Date.now())
  if(Number.isNaN(d.getTime())) return new Date()
  d.setHours(0,0,0,0)
  return d
}

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try{
    requireEnv()

    const startParam = req.query?.start
    const startDate = normalizeDate(startParam)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    const cacheKey = `${startDate.toISOString()}__${endDate.toISOString()}`
    const now = Date.now()
    if(cache.data && cache.expiresAt > now && cache.key === cacheKey){
      return res.status(200).json({ ...cache.data, debug: { ...cache.data.debug, fromCache: true, ttlMs: cache.expiresAt - now } })
    }

    const auth = buildAuth()
    const calendar = google.calendar({ version: 'v3', auth })

    const { data } = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    const events = (data.items || []).map(ev => {
      const startIso = ev.start?.dateTime || ev.start?.date || null
      const endIso = ev.end?.dateTime || ev.end?.date || null
      const isAllDay = Boolean(ev.start?.date && !ev.start?.dateTime)
      return {
        id: ev.id,
        summary: ev.summary || 'بدون عنوان',
        start: startIso,
        end: endIso,
        isAllDay,
        htmlLink: ev.htmlLink,
        location: ev.location || '',
        status: ev.status,
        creator: ev.creator?.email || ''
      }
    })

    const payload = {
      events,
      debug: {
        count: events.length,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        fromCache: false,
        ttlMs: CACHE_TTL_MS,
        expiresAt: now + CACHE_TTL_MS,
        calendar: CALENDAR_ID ? 'configured' : 'missing'
      }
    }

    cache.data = payload
    cache.expiresAt = now + CACHE_TTL_MS
    cache.key = cacheKey

    res.status(200).json(payload)
  }catch(error){
    res.status(500).json({ error: error.message || 'Calendar fetch failed' })
  }
}
