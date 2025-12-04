import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY) ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin) return res.status(500).json({ error: 'Server not configured' })
  const { userId } = req.body || {}
  if(!userId) return res.status(400).json({ error: 'userId required' })
  try{
    // Delete user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if(error) return res.status(400).json({ error: error.message })
    // Optionally clean profile
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    res.status(200).json({ ok: true })
  }catch(e){
    res.status(500).json({ error: e.message || 'Unknown error' })
  }
}
