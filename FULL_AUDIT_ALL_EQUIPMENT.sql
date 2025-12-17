-- ============================================
-- تحليل شامل للمعدات والعهد المفتوحة
-- ============================================

-- 1. عرض جميع العهد المفتوحة مع تفاصيل المعدات المأخوذة
SELECT 
  t.id as transaction_id,
  t.project_name,
  t.project_owner,
  t.checkout_time,
  t.status,
  e.name as equipment_name,
  ti.qty as qty_checkout,
  ti.returned_qty as qty_returned,
  (ti.qty - COALESCE(ti.returned_qty, 0)) as qty_still_out,
  u.email as user_email
FROM transactions t
JOIN transaction_items ti ON t.id = ti.transaction_id
JOIN equipment e ON ti.equipment_id = e.id
LEFT JOIN auth.users u ON t.user_id = u.id
WHERE t.status = 'open'
  AND (ti.returned_qty IS NULL OR ti.returned_qty < ti.qty)
ORDER BY t.checkout_time DESC;

-- ============================================
-- 2. ملخص: المعدات المأخوذة حالياً (لم تُرجع)
-- ============================================
SELECT 
  e.name as equipment_name,
  e.total_qty as current_total,
  e.available_qty as current_available,
  COUNT(DISTINCT t.id) as num_checkouts,
  SUM(ti.qty - COALESCE(ti.returned_qty, 0)) as total_qty_out,
  (e.total_qty - SUM(ti.qty - COALESCE(ti.returned_qty, 0))) as should_be_available
FROM equipment e
LEFT JOIN transaction_items ti ON e.id = ti.equipment_id
LEFT JOIN transactions t ON ti.transaction_id = t.id 
WHERE t.status = 'open' OR t.id IS NULL
GROUP BY e.id, e.name, e.total_qty, e.available_qty
HAVING SUM(ti.qty - COALESCE(ti.returned_qty, 0)) > 0 
   OR (e.available_qty != (e.total_qty - SUM(ti.qty - COALESCE(ti.returned_qty, 0))))
ORDER BY e.name;

-- ============================================
-- 3. المعدات التي تحتاج تصحيح
-- ============================================
SELECT 
  e.name,
  e.total_qty,
  e.available_qty as current_wrong_available,
  COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0) as total_checked_out,
  (e.total_qty - COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0)) as correct_available,
  CASE 
    WHEN e.available_qty != (e.total_qty - COALESCE(SUM(ti.qty - COALESCE(ti.returned_qty, 0)), 0)) 
    THEN 'يحتاج تصحيح ⚠️'
    ELSE 'صحيح ✅'
  END as status
FROM equipment e
LEFT JOIN transaction_items ti ON e.id = ti.equipment_id
LEFT JOIN transactions t ON ti.transaction_id = t.id AND t.status = 'open'
GROUP BY e.id, e.name, e.total_qty, e.available_qty
ORDER BY e.name;
