import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }

  const { userId, owner } = req.query || {}
  if(!userId && !owner) return res.status(400).json({ error: 'userId or owner parameter is required' })

  try{
    const query = supabaseAdmin
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', { ascending: false })

    if(userId){
      query.eq('user_id', userId)
    }else{
      query.ilike('project_owner', owner)
    }

    const { data, error } = await query

    if(error) throw error

    res.status(200).json({ projects: data || [] })
  }catch(error){
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}
