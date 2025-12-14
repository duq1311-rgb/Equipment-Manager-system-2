import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY) ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }
  // Prevent stale cache in clients
  res.set('Cache-Control', 'no-store')
  try{
    // List users via Admin API (first page)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()
    if(error) return res.status(400).json({ error: error.message })
    // Optionally enrich with profiles
    const ids = (data?.users||[]).map(u=>u.id)
    let profiles = []
    if(ids.length){
      const { data: profs } = await supabaseAdmin.from('profiles').select('*').in('id', ids)
      profiles = profs || []
    }
    const profMap = new Map(profiles.map(p=>[p.id, p]))
    const users = (data?.users||[]).map(u=>({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || (profMap.get(u.id)?.is_admin ? 'admin' : 'employee'),
      is_admin: !!(profMap.get(u.id)?.is_admin)
    }))
    res.status(200).json({ users })
  }catch(e){
    res.status(500).json({ error: e.message || 'Unknown error' })
  }
}
