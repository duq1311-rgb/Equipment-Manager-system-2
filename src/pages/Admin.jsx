import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
  }
}

export default function Admin(){
  const [tx, setTx] = useState([])

  useEffect(()=>{ fetchAll() }, [])

  async function fetchAll(){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  return (
    <div>
      <h2>لوحة المشرف</h2>
      <p>كل العهد:</p>
      <ul>
        {tx.map(t=> (
          <li key={t.id} style={{marginBottom:10}}>
            <div>
              <strong>{t.project_name}</strong> — {t.project_owner} — {statusArabic(t.status)}
            </div>
            <ul>
              {(t.transaction_items||[]).map(it=> (
                <li key={it.id}>{(it.equipment && it.equipment.name) || it.equipment_id} — كمية: {it.qty}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
