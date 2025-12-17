import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  : null

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ projects: [], error: 'Method not allowed' })
  if(!supabaseAdmin){
    const missing = []
    if(!SUPABASE_URL) missing.push('SUPABASE_URL')
    if(!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ projects: [], error: `Server not configured: missing ${missing.join(', ')}` })
  }

  // Prevent stale cache in clients
  res.set('Cache-Control', 'no-store')

  const { userId, from: fromParam, to: toParam } = req.query || {}
  if(!userId) return res.status(400).json({ projects: [], error: 'userId parameter is required' })

  try {
    // 1. جلب كل المعاملات التي يكون فيها الموظف صاحب أو مساعد مباشر
    const { data: directTx, error: directError } = await supabaseAdmin
      .from('transactions')
      .select('*, transaction_items(*, equipment(name)), transaction_assistants(assistant_user_id)')
      .or(`user_id.eq.${userId},assistant_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (directError) throw directError;

    // 2. جلب كل transaction_id التي يكون فيها الموظف مساعد في جدول transaction_assistants
    const { data: assistantLinks, error: assistantsError } = await supabaseAdmin
      .from('transaction_assistants')
      .select('transaction_id')
      .eq('assistant_user_id', userId);
    if (assistantsError) throw assistantsError;

    // 3. جلب كل المعاملات التي id فيها ضمن extraIds (ولم تُجلب في الخطوة 1)
    const existingIds = new Set((directTx || []).map(tx => tx.id));
    const extraIds = (assistantLinks || [])
      .map(link => link.transaction_id)
      .filter(id => id && !existingIds.has(id));

    let extraTx = [];
    if (extraIds.length) {
      const { data: extraData, error: extraError } = await supabaseAdmin
        .from('transactions')
        .select('*, transaction_items(*, equipment(name)), transaction_assistants(assistant_user_id)')
        .in('id', extraIds)
        .order('created_at', { ascending: false });
      if (extraError) throw extraError;
      extraTx = extraData || [];
    }

    // 4. دمج النتائج بدون تكرار
    const allTx = [...(directTx || []), ...extraTx];

    // 5. فلترة بالتواريخ إذا لزم
    const fromDateRaw = fromParam ? new Date(fromParam) : null;
    const toDateRaw = toParam ? new Date(toParam) : null;
    const fromDate = fromDateRaw && !Number.isNaN(fromDateRaw.getTime()) ? fromDateRaw : null;
    const toDate = toDateRaw && !Number.isNaN(toDateRaw.getTime()) ? toDateRaw : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);

    const filteredTx = allTx
      .filter(tx => {
        const checkoutTime = tx.checkout_time ? new Date(tx.checkout_time) : null;
        if (fromDate && (!checkoutTime || checkoutTime < fromDate)) return false;
        if (toDate && (!checkoutTime || checkoutTime > toDate)) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = a.checkout_time ? new Date(a.checkout_time).getTime() : 0;
        const bTime = b.checkout_time ? new Date(b.checkout_time).getTime() : 0;
        return bTime - aTime;
      });

    // 6. تجهيز المشاريع بنفس منطق الواجهة
    const projects = filteredTx.map(project => {
      const uniqueAssistants = Array.from(new Set([
        ...(project.assistant_user_id ? [project.assistant_user_id] : []),
        ...((project.transaction_assistants || []).map(link => link.assistant_user_id).filter(Boolean))
      ]));
      const assignmentRole = project.user_id === userId
        ? 'owner'
        : uniqueAssistants.includes(userId)
          ? 'assistant'
          : 'other';
      return {
        ...project,
        assistants: uniqueAssistants,
        assignment_role: assignmentRole
      };
    });

    res.status(200).json({ projects });
  } catch (error) {
    res.status(200).json({ projects: [], error: error.message || 'Unknown error' });
  }
  // ضمان أن الاستجابة ترجع projects حتى لو لم يتم إرسال أي استجابة أخرى
  if (!res.headersSent) res.status(200).json({ projects: [] });
}
