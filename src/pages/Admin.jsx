import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Admin(){
  const [tx, setTx] = useState([])

  useEffect(()=>{ fetchAll() }, [])

  async function fetchAll(){
    const { data } = await supabase.from('transactions').select('*, transaction_items(*)').order('created_at', {ascending:false})
    setTx(data||[])
  }

  return (
    <div>
      <h2>لوحة المشرف</h2>
      <p>كل المعاملات:</p>
      <ul>
        {tx.map(t=> (
          <li key={t.id}>
            <strong>{t.project_name}</strong> — {t.project_owner} — {t.status}
            <ul>
              {(t.transaction_items||[]).map(it=> (
                <li key={it.id}>{it.equipment_id} - qty: {it.qty}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
