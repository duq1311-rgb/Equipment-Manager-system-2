import React, { useEffect, useState } from 'react'
import EquipmentSelector from '../components/EquipmentSelector'
import { supabase } from '../lib/supabase'

export default function Checkout(){
  const [projectName, setProjectName] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [checkoutTime, setCheckoutTime] = useState('')
  const [shootTime, setShootTime] = useState('')
  const [assistantId, setAssistantId] = useState('')
  const [employees, setEmployees] = useState([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [selected, setSelected] = useState([])
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(()=>{ fetchEmployees() },[])

  async function fetchEmployees(){
    setIsLoadingEmployees(true)
    try{
      const resp = await fetch('/api/list-employees')
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok) throw new Error(json?.error || 'تعذّر تحميل قائمة الموظفين')
      setEmployees(json.employees || [])
    }catch(error){
      setMsg(error.message)
      setEmployees([])
    }finally{
      setIsLoadingEmployees(false)
    }
  }

  async function handleSubmit(e){
    e.preventDefault()
    if(selected.length===0){ setMsg('اختر معدات على الاقل'); return }
    // block if any qty exceeds available (defensive)
    const invalid = selected.find(it => Number(it.selectedQty)>Number(it.available_qty))
    if(invalid){ setMsg(`لا يمكن اختيار كمية أكبر من المتاح للمعدة: ${invalid.name}`); return }
    setSubmitting(true)

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id || null
    if(!userId){
      setMsg('يجب تسجيل الدخول قبل إنشاء العهدة')
      setSubmitting(false)
      return
    }

    // Create transaction
    const { data: tx, error: txErr } = await supabase.from('transactions').insert([{
      project_name: projectName,
      project_owner: projectOwner,
      checkout_time: checkoutTime || new Date().toISOString(),
      shoot_time: shootTime || null,
      assistant_user_id: assistantId || null,
      status: 'open',
      user_id: userId
    }]).select().maybeSingle()

  if(txErr || !tx){ setMsg('خطأ في انشاء الطلب'); setSubmitting(false); return }

    // insert items and decrement available_qty
    for(const it of selected){
      if(!it.selectedQty) continue
      await supabase.from('transaction_items').insert({
        transaction_id: tx.id,
        equipment_id: it.id,
        qty: it.selectedQty
      })
      // decrement available
      const newAvail = Math.max(0, (it.available_qty || 0) - it.selectedQty)
      await supabase.from('equipment').update({ available_qty: newAvail }).eq('id', it.id)
    }

    setMsg('تم تسجيل اخذ المعدات')
    // بعد نجاح العملية، حدِّث قائمة المعدات فوراً عبر إعادة الجلب
    setRefreshTick(t => t + 1)
    // reset
    setProjectName(''); setProjectOwner(''); setSelected([]); setAssistantId('')
    setSubmitting(false)
  }

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>استلام العهدة</h1>
        <p>أدخل تفاصيل المشروع وحدد المعدات المطلوبة لكل فريق قبل الخروج من المستودع.</p>
      </section>

      <section className="page-card">
        <form className="form-grid two-columns" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>اسم المشروع</label>
            <input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="مشروع التصوير" />
          </div>
          <div className="form-row">
            <label>اسم صاحب المشروع</label>
            <input value={projectOwner} onChange={e=>setProjectOwner(e.target.value)} placeholder="اسم العميل" />
          </div>
          <div className="form-row">
            <label>وقت استلام العهدة</label>
            <input type="datetime-local" value={checkoutTime} onChange={e=>setCheckoutTime(e.target.value)} />
          </div>
          <div className="form-row">
            <label>وقت التصوير (تقديري)</label>
            <input type="datetime-local" value={shootTime} onChange={e=>setShootTime(e.target.value)} />
          </div>
          <div className="form-row">
            <label>المساعد</label>
            <select value={assistantId} onChange={e=>setAssistantId(e.target.value)} disabled={isLoadingEmployees}>
              <option value="">لا يوجد</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name || emp.email || emp.id}</option>
              ))}
            </select>
            {isLoadingEmployees && <small>جاري تحميل الأسماء...</small>}
          </div>

          <div className="form-row full-width">
            <label>المعدات المطلوبة</label>
            <small>اختَر الفئة ثم حدد الكمية لكل معدة قبل الإرسال.</small>
            <EquipmentSelector onChange={setSelected} refreshTick={refreshTick} />
          </div>

          <div className="form-row full-width">
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={submitting}>تأكيد الاستلام</button>
            </div>
          </div>
        </form>
        {msg && <div className="form-message">{msg}</div>}
      </section>
    </div>
  )
}
