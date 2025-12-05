import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EquipmentSelector({onChange, refreshTick}){
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(()=>{ fetchEquip() }, [])
  // إعادة الجلب عند تغيّر refreshTick القادم من صفحة الاستلام
  useEffect(()=>{ if(refreshTick>=0) fetchEquip() }, [refreshTick])

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

  function normalizeCategory(cat){
    if(!cat) return cat
    // توحيد التسميات: "عدسات" -> "العدسات"
    const map = {
      'عدسات': 'العدسات'
    }
    return map[cat] || cat
  }

  function getCategories(list){
    const set = new Set()
    for(const it of list){
      const raw = it.metadata && (it.metadata.category || it.metadata.Category) || null
      const cat = normalizeCategory(raw)
      if(cat) set.add(cat)
    }
    return Array.from(set)
  }

  const categories = useMemo(()=> getCategories(items), [items])
  const filteredItems = useMemo(()=> items.filter(it=>{
    const raw = it.metadata && (it.metadata.category || it.metadata.Category) || null
    const cat = normalizeCategory(raw)
    return !activeCategory || cat === activeCategory
  }), [items, activeCategory])

  const hasCategories = categories.length > 0

  return (
    <div className="equipment-selector">
      {hasCategories ? (
        <>
          <div className="category-toolbar">
            {categories.map(cat => (
              <button
                type="button"
                key={cat}
                className={`category-pill ${activeCategory===cat? 'active':''}`}
                onClick={()=>setActiveCategory(cat)}
              >{cat}</button>
            ))}
          </div>

          <p style={{margin:0, color:'var(--text-muted)'}}>المعدات ضمن الفئة: <strong style={{color:'var(--brand-primary)'}}>{activeCategory || 'الكل'}</strong></p>

          <div className="equipment-list">
            {filteredItems.map(it=> (
              <div className="equipment-row" key={it.id}>
                <div style={{flex:1, fontWeight:600}}>{it.name}</div>
                <div className="chip">متوفر: {it.available_qty}</div>
                <input type="number" min="0" max={it.available_qty} value={it.selectedQty||0}
                  onChange={e=>setQty(it.id, Math.max(0, Number(e.target.value))) } />
                {errors[it.id] && <span style={{color:'#D14343', fontSize:'0.85rem'}}>{errors[it.id]}</span>}
              </div>
            ))}
          </div>

          {categories.length>1 && (
            <button
              type="button"
              className="equipment-add-btn"
              onClick={()=>{
                const idx = categories.findIndex(c=>c===activeCategory)
                const nextCat = categories[(idx+1) % (categories.length||1)]
                setActiveCategory(nextCat)
              }}
            >إضافة معدات من فئة أخرى</button>
          )}
        </>
      ) : (
        <div className="section-subtle">لا توجد معدات متاحة حالياً.</div>
      )}
    </div>
  )
}
