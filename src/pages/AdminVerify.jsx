import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_ONLY_NAMES = {
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
  const [employeeDirectory, setEmployeeDirectory] = useState({})
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true)

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    const ADMIN_UUIDS = (import.meta.env.VITE_ADMIN_UUID || 'f32927f5-b616-44a3-88f5-5085fa951731,85975a3c-e601-4c66-bed1-42ad6e953873')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
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
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  async function loadEmployeeDirectory(){
    setIsLoadingDirectory(true)
    try{
      const resp = await fetch('/api/list-employees')
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok) throw new Error(json?.error || 'فشل جلب معلومات الموظفين')
      const map = {}
      ;(json.employees||[]).forEach(emp => {
        map[emp.id] = emp
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

  async function approveReturnItem(item){
    const { error } = await supabase
      .from('transaction_items')
      .update({ admin_verified: true })
      .eq('id', item.id)
    if(error){
      const detail = error?.message || ''
      const hint = detail.includes('column') && detail.includes('admin_verified')
        ? 'يبدو أن عمود admin_verified غير موجود. أضف العمود في Supabase: ALTER TABLE public.transaction_items ADD COLUMN admin_verified boolean NOT NULL DEFAULT false;'
        : ''
      setMsg(`فشل التحقق من العنصر${detail ? `: ${detail}` : ''}${hint ? ` — ${hint}` : ''}`)
      return
    }
    setMsg('تم التحقق من العنصر')
    await fetchAll()
  }

  async function finalizeTransactionIfAllVerified(t){
    const items = t.transaction_items || []
    const allVerified = items.length>0 && items.every(it => it.admin_verified)
    if(!allVerified){ setMsg('هناك عناصر لم يتم التحقق منها بعد'); return }
    if(t.status !== 'open'){ setMsg('العهدة ليست قيد الانتظار للإغلاق'); return }
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'closed', return_time: new Date().toISOString() })
      .eq('id', t.id)
    if(error){ setMsg('فشل إغلاق العهدة'); return }
    setMsg('تم إغلاق العهدة بعد التحقق')
    await fetchAll()
  }

  const visibleTx = useMemo(()=>{
    if(!showOnlyPending) return tx
    return (tx||[]).filter(t => t.status==='open' && (t.transaction_items||[]).some(it=>!it.admin_verified))
  }, [tx, showOnlyPending])

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>التحقق من العهدة</h1>
        <p>راجع العهدة المُعادة، ووافق على العناصر المستلمة، ثم أغلق المهمة عند اكتمالها.</p>
        <label style={{display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.18)', padding:'10px 16px', borderRadius:12}}>
          <input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)} />
          <span>عرض العهد التي تحتاج للتحقق فقط</span>
        </label>
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
                  <span className="chip">الموظف المسؤول: {employeeNameFor(t.user_id)}</span>
                  {t.assistant_user_id && (
                    <span className="chip">المساعد: {employeeNameFor(t.assistant_user_id)}</span>
                  )}
                </header>

                <div className="project-timestamps">
                  <div>وقت الاستلام: {formatDateTime(t.checkout_time)}</div>
                  <div>وقت التصوير: {formatDateTime(t.shoot_time)}</div>
                  <div>وقت الإرجاع: {formatDateTime(t.return_time)}</div>
                </div>

                <div className="equipment-items" style={{marginTop:14}}>
                  {(t.transaction_items||[]).map(it=> (
                    <div key={it.id} className="equipment-row" style={{flexWrap:'wrap'}}>
                      <div style={{flex:1, fontWeight:600}}>{(it.equipment && it.equipment.name) || it.equipment_id}</div>
                      <span className="chip">كمية: {it.qty}</span>
                      <span className="chip">الحالة: {it.admin_verified ? 'تم التحقق' : 'بانتظار'}</span>
                      {!it.admin_verified && (
                        <button type="button" className="btn-primary" style={{padding:'8px 14px'}} onClick={()=>approveReturnItem(it)}>تمييز كمستلم</button>
                      )}
                    </div>
                  ))}
                </div>

                {t.status==='open' && (
                  <footer>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={()=>finalizeTransactionIfAllVerified(t)}
                      disabled={(t.transaction_items||[]).some(it=>!it.admin_verified)}
                    >إغلاق العهدة بعد التحقق</button>
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
