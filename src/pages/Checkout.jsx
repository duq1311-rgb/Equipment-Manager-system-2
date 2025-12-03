import React, { useState } from 'react'
import EquipmentSelector from '../components/EquipmentSelector'
import { supabase } from '../lib/supabase'

export default function Checkout(){
  const [projectName, setProjectName] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [checkoutTime, setCheckoutTime] = useState('')
  const [shootTime, setShootTime] = useState('')
  const [selected, setSelected] = useState([])
  const [msg, setMsg] = useState('')

  async function handleSubmit(e){
    e.preventDefault()
    if(selected.length===0){ setMsg('اختر معدات على الاقل'); return }

    // Create transaction
    const { data: tx, error: txErr } = await supabase.from('transactions').insert([{
      project_name: projectName,
      project_owner: projectOwner,
      checkout_time: checkoutTime || new Date().toISOString(),
      shoot_time: shootTime || null,
      status: 'open'
    }]).select().maybeSingle()

    if(txErr || !tx){ setMsg('خطأ في انشاء الطلب'); return }

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
    // reset
    setProjectName(''); setProjectOwner(''); setSelected([])
  }

  return (
    <div>
      <h2>اخذ معدات</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>اسم المشروع</label>
          <input value={projectName} onChange={e=>setProjectName(e.target.value)} />
        </div>
        <div>
          <label>اسم صاحب المشروع</label>
          <input value={projectOwner} onChange={e=>setProjectOwner(e.target.value)} />
        </div>
        <div>
          <label>وقت الأخذ</label>
          <input type="datetime-local" value={checkoutTime} onChange={e=>setCheckoutTime(e.target.value)} />
        </div>
        <div>
          <label>وقت التصوير (تقديري)</label>
          <input type="datetime-local" value={shootTime} onChange={e=>setShootTime(e.target.value)} />
        </div>

        <EquipmentSelector onChange={setSelected} />

        <button type="submit">تأكيد الأخذ</button>
      </form>
      <div>{msg}</div>
    </div>
  )
}
