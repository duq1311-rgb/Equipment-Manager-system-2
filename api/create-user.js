import { createClient } from '@supabase/supabase-js'

// Server-side: uses service role key (must be set in Vercel env)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if(!SUPABASE_URL || !SERVICE_ROLE_KEY){
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin user creation')
}

const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null

export default async function handler(req, res){
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try{
    if(!supabaseAdmin){
      res.status(500).json({ error: 'Server not configured with service role' })
      return
    }
    const { email, password, role } = req.body || {}
    if(!email || !password){
      res.status(400).json({ error: 'email and password are required' })
      return
    }
    const isAdmin = role === 'admin'

    // Create user via admin API
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: isAdmin ? 'admin' : 'employee' }
    })
    if(createErr){
      res.status(400).json({ error: createErr.message })
      return
    }

    const userId = created.user?.id

    // Upsert profile with admin flag
    if(userId){
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email,
        is_admin: isAdmin
      }, { onConflict: 'id' })
    }

    res.status(200).json({ ok: true, userId })
  } catch (e){
    res.status(500).json({ error: e.message || 'Unknown error' })
  }
}
