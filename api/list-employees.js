import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

// Admin-only users (hidden from employees list)
const ADMIN_ONLY_UUIDS = (process.env.ADMIN_ONLY_UUIDS || '85975a3c-e601-4c66-bed1-42ad6e953873,7058bd02-a5bc-4c1e-a935-0b28c2c31976')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean)
const ADMIN_ONLY_SET = new Set(ADMIN_ONLY_UUIDS)

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }

  try{
    const [
      { data: profiles, error: profilesError },
      { data: transactions, error: txError },
      { data: assistantLinks, error: assistantsError }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name'),
      supabaseAdmin.from('transactions').select('id, user_id, assistant_user_id'),
      supabaseAdmin.from('transaction_assistants').select('transaction_id, assistant_user_id')
    ])

    if(profilesError) throw profilesError
    if(txError) throw txError
    if(assistantsError) throw assistantsError

    const authUsers = await fetchAllUsers()

    const countMap = {}
      function increment(id){
        if(!id) return
        countMap[id] = (countMap[id] || 0) + 1
      }

      const assistantsByTransaction = new Map()

      ;(assistantLinks || []).forEach(link => {
        if(!link.transaction_id || !link.assistant_user_id) return
        const set = assistantsByTransaction.get(link.transaction_id) || new Set()
        if(!set.has(link.assistant_user_id)){
          set.add(link.assistant_user_id)
          increment(link.assistant_user_id)
        }
        assistantsByTransaction.set(link.transaction_id, set)
      })

      ;(transactions || []).forEach(row => {
        increment(row.user_id)
        const assistantsForTransaction = assistantsByTransaction.get(row.id)
        if((!assistantsForTransaction || assistantsForTransaction.size === 0) && row.assistant_user_id){
          increment(row.assistant_user_id)
        }
      })

  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || '']))

    const employeeMap = new Map()

    authUsers.forEach(user => {
      employeeMap.set(user.id, {
        id: user.id,
        email: user.email || '',
        name: profileMap.get(user.id) || user.user_metadata?.full_name || user.email || user.id,
        projectsCount: countMap[user.id] || 0,
      })
    })

    profileMap.forEach((fullName, id) => {
      if(employeeMap.has(id)) return
      employeeMap.set(id, {
        id,
        email: '',
        name: fullName || id,
        projectsCount: countMap[id] || 0,
      })
    })

    Object.entries(countMap).forEach(([id, projectsCount]) => {
      if(employeeMap.has(id)){
        employeeMap.get(id).projectsCount = projectsCount
        return
      }
      employeeMap.set(id, {
        id,
        email: '',
        name: id,
        projectsCount,
      })
    })

    // Ensure specific admin users are included in employees list
    const FORCE_INCLUDE_EMPLOYEES = ['f32927f5-b616-44a3-88f5-5085fa951731']
    const debugForceIncluded = []
    FORCE_INCLUDE_EMPLOYEES.forEach(userId => {
      if(!employeeMap.has(userId) && !ADMIN_ONLY_SET.has(userId)){
        const profile = profileMap.get(userId)
        if(profile){
          employeeMap.set(userId, {
            id: userId,
            email: '',
            name: profile,
            projectsCount: countMap[userId] || 0,
          })
          debugForceIncluded.push(userId)
        }
      }
    })

    const employees = Array.from(employeeMap.values())
      .filter(emp => !ADMIN_ONLY_SET.has(emp.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }))

    const debugPayload = {
      totalEmployees: employees.length,
      adminOnlyCount: ADMIN_ONLY_SET.size,
      forceIncludeCandidates: FORCE_INCLUDE_EMPLOYEES,
      forceIncludeHit: debugForceIncluded,
      fetchedUsers: authUsers?.length || 0,
      profileCount: profileMap.size
    }

    console.log('[list-employees]', debugPayload)

    res.status(200).json({ employees, debug: debugPayload })
  }catch(error){
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}

async function fetchAllUsers(){
  const perPage = 200
  let page = 1
  const users = []
  while(true){
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if(error) throw error
    const chunk = data?.users || []
    users.push(...chunk)
    if(!chunk.length || chunk.length < perPage) break
    page += 1
  }
  return users
}
