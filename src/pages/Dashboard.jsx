import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard(){
  const [equip, setEquip] = useState([])

  useEffect(()=>{
    fetchEquip()
  },[])

  async function fetchEquip(){
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('name')
    if(!error) setEquip(data || [])
  }

  return (
    <div>
      <h2>لوحة التحكم</h2>
      <p>قائمة سريعة بالمعدات المتاحة:</p>
      <ul>
        {equip.map(e=> (
          <li key={e.id}>{e.name} — متبقي: {e.available_qty}</li>
        ))}
      </ul>
    </div>
  )
}
