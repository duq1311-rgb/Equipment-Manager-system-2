-- ============================================
-- التحقق السريع بعد إغلاق العهدة
-- ============================================

-- 1. التحقق من حالة العهد
SELECT 
  id, 
  project_name, 
  status, 
  checkout_time, 
  return_time
FROM transactions
ORDER BY checkout_time DESC
LIMIT 10;

-- 2. جميع المعدات - الأعداد الحالية vs الصحيحة
SELECT 
  e.id,
  e.name,
  e.total_qty,
  e.available_qty as current_available,
  COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0) as total_out_now,
  (e.total_qty - COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0)) as correct_available,
  CASE 
    WHEN e.available_qty = (e.total_qty - COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0))
    THEN '✅ صحيح'
    ELSE '⚠️ خاطئ - يحتاج تصحيح'
  END as status
FROM equipment e
LEFT JOIN transaction_items ti ON e.id = ti.equipment_id
LEFT JOIN transactions t ON ti.transaction_id = t.id AND t.status = 'open'
GROUP BY e.id, e.name, e.total_qty, e.available_qty
ORDER BY e.name;

-- 3. العهد المفتوحة المتبقية (إن وجدت)
SELECT 
  t.id,
  t.project_name,
  e.name,
  ti.qty,
  ti.returned_qty,
  (ti.qty - COALESCE(ti.returned_qty, 0)) as qty_still_out
FROM transactions t
JOIN transaction_items ti ON t.id = ti.transaction_id
JOIN equipment e ON ti.equipment_id = e.id
WHERE t.status = 'open'
ORDER BY t.checkout_time DESC;
