import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }

  try{
    // حساب المعدات المأخوذة حالياً من عهد مفتوحة
    const { data: outRows, error: outErr } = await supabaseAdmin
      .rpc('reconcile_out_now', {})
    
    // إذا لم تكن الدالة موجودة، ننفّذ الاستعلامات يدوياً
    if(outErr){
      // اجلب التجميع مباشرة
      const { data: items } = await supabaseAdmin
        .from('transaction_items')
        .select('equipment_id, qty, returned_qty, transactions!inner(status)')
      
      const map = new Map()
      for(const it of (items||[])){
        if(it.transactions?.status !== 'open') continue
        const used = (Number(it.qty||0) - Number(it.returned_qty||0))
        map.set(it.equipment_id, (map.get(it.equipment_id) || 0) + Math.max(used,0))
      }
      // حدّث المعدات
      for(const [equipment_id, total_out_now] of map.entries()){
        const { data: eq } = await supabaseAdmin
          .from('equipment')
          .select('id,total_qty')
          .eq('id', equipment_id)
          .maybeSingle()
        if(!eq) continue
        const newAvailable = Math.max(Number(eq.total_qty||0) - Number(total_out_now||0), 0)
        await supabaseAdmin
          .from('equipment')
          .update({ available_qty: newAvailable })
          .eq('id', equipment_id)
      }
      // للأجهزة التي لا توجد عهد مفتوحة لها: اجعل available = total
      const { data: allEq } = await supabaseAdmin
        .from('equipment')
        .select('id,total_qty,available_qty')
      for(const eq of (allEq||[])){
        if(!map.has(eq.id)){
          await supabaseAdmin
            .from('equipment')
            .update({ available_qty: eq.total_qty })
            .eq('id', eq.id)
        }
      }
      return res.status(200).json({ success: true, method: 'manual' })
    }

    return res.status(200).json({ success: true, method: 'rpc' })
  }catch(error){
    return res.status(500).json({ error: error.message || 'Failed to reconcile inventory' })
  }
}
