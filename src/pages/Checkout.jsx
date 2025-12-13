import React, { useEffect, useState } from 'react'
import EquipmentSelector from '../components/EquipmentSelector'
import { supabase } from '../lib/supabase'

export default function Checkout(){
  const [projectName, setProjectName] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [checkoutTime, setCheckoutTime] = useState('')
  const [shootTime, setShootTime] = useState('')
  const [assistants, setAssistants] = useState([''])
  const [employees, setEmployees] = useState([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [selected, setSelected] = useState([])
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingSummary, setPendingSummary] = useState(null)

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

  function formatDateTimeDisplay(value){
    if(!value) return '—'
    try{
      return new Date(value).toLocaleString('en-US', { hour12: false })
    }catch(_){
      return value
    }
  }

  function resolveAssistantName(id){
    if(!id) return ''
    const assistant = employees.find(emp => emp.id === id)
    return assistant ? (assistant.name || assistant.email || assistant.id) : id
  }

  function handleAssistantChange(index, value){
    setAssistants(prev => prev.map((id, i) => i === index ? value : id))
  }

  function addAssistantField(){
    setAssistants(prev => [...prev, ''])
  }

  function removeAssistantField(index){
    setAssistants(prev => prev.filter((_, i) => i !== index))
  }

  function validateForm(){
    if(selected.length===0){ setMsg('اختر معدات على الاقل'); return false }
    const invalid = selected.find(it => Number(it.selectedQty)>Number(it.available_qty))
    if(invalid){ setMsg(`لا يمكن اختيار كمية أكبر من المتاح للمعدة: ${invalid.name}`); return false }
    const chosenAssistants = assistants.map(a => (a || '').trim()).filter(Boolean)
    const uniqueAssistants = Array.from(new Set(chosenAssistants))
    if(chosenAssistants.length !== uniqueAssistants.length){
      setMsg('لا يمكن اختيار نفس المساعد أكثر من مرة')
      return false
    }
    return true
  }

  function handleSubmit(e){
    e.preventDefault()
    setMsg('')
    if(!validateForm()) return

    const checkoutIso = checkoutTime || new Date().toISOString()
    const shootIso = shootTime || null
    const assistantEntries = Array.from(new Set(assistants.map(a => (a || '').trim()))).filter(Boolean).map(id => ({
      id,
      name: resolveAssistantName(id)
    }))
    const summaryItems = selected.map(it => ({
      id: it.id,
      name: it.name,
      selectedQty: it.selectedQty,
      available_qty: it.available_qty
    }))

    setPendingSummary({
      projectName,
      projectOwner,
      checkoutIso,
      shootIso,
      assistants: assistantEntries,
      items: summaryItems
    })
    setShowConfirm(true)
  }

  async function handleConfirm(){
    if(!pendingSummary) return
    setSubmitting(true)

    const { data: userRes } = await supabase.auth.getUser()
    const userId = userRes?.user?.id || null
    if(!userId){
      setMsg('يجب تسجيل الدخول قبل إنشاء العهدة')
      setSubmitting(false)
      return
    }

    const { data: tx, error: txErr } = await supabase.from('transactions').insert([{
      project_name: pendingSummary.projectName,
      project_owner: pendingSummary.projectOwner,
      checkout_time: pendingSummary.checkoutIso,
      shoot_time: pendingSummary.shootIso,
      assistant_user_id: pendingSummary.assistants?.[0]?.id || null,
      status: 'open',
      user_id: userId
    }]).select().maybeSingle()

  if(txErr || !tx){
      setMsg('خطأ في انشاء الطلب')
      setSubmitting(false)
      return
    }

    // insert items and decrement available_qty (optimized - batch queries)
    const itemsToInsert = pendingSummary.items.filter(it => it.selectedQty > 0)
    
    if(itemsToInsert.length > 0){
      // جلب جميع المعدات دفعة واحدة
      const equipmentIds = itemsToInsert.map(it => it.id)
      const { data: currentEquipment } = await supabase
        .from('equipment')
        .select('id, available_qty')
        .in('id', equipmentIds)
      
      const equipmentMap = new Map(
        (currentEquipment || []).map(eq => [eq.id, eq.available_qty ?? 0])
      )
      
      // إدراج جميع العناصر دفعة واحدة
      const transactionItems = itemsToInsert.map(it => ({
        transaction_id: tx.id,
        equipment_id: it.id,
        qty: it.selectedQty
      }))
      
      const { error: insertItemsError } = await supabase
        .from('transaction_items')
        .insert(transactionItems)
      
      if(insertItemsError){
        setMsg('خطأ في حفظ المعدات')
        setSubmitting(false)
        return
      }
      
      // تحديث المخزون لكل معدة
      for(const it of itemsToInsert){
        const currentQty = equipmentMap.get(it.id) ?? 0
        const newAvail = Math.max(0, currentQty - it.selectedQty)
        await supabase.from('equipment').update({ available_qty: newAvail }).eq('id', it.id)
      }
    }

    if(pendingSummary.assistants && pendingSummary.assistants.length){
      const assistantRows = pendingSummary.assistants.map(({ id }) => ({ transaction_id: tx.id, assistant_user_id: id }))
      const { error: assistantsError } = await supabase.from('transaction_assistants').insert(assistantRows)
      if(assistantsError){
        setMsg(`تم تسجيل العهدة لكن فشل حفظ المساعدين: ${assistantsError.message}`)
        setSubmitting(false)
        return
      }
    }

    setMsg('✅ تم تسجيل اخذ المعدات')
    setShowConfirm(false)
    setPendingSummary(null)
    // بعد نجاح العملية، حدِّث قائمة المعدات فوراً عبر إعادة الجلب
    setRefreshTick(t => t + 1)
    // reset
    setProjectName(''); setProjectOwner(''); setSelected([]); setAssistants(['']); setCheckoutTime(''); setShootTime('')
    setSubmitting(false)
  }

  function handleCancelConfirm(){
    setShowConfirm(false)
    setPendingSummary(null)
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
            {assistants.map((value, index) => (
              <div key={index} className="assistant-row">
                <select value={value} onChange={e=>handleAssistantChange(index, e.target.value)} disabled={isLoadingEmployees}>
                  <option value="">لا يوجد</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name || emp.email || emp.id}</option>
                  ))}
                </select>
                {index>0 && (
                  <button type="button" className="btn-outline" onClick={()=>removeAssistantField(index)} disabled={isLoadingEmployees}>حذف</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-outline assistant-add" onClick={addAssistantField} disabled={isLoadingEmployees}>إضافة مساعد آخر</button>
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

      {showConfirm && pendingSummary && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>مراجعة تفاصيل العهدة</h3>
            <div className="modal-summary">
              <section>
                <div><strong>اسم المشروع:</strong> {pendingSummary.projectName || '—'}</div>
                <div><strong>صاحب المشروع:</strong> {pendingSummary.projectOwner || '—'}</div>
                <div><strong>وقت الاستلام:</strong> {formatDateTimeDisplay(pendingSummary.checkoutIso)}</div>
                <div><strong>وقت التصوير:</strong> {pendingSummary.shootIso ? formatDateTimeDisplay(pendingSummary.shootIso) : '—'}</div>
                <div><strong>المساعدون:</strong> {pendingSummary.assistants.length ? '' : 'لا يوجد'}</div>
                {pendingSummary.assistants.length > 0 && (
                  <ul style={{margin:'8px 0 0', paddingInlineStart:22}}>
                    {pendingSummary.assistants.map(({id, name}) => (
                      <li key={id}>{name}</li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <strong>المعدات المختارة</strong>
                {pendingSummary.items.length === 0 ? (
                  <p className="empty-state" style={{marginTop:8}}>لا توجد معدات محددة.</p>
                ) : (
                  <ul style={{margin:'8px 0 0', paddingInlineStart:22}}>
                    {pendingSummary.items.map(item => (
                      <li key={item.id}>{item.name} — الكمية: {item.selectedQty}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={handleCancelConfirm} disabled={submitting}>إلغاء</button>
              <button type="button" className="btn-primary" onClick={handleConfirm} disabled={submitting}>تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
