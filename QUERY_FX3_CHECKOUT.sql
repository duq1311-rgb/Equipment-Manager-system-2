-- اكتشاف جميع عهد الكاميرا FX3 المأخوذة حالياً (لم تُرجع بعد)
SELECT 
  t.id as transaction_id,
  t.project_name,
  t.project_owner,
  t.checkout_time,
  t.shoot_time,
  t.status,
  ti.qty as fx3_qty_checkout,
  ti.returned_qty as fx3_qty_returned,
  (ti.qty - COALESCE(ti.returned_qty, 0)) as fx3_qty_still_checked_out,
  ti.damaged,
  ti.damage_notes,
  ti.lost,
  ti.lost_notes,
  u.email as user_email,
  p.full_name as user_name
FROM transactions t
JOIN transaction_items ti ON t.id = ti.transaction_id
JOIN equipment e ON ti.equipment_id = e.id
LEFT JOIN auth.users u ON t.user_id = u.id
LEFT JOIN profiles p ON t.user_id = p.id
WHERE e.name = 'FX3' 
  AND t.status = 'open'
  AND (ti.returned_qty IS NULL OR ti.returned_qty < ti.qty)
ORDER BY t.checkout_time DESC;

-- الملخص: كم عدد FX3 المسجّلة حالياً
SELECT 
  COUNT(*) as total_checkout_records,
  SUM(ti.qty) as total_fx3_checked_out,
  SUM(COALESCE(ti.returned_qty, 0)) as total_fx3_returned,
  SUM(ti.qty - COALESCE(ti.returned_qty, 0)) as total_fx3_still_checked_out
FROM transactions t
JOIN transaction_items ti ON t.id = ti.transaction_id
JOIN equipment e ON ti.equipment_id = e.id
WHERE e.name = 'FX3' 
  AND t.status = 'open'
  AND (ti.returned_qty IS NULL OR ti.returned_qty < ti.qty);

-- الحساب الصحيح للكمية المتاحة
-- available_qty الصحيح = total_qty (5) - عدد الكاميرات المأخوذة
-- سيظهر هنا النتيجة
