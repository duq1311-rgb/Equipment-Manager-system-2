import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// الأدمن (مشاهدة فقط)
const READ_ONLY_ADMIN_UUIDS = [
  '6992bff2-1fbe-4991-84f3-9da4dcca9434',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976'
]

// المشرفين (كل الصلاحيات)
const SUPERVISOR_UUIDS = [
  'f32927f5-b616-44a3-88f5-5085fa951731', // عبدالعزيز الغامدي
  '85975a3c-e601-4c66-bed1-42ad6e953873'  // تركي العسبلي
]

// جميع من لديهم صلاحية دخول صفحة التحقق
const FALLBACK_ADMIN_UUIDS = [
  ...READ_ONLY_ADMIN_UUIDS,
  ...SUPERVISOR_UUIDS
]

const ADMIN_ONLY_NAMES = {
  '6992bff2-1fbe-4991-84f3-9da4dcca9434': 'مشرف',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976': 'مشرف إضافي',
  'f32927f5-b616-44a3-88f5-5085fa951731': 'عبدالعزيز الغامدي',
  '85975a3c-e601-4c66-bed1-42ad6e953873': 'تركي العسبلي'
}

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
  }
}

function formatDateTime(value){
  if(!value) return '—'
  try{
    return new Date(value).toLocaleString('en-US', { hour12: false })
  }catch(_){
    return value
  }
}

export default function AdminVerify(){
  const [tx, setTx] = useState([])
  const [msg, setMsg] = useState('')
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [employeeDirectory, setEmployeeDirectory] = useState({})
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true)

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    const ADMIN_UUIDS = Array.from(new Set([
      ...String(import.meta.env.VITE_ADMIN_UUID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
      ...FALLBACK_ADMIN_UUIDS
    ]))
    if(!user || ADMIN_UUIDS.length===0 || !ADMIN_UUIDS.includes(user.id)){
      setMsg('ليست لديك صلاحية الدخول إلى صفحة التحقق')
      setTimeout(()=>{ window.location.href = '/' }, 1200)
      return
    }
    await Promise.all([loadEmployeeDirectory(), fetchAll()])
  }

  async function fetchAll(){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name)), transaction_assistants(assistant_user_id)')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  async function loadEmployeeDirectory(){
    setIsLoadingDirectory(true)
    try{
      // قراءة الموظفين مباشرة من Supabase
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name')
      
      if(error) throw error

      const map = {}
      ;(profiles || []).forEach(profile => {
        map[profile.id] = {
          id: profile.id,
          name: profile.full_name || profile.id,
          email: '',
          projectsCount: 0
        }
      })
      
      Object.entries(ADMIN_ONLY_NAMES).forEach(([id, name]) => {
        if(!map[id]){
          map[id] = { id, name, email: '', projectsCount: 0 }
        }
      })
      setEmployeeDirectory(map)
    }catch(error){
      setMsg(`تعذّر تحميل أسماء الموظفين: ${error.message}`)
      setEmployeeDirectory({})
    }finally{
      setIsLoadingDirectory(false)
    }
  }

  function employeeNameFor(userId){
    if(!userId) return '—'
    if(ADMIN_ONLY_NAMES[userId]) return ADMIN_ONLY_NAMES[userId]
    const emp = employeeDirectory[userId]
    return emp?.name || emp?.email || userId
  }

  async function verifyAndCloseTransaction(t){
    if(!t || t.status !== 'open'){
      setMsg('العهدة ليست قيد الانتظار للإغلاق')
      return
    }
    
    setMsg('جاري التحقق وإغلاق العهدة...')
    
    try{
      const items = t.transaction_items || []
      
      // تمييز جميع العناصر كمستلمة
      for(const item of items){
        await supabase
          .from('transaction_items')
          .update({ admin_verified: true })
          .eq('id', item.id)
      }
      
      // إغلاق العهدة
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'closed', return_time: new Date().toISOString() })
        .eq('id', t.id)
      
      if(error){
        setMsg('فشل إغلاق العهدة')
        return
      }
      
      setMsg('✅ تم التحقق وإغلاق العهدة بنجاح')
      await fetchAll()
    }catch(error){
      setMsg(`خطأ: ${error.message}`)
    }
  }

  const visibleTx = useMemo(()=>{
    const term = (searchTerm || '').toLowerCase().trim()

    const matchesTerm = (t) => {
      if(!term) return true
      const owner = (t.project_owner || '').toLowerCase()
      const project = (t.project_name || '').toLowerCase()
      const employee = (employeeNameFor(t.user_id) || '').toLowerCase()
      const assistantsNames = Array.from(new Set([
        ...(t.assistant_user_id ? [t.assistant_user_id] : []),
        ...((t.transaction_assistants || []).map(link => link.assistant_user_id).filter(Boolean))
      ])).map(id => (employeeNameFor(id) || '').toLowerCase())
      return [owner, project, employee, ...assistantsNames].some(text => text.includes(term))
    }

    const needsVerification = (t) => t.status==='open' && (t.transaction_items||[]).some(it=>!it.admin_verified)

    return (tx||[])
      .filter(t => {
        if(showOnlyPending && !needsVerification(t)) return false
        if(statusFilter !== 'all'){
          if(statusFilter === 'pending'){
            if(!needsVerification(t)) return false
          }else if(t.status !== statusFilter){
            return false
          }
        }
        return matchesTerm(t)
      })
  }, [tx, showOnlyPending, statusFilter, searchTerm, employeeDirectory])

  const statusBadgeClass = (t) => {
    const pending = t.status==='open' && (t.transaction_items||[]).some(it=>!it.admin_verified)
    if(t.status === 'closed') return 'chip chip-status-closed'
    if(pending) return 'chip chip-status-pending'
    return 'chip chip-status-open'
  }

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>التحقق من العهدة</h1>
        <p>راجع العهدة المُعادة، ووافق على العناصر المستلمة، ثم أغلق المهمة عند اكتمالها.</p>
        <div style={{display:'grid', gap:10, gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', marginTop:10}}>
          <input
            type="text"
            placeholder="بحث: موظف، مشروع، مالك المشروع"
            value={searchTerm}
            onChange={e=>setSearchTerm(e.target.value)}
            style={{padding:'10px 12px', borderRadius:12, border:'1px solid #e0e0e0'}}
          />
          <select
            value={statusFilter}
            onChange={e=>setStatusFilter(e.target.value)}
            style={{padding:'10px 12px', borderRadius:12, border:'1px solid #e0e0e0'}}
          >
            <option value="all">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="pending">بانتظار التحقق</option>
            <option value="closed">مغلقة</option>
          </select>
          <label style={{display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.18)', padding:'10px 16px', borderRadius:12}}>
            <input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)} />
            <span>عرض العهد التي تحتاج للتحقق فقط</span>
          </label>
        </div>
      </section>

      <section className="page-card">
        <h2>العهد المُعادة</h2>
        {msg && <div className="form-message">{msg}</div>}
        {isLoadingDirectory && <p className="empty-state">جاري تحميل أسماء الموظفين...</p>}
        {visibleTx.length === 0 ? (
          <p className="empty-state">لا توجد عهد قيد المعالجة حالياً.</p>
        ) : (
          <div className="verify-list">
            {visibleTx.map(t=> (
              <div key={t.id} className="verify-item">
                <header>
                  <strong style={{fontSize:'1.1rem'}}>{t.project_name}</strong>
                  <span style={{color:'var(--text-muted)'}}>صاحب المشروع: {t.project_owner || 'غير محدد'}</span>
                  <span className={statusBadgeClass(t)}>
                    {t.status === 'open' && (t.transaction_items||[]).some(it=>!it.admin_verified)
                      ? 'بانتظار التحقق'
                      : statusArabic(t.status)}
                  </span>
                  <span className="chip">الموظف المسؤول: {employeeNameFor(t.user_id)}</span>
                  {Array.from(new Set([
                    ...(t.assistant_user_id ? [t.assistant_user_id] : []),
                    ...((t.transaction_assistants || []).map(link => link.assistant_user_id).filter(Boolean))
                  ])).map(assistantId => (
                    <span key={`${t.id}-${assistantId}`} className="chip">المساعد: {employeeNameFor(assistantId)}</span>
                  ))}
                </header>

                <div className="project-timestamps">
                  <div>وقت الاستلام: {formatDateTime(t.checkout_time)}</div>
                  <div>وقت التصوير: {formatDateTime(t.shoot_time)}</div>
                  <div>وقت الإرجاع: {formatDateTime(t.return_time)}</div>
                </div>

                <div className="equipment-items" style={{marginTop:14}}>
                  {(t.transaction_items||[]).map(it=> (
                    <div key={it.id} className="equipment-row">
                      <div style={{flex:1, fontWeight:600}}>{(it.equipment && it.equipment.name) || it.equipment_id}</div>
                      <span className="chip">كمية: {it.qty}</span>
                    </div>
                  ))}
                </div>

                {t.status==='open' && (
                  <footer>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={()=>verifyAndCloseTransaction(t)}
                    >✅ تم التحقق - إغلاق العهدة</button>
                  </footer>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
