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

  try{
    const [{ data: profiles, error: profilesError }, { data: transactions, error: txError }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name'),
      supabaseAdmin.from('transactions').select('user_id, project_owner')
    ])

    if(profilesError) throw profilesError
    if(txError) throw txError

    const authUsers = await fetchAllUsers()

    const countMap = {}
    const ownerCountMap = new Map()
    ;(transactions || []).forEach(row => {
      const ownerName = (row.project_owner || '').trim()
      if(row.user_id){
        countMap[row.user_id] = (countMap[row.user_id] || 0) + 1
        return
      }
      if(!ownerName) return
      const key = ownerName.toLowerCase()
      const current = ownerCountMap.get(key) || { name: ownerName, count: 0 }
      current.count += 1
      ownerCountMap.set(key, current)
    })

  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || '']))

    const employeeMap = new Map()

    authUsers.forEach(user => {
      employeeMap.set(user.id, {
        id: user.id,
        email: user.email || '',
        name: profileMap.get(user.id) || user.user_metadata?.full_name || user.email || user.id,
        projectsCount: countMap[user.id] || 0,
        lookupType: 'user',
        lookupValue: user.id,
      })
    })

    profileMap.forEach((fullName, id) => {
      if(employeeMap.has(id)) return
      employeeMap.set(id, {
        id,
        email: '',
        name: fullName || id,
        projectsCount: countMap[id] || 0,
        lookupType: 'user',
        lookupValue: id,
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
        lookupType: 'user',
        lookupValue: id,
      })
    })

    const employees = Array.from(employeeMap.values())
    const existingNames = new Set(employees.map(emp => (emp.name || '').toLowerCase()))

    ownerCountMap.forEach(({ name, count }, key) => {
      if(existingNames.has(key)) return
      employees.push({
        id: `owner::${key}`,
        email: '',
        name,
        projectsCount: count,
        lookupType: 'owner',
        lookupValue: name,
      })
    })

    employees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }))

    res.status(200).json({ employees })
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
