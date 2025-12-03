import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ReturnPage(){
  const [openTx, setOpenTx] = useState([])
  const [selectedTx, setSelectedTx] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(()=>{ fetchOpenTx() }, [])

  async function fetchOpenTx(){
    const { data } = await supabase.from('transactions').select('*').eq('status','open').order('created_at', {ascending:false})
    setOpenTx(data || [])
  }

  async function loadItems(txId){
    const { data } = await supabase.from('transaction_items').select('*, equipment(*)').eq('transaction_id', txId)
    // attach fields for damaged/lost and returned qty
    setSelectedTx({ id: txId, items: (data || []).map(d=>({ ...d, returnedQty: d.qty, damaged:false, lost:false })) })
  }

  async function confirmReturn(){
    if(!selectedTx) return
    // Update equipment counts and write notes
    for(const it of selectedTx.items){
      if(it.returnedQty > 0){
        // increase available by returnedQty if not lost
        const add = it.lost ? 0 : it.returnedQty
        if(add>0){
          await supabase.from('equipment').update({ available_qty: (it.equipment.available_qty || 0) + add }).eq('id', it.equipment.id)
        }
        // update transaction_items row
        await supabase.from('transaction_items').update({ damaged: it.damaged, damage_notes: it.damage_notes || null, lost: it.lost, lost_notes: it.lost_notes || null }).eq('id', it.id)
      }
    }
    // Optionally close transaction
    await supabase.from('transactions').update({ status: 'closed', return_time: new Date().toISOString() }).eq('id', selectedTx.id)
    setMsg('تم تسجيل الإرجاع')
    setSelectedTx(null)
    fetchOpenTx()
  }

  return (
    <div>
      <h2>ارجاع معدات</h2>
      <div>
        <label>المعاملات المفتوحة</label>
        <ul>
          {openTx.map(tx=> (
            <li key={tx.id}><button onClick={()=>loadItems(tx.id)}>{tx.project_name} — {tx.project_owner}</button></li>
          ))}
        </ul>
      </div>

      {selectedTx && (
        <div>
          <h3>تفاصيل الإرجاع</h3>
          {selectedTx.items.map(it=> (
            <div key={it.id} className="equipment-row">
              <div style={{flex:1}}>{it.equipment.name} — أخذ: {it.qty}</div>
              <label>كمية راجعة</label>
              <input type="number" min="0" max={it.qty} value={it.returnedQty} onChange={e=>{
                const v = Math.max(0, Number(e.target.value))
                setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, returnedQty: v}: x)}))
              }} />
              <label>هل بها أضرار؟</label>
              <select value={it.damaged? 'yes':'no'} onChange={e=>{
                const val = e.target.value === 'yes'
                setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, damaged: val}: x)}))
              }}>
                <option value="no">لا</option>
                <option value="yes">نعم</option>
              </select>
              {it.damaged && (
                <input placeholder="وصف الاضرار" value={it.damage_notes||''} onChange={e=>{
                  setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, damage_notes: e.target.value}: x)}))
                }} />
              )}

              <label>هل فقد شيء؟</label>
              <select value={it.lost? 'yes':'no'} onChange={e=>{
                const val = e.target.value === 'yes'
                setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, lost: val}: x)}))
              }}>
                <option value="no">لا</option>
                <option value="yes">نعم</option>
              </select>
              {it.lost && (
                <input placeholder="ما المفقودات" value={it.lost_notes||''} onChange={e=>{
                  setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, lost_notes: e.target.value}: x)}))
                }} />
              )}
            </div>
          ))}

          <div>
            <label>موعد انتهاء التصوير</label>
            <input type="datetime-local" />
          </div>

          <div>
            <label>موعد إرجاع المعدات</label>
            <input type="datetime-local" />
          </div>

          <button onClick={confirmReturn}>تأكيد الإرجاع</button>
        </div>
      )}

      <div>{msg}</div>
    </div>
  )
}
