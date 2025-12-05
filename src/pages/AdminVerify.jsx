import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    return new Date(value).toLocaleString('ar-SA', { hour12: false })
  }catch(_){
    return value
  }
}

export default function AdminVerify(){
  const [tx, setTx] = useState([])
  const [msg, setMsg] = useState('')
  const [showOnlyPending, setShowOnlyPending] = useState(true)
  const [employeeDirectory, setEmployeeDirectory] = useState({})
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true)

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    const ADMIN_UUID = import.meta.env.VITE_ADMIN_UUID || 'f32927f5-b616-44a3-88f5-5085fa951731'
    if(!user || !ADMIN_UUID || user.id !== ADMIN_UUID){
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
    <div>
      <h2>التحقق من العهدة المُعادة</h2>
      <div style={{marginBottom:8}}>
        <label>
          <input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)} />
          عرض “العهد قيد التحقق” فقط
        </label>
      </div>
      {isLoadingDirectory && <div style={{color:'#555'}}>جاري تحميل أسماء الموظفين...</div>}
      {msg && <div style={{color:'green'}}>{msg}</div>}
      <ul>
        {visibleTx.map(t=> (
          <li key={t.id} style={{marginBottom:10}}>
            <div>
              <strong>{t.project_name}</strong> — {t.project_owner} — {statusArabic(t.status)}
              <div style={{marginTop:4, color:'#0B3A82'}}>الموظف المسؤول: {employeeNameFor(t.user_id)}</div>
              <div style={{marginTop:4, lineHeight:1.6}}>
                <div>وقت الاستلام: {formatDateTime(t.checkout_time)}</div>
                <div>وقت التصوير: {formatDateTime(t.shoot_time)}</div>
                <div>وقت الإرجاع: {formatDateTime(t.return_time)}</div>
              </div>
            </div>
            <ul>
              {(t.transaction_items||[]).map(it=> (
                <li key={it.id}>
                  {(it.equipment && it.equipment.name) || it.equipment_id} — كمية: {it.qty}
                  <div style={{display:'inline-block', marginInlineStart:8}}>
                    حالة التحقق: {it.admin_verified ? 'تم التحقق' : 'بانتظار التحقق'}
                    {!it.admin_verified && (
                      <button style={{marginInlineStart:8}} onClick={()=>approveReturnItem(it)}>تم التحقق</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {t.status==='open' && (
              <div style={{marginTop:6}}>
                <button
                  onClick={()=>finalizeTransactionIfAllVerified(t)}
                  disabled={(t.transaction_items||[]).some(it=>!it.admin_verified)}
                >إغلاق العهدة بعد التحقق</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
