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
    // attach fields for damaged/lost and returned qty and include checkbox
    setSelectedTx({ id: txId, items: (data || []).map(d=>({ ...d, returnedQty: d.qty, damaged:false, lost:false, include:true })) })
  }

  async function confirmReturn(){
    if(!selectedTx) return
    setMsg('جاري معالجة الإرجاع...')
    
    try{
      const includedItems = selectedTx.items.filter(it => it.include)
      
      if(includedItems.length === 0){
        setMsg('لا توجد عناصر محددة للإرجاع')
        return
      }
      
      // جلب جميع المعدات دفعة واحدة
      const equipmentIds = includedItems.map(it => it.equipment.id)
      const { data: allEquipment } = await supabase
        .from('equipment')
        .select('id, available_qty')
        .in('id', equipmentIds)
      
      const equipmentMap = new Map(
        (allEquipment || []).map(eq => [eq.id, eq.available_qty ?? 0])
      )
      
      // تحديث المخزون والعناصر
      for(const it of includedItems){
        const currentAvailableQty = equipmentMap.get(it.equipment.id) ?? 0
        
        if(it.returnedQty > 0){
          // increase available by returnedQty if not lost
          const add = it.lost ? 0 : it.returnedQty
          if(add > 0){
            const newQty = currentAvailableQty + add
            await supabase.from('equipment').update({ available_qty: newQty }).eq('id', it.equipment.id)
          }
        }
        
        // update transaction_items row (include returned qty and flags)
        await supabase.from('transaction_items').update({ 
          returned_qty: it.returnedQty, 
          damaged: it.damaged, 
          damage_notes: it.damage_notes || null, 
          lost: it.lost, 
          lost_notes: it.lost_notes || null 
        }).eq('id', it.id)
      }
      
      // Close transaction
      await supabase.from('transactions').update({ 
        status: 'closed', 
        return_time: new Date().toISOString() 
      }).eq('id', selectedTx.id)
      
      setMsg('✅ تم تسجيل الإرجاع بنجاح')
      setSelectedTx(null)
      await fetchOpenTx()
    }catch(error){
      setMsg(`خطأ في تسجيل الإرجاع: ${error.message}`)
    }
  }

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>تسليم العهدة</h1>
        <p>اختر العهدة المفتوحة، راجع العناصر، ثم وثّق حالة الإرجاع قبل إغلاقها.</p>
      </section>

      <section className="page-card">
        <h2>العهد المفتوحة</h2>
        {openTx.length === 0 ? (
          <p className="empty-state">لا توجد عهد مفتوحة في الوقت الحالي.</p>
        ) : (
          <div className="list-tiles">
            {openTx.map(tx=> (
              <div key={tx.id} className="list-tile">
                <div>
                  <div style={{fontWeight:700}}>{tx.project_name}</div>
                  <small>صاحب المشروع: {tx.project_owner || '—'}</small>
                </div>
                <button type="button" onClick={()=>loadItems(tx.id)}>عرض التفاصيل</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedTx && (
        <section className="page-card">
          <h2>تفاصيل الإرجاع</h2>
          <div className="equipment-items">
            {selectedTx.items.map(it=> (
              <div key={it.id} className="equipment-row" style={{flexWrap:'wrap'}}>
                <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1}}>
                  <input type="checkbox" checked={!!it.include} onChange={e=>{
                    const val = !!e.target.checked
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, include: val}: x)}))
                  }} />
                  <strong>{it.equipment.name}</strong>
                  <span className="chip">المستلم: {it.qty}</span>
                </div>

                <div className="form-row" style={{minWidth:'160px'}}>
                  <label>كمية راجعة</label>
                  <input type="number" min="0" max={it.qty} value={it.returnedQty} onChange={e=>{
                    const v = Math.max(0, Number(e.target.value))
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, returnedQty: v}: x)}))
                  }} />
                </div>

                <div className="form-row" style={{minWidth:'160px'}}>
                  <label>حالة الأضرار</label>
                  <select value={it.damaged? 'yes':'no'} onChange={e=>{
                    const val = e.target.value === 'yes'
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, damaged: val}: x)}))
                  }}>
                    <option value="no">لا</option>
                    <option value="yes">نعم</option>
                  </select>
                </div>
                {it.damaged && (
                  <input style={{flexBasis:'100%'}} placeholder="وصف الأضرار" value={it.damage_notes||''} onChange={e=>{
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, damage_notes: e.target.value}: x)}))
                  }} />
                )}

                <div className="form-row" style={{minWidth:'160px'}}>
                  <label>هل فقد شيء؟</label>
                  <select value={it.lost? 'yes':'no'} onChange={e=>{
                    const val = e.target.value === 'yes'
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, lost: val}: x)}))
                  }}>
                    <option value="no">لا</option>
                    <option value="yes">نعم</option>
                  </select>
                </div>
                {it.lost && (
                  <input style={{flexBasis:'100%'}} placeholder="ما المفقودات" value={it.lost_notes||''} onChange={e=>{
                    setSelectedTx(s=> ({...s, items: s.items.map(x=> x.id===it.id?{...x, lost_notes: e.target.value}: x)}))
                  }} />
                )}
              </div>
            ))}
          </div>

          <div className="form-actions" style={{marginTop:16}}>
            <button className="btn-primary" type="button" onClick={confirmReturn}>تأكيد التسليم</button>
          </div>
        </section>
      )}

      {msg && <div className="form-message">{msg}</div>}
    </div>
  )
}
