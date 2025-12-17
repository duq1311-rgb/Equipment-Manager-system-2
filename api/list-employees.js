import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

// كاش خفيف لمدة 5 دقائق لتقليل زمن تحميل الموظفين
const CACHE_TTL_MS = 5 * 60 * 1000
const employeeCache = { data: null, expiresAt: 0 }

// الأدمن (مشاهدة فقط - مخفي من قائمة الموظفين)
const READ_ONLY_ADMIN_UUIDS = [
  '6992bff2-1fbe-4991-84f3-9da4dcca9434',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976'
]

// المشرفين (يظهرون في قائمة الموظفين ولديهم كل الصلاحيات)
const SUPERVISOR_UUIDS = [
  'f32927f5-b616-44a3-88f5-5085fa951731', // عبدالعزيز الغامدي
  '85975a3c-e601-4c66-bed1-42ad6e953873'  // تركي العسبلي
]

// المستخدمون المخفيون من قائمة الموظفين (الأدمن فقط)
// استخدام READ_ONLY_ADMIN_UUIDS مباشرة بدلاً من env لضمان الإخفاء
const ADMIN_ONLY_SET = new Set(READ_ONLY_ADMIN_UUIDS)

// التأكد من ظهور المشرفين دائماً في قائمة الموظفين
SUPERVISOR_UUIDS.forEach(id => ADMIN_ONLY_SET.delete(id))

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }

  const forceRefresh = req.query?.refresh === 'true'
  const now = Date.now()
  // Ensure clients don't cache this response at the browser level
  res.set('Cache-Control', 'no-store')
  if(!forceRefresh && employeeCache.data && employeeCache.expiresAt > now){
    const remaining = employeeCache.expiresAt - now
    const debug = { ...employeeCache.data.debug, fromCache: true, ttlMs: remaining, expiresAt: employeeCache.expiresAt, forceRefresh }
    console.log('[list-employees] cache hit', { ttlMs: remaining, expiresAt: employeeCache.expiresAt, forceRefresh })
    return res.status(200).json({ employees: employeeCache.data.employees, debug })
  }

  try{
    console.log('[list-employees] START - Loading profiles, transactions, assistants')
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

    console.log('[list-employees] Fetched:', { profilesCount: profiles?.length, txCount: transactions?.length })
    const authUsers = await fetchAllUsers()
    console.log('[list-employees] Auth users count:', authUsers?.length)

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

    // عرض جميع الموظفين بدون فلترة
    const employees = Array.from(employeeMap.values())
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }))

    const debugPayload = {
      totalEmployees: employees.length,
      allEmployeeIds: employees.map(emp => emp.id)
    }

    const debugWithMeta = {
      ...debugPayload,
      fromCache: false,
      forceRefresh,
      cachedAt: now,
      ttlMs: CACHE_TTL_MS,
      expiresAt: now + CACHE_TTL_MS
    }

    employeeCache.data = { employees, debug: debugWithMeta }
    employeeCache.expiresAt = now + CACHE_TTL_MS

    console.log('[list-employees]', debugWithMeta)

    res.status(200).json({ employees, debug: debugWithMeta })
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
