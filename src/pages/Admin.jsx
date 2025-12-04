import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
  }
}

export default function Admin(){
  const [tx, setTx] = useState([])
  const [msg, setMsg] = useState('')
  const [showOnlyPending, setShowOnlyPending] = useState(true)

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    // حماية صفحة الأدمن عبر UUID
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    const ADMIN_UUID = import.meta.env.VITE_ADMIN_UUID
    if(!user || !ADMIN_UUID || user.id !== ADMIN_UUID){
      setMsg('ليست لديك صلاحية الدخول إلى لوحة المشرف')
      // إعادة توجيه سريع إلى الصفحة الرئيسية
      setTimeout(()=>{ window.location.href = '/' }, 1200)
      return
    }
    await fetchAll()
  }

  async function fetchAll(){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  async function approveReturnItem(item){
    // وضع علامة تحقق من الأدمن على عنصر مُعاد
    const { error } = await supabase
      .from('transaction_items')
      .update({ admin_verified: true })
      .eq('id', item.id)
    if(error){ setMsg('فشل التحقق من العنصر'); return }
    setMsg('تم التحقق من العنصر')
    await fetchAll()
  }

  async function finalizeTransactionIfAllVerified(t){
    // إذا كانت كل عناصر الطلب مُعادَة ومتحقَّق منها، اغلق العهدة
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
    // عرض العهد قيد التحقق فقط: فيها عناصر غير مُتحقّق منها وحالة العهدة مفتوحة
    return (tx||[]).filter(t => t.status==='open' && (t.transaction_items||[]).some(it=>!it.admin_verified))
  }, [tx, showOnlyPending])

  return (
    <div>
      <h2>لوحة المشرف</h2>
      <p>إدارة الإرجاعات والتحقق:</p>
      <div style={{marginBottom:8}}>
        <label>
          <input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)} />
          عرض “العهد قيد التحقق” فقط
        </label>
      </div>
      {msg && <div style={{color:'green'}}>{msg}</div>}
      <ul>
        {visibleTx.map(t=> (
          <li key={t.id} style={{marginBottom:10}}>
            <div>
              <strong>{t.project_name}</strong> — {t.project_owner} — {statusArabic(t.status)}
            </div>
            <ul>
              {(t.transaction_items||[]).map(it=> (
                <li key={it.id}>
                  {(it.equipment && it.equipment.name) || it.equipment_id} — كمية: {it.qty}
                  {/* عناصر الإرجاع تحتاج تحقق الأدمن */}
                  <div style={{display:'inline-block', marginInlineStart:8}}>
                    حالة التحقق: {it.admin_verified ? 'تم التحقق' : 'بانتظار التحقق'}
                    {!it.admin_verified && (
                      <button style={{marginInlineStart:8}} onClick={()=>approveReturnItem(it)}>تحقق من العنصر</button>
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
