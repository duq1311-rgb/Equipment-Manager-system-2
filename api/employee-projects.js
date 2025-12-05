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

  const { userId } = req.query || {}
  if(!userId) return res.status(400).json({ error: 'userId parameter is required' })

  try{
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, transaction_items(*, equipment(name)), transaction_assistants(assistant_user_id)')
      .or(`user_id.eq.${userId},transaction_assistants.assistant_user_id.eq.${userId},assistant_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if(error) throw error

    const projects = (data || []).map(project => {
      const assistantIds = []
      if(project.assistant_user_id) assistantIds.push(project.assistant_user_id)
      if(Array.isArray(project.transaction_assistants)){
        project.transaction_assistants.forEach(link => {
          if(link?.assistant_user_id) assistantIds.push(link.assistant_user_id)
        })
      }
      const uniqueAssistants = Array.from(new Set(assistantIds))
      const assignmentRole = project.user_id === userId ? 'owner' : uniqueAssistants.includes(userId) ? 'assistant' : 'other'
      return {
        ...project,
        assistants: uniqueAssistants,
        assignment_role: assignmentRole
      }
    })

    res.status(200).json({ projects })
  }catch(error){
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}
