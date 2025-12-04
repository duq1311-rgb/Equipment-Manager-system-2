import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EquipmentSelector({onChange}){
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})

  useEffect(()=>{ fetchEquip() }, [])

  async function fetchEquip(){
    const { data } = await supabase.from('equipment').select('*').order('name')
    setItems(data || [])
  }

  function setQty(id, qty){
    const next = items.map(it => {
      if(it.id !== id) return it
      const validQty = Math.max(0, Math.min(Number(qty||0), Number(it.available_qty||0)))
      return { ...it, selectedQty: validQty }
    })
    setItems(next)
    // validation: track error if user typed > available
    const changed = next.find(it=>it.id===id)
    setErrors(prev => ({ ...prev, [id]: (changed && Number(changed.selectedQty) > Number(changed.available_qty)) ? 'لا يمكن اختيار كمية أكبر من المتاح' : '' }))
    onChange && onChange(next.filter(i=>i.selectedQty>0))
  }

  return (
    <div>
      <p>اختر المعدات (ادخل عدد لكل معدة):</p>
      {items.map(it=> (
        <div className="equipment-row" key={it.id}>
          <div style={{flex:1}}>{it.name} — متوفر: {it.available_qty}</div>
          <input type="number" min="0" max={it.available_qty} value={it.selectedQty||0}
            onChange={e=>setQty(it.id, Math.max(0, Number(e.target.value))) } />
          {errors[it.id] && <span style={{color:'red', marginInlineStart:8}}>{errors[it.id]}</span>}
        </div>
      ))}
    </div>
  )
}
