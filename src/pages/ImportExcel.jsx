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

    // Upsert rows into equipment table by name to avoid duplicates
    for(const row of rows){
      if(!row.name) continue
      try{
        await supabase
          .from('equipment')
          .upsert(row, { onConflict: 'name' })
      }catch(err){
        console.warn('Upsert failed for', row.name, err)
      }
    }

    setMsg(`تم استيراد ${rows.length} صفوف (قد تتطلب RLS صلاحيات)`)
  }

  return (
    <div>
      <h2>استيراد إكسل/CSV للمعدات</h2>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
      <div>{msg}</div>
      <p style={{fontSize:12,color:'#666'}}>ملاحظة: لتجنّب التكرار تمت عملية الإدخال بشكل Upsert على الاسم. يُفضّل وجود قيد فريد على عمود name في قاعدة البيانات.</p>
    </div>
  )
}
