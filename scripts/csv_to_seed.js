#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function splitLines(text){
  return text.split(/\r?\n/).filter(l=>l.trim()!=='')
}

function unquote(s){
  if(!s) return ''
  s = s.trim()
  if((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))){
    return s.slice(1,-1)
  }
  return s
}

function escapeSQL(s){
  return s.replace(/'/g, "''")
}

function parseCSV(text){
  const lines = splitLines(text)
  if(lines.length === 0) return []
  const header = lines[0].split(',').map(h=>h.trim())
  const idx = {
    category: header.findIndex(h=>/فئ|category|category/i.test(h)),
    name: header.findIndex(h=>/اسم|name/i.test(h)),
    count: header.findIndex(h=>/عدد|count|qty|quantity/i.test(h)),
    condition: header.findIndex(h=>/حالة|condition/i.test(h)),
    notes: header.findIndex(h=>/ملاحظ|notes/i.test(h)),
  }

  const rows = []
  for(let i=1;i<lines.length;i++){
    const parts = lines[i].split(',')
    // join extra parts into notes if more columns present
    const category = unquote(parts[idx.category] || parts[0])
    const name = unquote(parts[idx.name] || parts[1])
    const count = parts[idx.count] ? parseInt(parts[idx.count]) : NaN
    const condition = unquote(parts[idx.condition] || parts[3])
    const notes = unquote(parts[idx.notes] || parts[4])
    if(!name || name.trim()==='') continue
    rows.push({category: category||null, name: name||null, count: isNaN(count)?0:count, condition: condition||null, notes: notes||null})
  }
  return rows
}

function aggregate(rows){
  const map = new Map()
  for(const r of rows){
    const key = r.name.trim()
    if(!map.has(key)) map.set(key, { name: key, total:0, category: r.category, condition: r.condition, notes: r.notes })
    const cur = map.get(key)
    cur.total += (Number(r.count) || 0)
    // keep latest non-empty fields
    if(r.category) cur.category = r.category
    if(r.condition) cur.condition = r.condition
    if(r.notes) cur.notes = r.notes
  }
  return Array.from(map.values())
}

function buildSQL(items){
  const lines = []
  lines.push('-- Generated seed SQL for equipment table')
  lines.push('-- Run in Supabase SQL editor (it uses gen_random_uuid())')
  lines.push('\n')
  for(const it of items){
    const name = escapeSQL(it.name)
    const meta = {
      category: it.category || null,
      condition: it.condition || null,
      notes: it.notes || null
    }
    const metaStr = escapeSQL(JSON.stringify(meta))
    const total = Number(it.total)||0
    const available = total
    const sql = `INSERT INTO equipment (id, name, total_qty, available_qty, metadata) VALUES (gen_random_uuid(), '${name}', ${total}, ${available}, '${metaStr}'::jsonb);`
    lines.push(sql)
  }
  return lines.join('\n')
}

async function main(){
  const args = process.argv.slice(2)
  if(args.length===0){
    console.log('Usage: node csv_to_seed.js <path-to-csv> [output-sql-path]')
    process.exit(1)
  }
  const csvPath = path.resolve(args[0])
  const outPath = args[1] ? path.resolve(args[1]) : path.resolve(process.cwd(), 'seed_equipment.sql')
  if(!fs.existsSync(csvPath)){
    console.error('CSV file not found:', csvPath)
    process.exit(2)
  }
  const raw = fs.readFileSync(csvPath, {encoding:'utf8'})
  const rows = parseCSV(raw)
  const items = aggregate(rows)
  const sql = buildSQL(items)
  fs.writeFileSync(outPath, sql, {encoding:'utf8'})
  console.log('Wrote', outPath, 'with', items.length, 'items')
}

main()
