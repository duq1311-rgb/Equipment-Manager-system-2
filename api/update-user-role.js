import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY) ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin) return res.status(500).json({ error: 'Server not configured' })
  const { userId, role } = req.body || {}
  if(!userId || !role) return res.status(400).json({ error: 'userId and role required' })
  const isAdmin = role === 'admin'
  try{
    // Update metadata
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role }
    })
    if(metaErr) return res.status(400).json({ error: metaErr.message })

    // Upsert profile
    const { error: upErr } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      is_admin: isAdmin
    }, { onConflict: 'id' })
    if(upErr) return res.status(400).json({ error: upErr.message })

    res.status(200).json({ ok: true })
  }catch(e){
    res.status(500).json({ error: e.message || 'Unknown error' })
  }
}
