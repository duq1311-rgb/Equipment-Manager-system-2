import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EquipmentSelector({onChange}){
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(()=>{ fetchEquip() }, [])

  async function fetchEquip(){
    const { data } = await supabase.from('equipment').select('*').order('name')
    setItems(data || [])
    // set initial category to first available
    const categories = getCategories(data || [])
    if(categories.length>0) setActiveCategory(categories[0])
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

  function getCategories(list){
    const set = new Set()
    for(const it of list){
      const cat = it.metadata && (it.metadata.category || it.metadata.Category) || null
      if(cat) set.add(cat)
    }
    return Array.from(set)
  }

  const categories = useMemo(()=> getCategories(items), [items])
  const filteredItems = useMemo(()=> items.filter(it=>{
    const cat = it.metadata && (it.metadata.category || it.metadata.Category) || null
    return !activeCategory || cat === activeCategory
  }), [items, activeCategory])

  return (
    <div>
      <p>اختر الفئة أولاً:</p>
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
        {categories.map(cat => (
          <button
            type="button"
            key={cat}
            onClick={()=>setActiveCategory(cat)}
            style={{
              padding:'8px 12px',
              border:'1px solid #ccc',
              borderRadius:6,
              background: activeCategory===cat ? '#eee' : '#fff'
            }}
          >{cat}</button>
        ))}
      </div>

      <p>المعدات ضمن الفئة: <strong>{activeCategory || 'الكل'}</strong></p>
      {filteredItems.map(it=> (
        <div className="equipment-row" key={it.id}>
          <div style={{flex:1}}>{it.name} — متوفر: {it.available_qty}</div>
          <input type="number" min="0" max={it.available_qty} value={it.selectedQty||0}
            onChange={e=>setQty(it.id, Math.max(0, Number(e.target.value))) } />
          {errors[it.id] && <span style={{color:'red', marginInlineStart:8}}>{errors[it.id]}</span>}
        </div>
      ))}

      <div style={{marginTop:10}}>
        <button type="button" onClick={()=>{
          // choose next category if exists
          const idx = categories.findIndex(c=>c===activeCategory)
          const nextCat = categories[(idx+1) % (categories.length||1)]
          setActiveCategory(nextCat)
        }}>إضافة معدات من فئة أخرى</button>
      </div>
    </div>
  )
}
