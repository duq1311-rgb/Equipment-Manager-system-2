import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EquipmentSelector({onChange}){
  const [items, setItems] = useState([])

  useEffect(()=>{ fetchEquip() }, [])

  async function fetchEquip(){
    const { data } = await supabase.from('equipment').select('*').order('name')
    setItems(data || [])
  }

  function setQty(id, qty){
    const next = items.map(it => it.id === id ? {...it, selectedQty: qty} : it)
    setItems(next)
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
        </div>
      ))}
    </div>
  )
}
