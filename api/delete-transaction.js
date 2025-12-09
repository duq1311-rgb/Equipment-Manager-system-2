import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

const FALLBACK_ADMIN_UUIDS = [
  'f32927f5-b616-44a3-88f5-5085fa951731',
  '85975a3c-e601-4c66-bed1-42ad6e953873',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976'
]

function resolveAdminList(){
  const envAdmins = String(process.env.ADMIN_UUIDS || process.env.VITE_ADMIN_UUID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
  return Array.from(new Set([...envAdmins, ...FALLBACK_ADMIN_UUIDS]))
}

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: `Server not configured: missing ${missing.join(', ')}` })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if(!token) return res.status(401).json({ error: 'Authentication required' })

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if(authError || !authData?.user) return res.status(401).json({ error: 'Invalid token' })

  const adminList = resolveAdminList()
  if(!adminList.includes(authData.user.id)){
    return res.status(403).json({ error: 'Not authorized' })
  }

  const { transactionId } = req.body || {}
  if(!transactionId) return res.status(400).json({ error: 'transactionId is required' })

  try{
    const { data: tx, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, transaction_items(id, equipment_id, qty)')
      .eq('id', transactionId)
      .maybeSingle()

    if(fetchError) throw fetchError
    if(!tx) return res.status(404).json({ error: 'Transaction not found' })

    const items = tx.transaction_items || []
    for(const item of items){
      if(!item?.equipment_id || !item?.qty) continue
      const { data: equipmentRow, error: equipmentError } = await supabaseAdmin
        .from('equipment')
        .select('id, available_qty')
        .eq('id', item.equipment_id)
        .maybeSingle()
      if(equipmentError) throw equipmentError
      const newQty = (equipmentRow?.available_qty || 0) + Number(item.qty || 0)
      const { error: updateError } = await supabaseAdmin
        .from('equipment')
        .update({ available_qty: newQty })
        .eq('id', item.equipment_id)
      if(updateError) throw updateError
    }

    const { error: deleteError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', transactionId)

    if(deleteError) throw deleteError

    return res.status(200).json({ success: true })
  }catch(error){
    return res.status(500).json({ error: error.message || 'Failed to delete transaction' })
  }
}
