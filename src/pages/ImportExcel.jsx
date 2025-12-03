import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

export default function ImportExcel(){
  const [msg, setMsg] = useState('')

  async function handleFile(e){
    const file = e.target.files[0]
    if(!file) return
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)
    // Expecting rows with { name, total_qty }
    const rows = json.map(r=>({
      name: r.name || r.Name || r['Equipment'] || r.equipment,
      total_qty: parseInt(r.total_qty || r.qty || r.quantity || r.Count || 0, 10) || 0,
      available_qty: parseInt(r.total_qty || r.qty || r.quantity || r.Count || 0, 10) || 0
    }))

    // Insert rows into equipment table (upsert by name)
    for(const row of rows){
      if(!row.name) continue
      // try to find existing
      const { data: found } = await supabase.from('equipment').select('*').eq('name', row.name).limit(1).maybeSingle()
      if(found){
        // update totals and available
        await supabase.from('equipment').update({ total_qty: row.total_qty, available_qty: row.available_qty }).eq('id', found.id)
      } else {
        await supabase.from('equipment').insert(row)
      }
    }

    setMsg(`تم استيراد ${rows.length} صفوف (قد تتطلب RLS صلاحيات)`)
  }

  return (
    <div>
      <h2>استيراد إكسل/CSV للمعدات</h2>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
      <div>{msg}</div>
    </div>
  )
}
