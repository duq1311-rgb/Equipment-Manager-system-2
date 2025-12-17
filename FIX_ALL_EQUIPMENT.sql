-- ============================================
-- تصحيح جميع المعدات دفعة واحدة
-- ============================================

-- تحديث 12-24: من 2 إلى 1
UPDATE equipment SET available_qty = 1 WHERE id = '51750ec0-c322-4a10-a0da-e501280261a8';

-- تحديث 16-35: من 4 إلى 1
UPDATE equipment SET available_qty = 1 WHERE id = '0dce4d11-6d47-4d42-874e-b069c1f0ca0f';

-- تحديث 24-70: من 4 إلى 1
UPDATE equipment SET available_qty = 1 WHERE id = '4ddffced-241d-48fd-bb17-4614a3c4062f';

-- تحديث 70-200: من 1 إلى 2 (تصحيح الخطأ - يجب أن يكون موجود)
UPDATE equipment SET available_qty = 2 WHERE id = '01a1da40-9d53-4e7e-9fab-5cdccc7100de';

-- تحديث FX3: من 9 إلى 5 (جميع الكاميرات متاحة)
UPDATE equipment SET available_qty = 5 WHERE id = '1f90d1be-3cc7-4028-a9f6-74bd35b2f11e';

-- تحديث GoPro 12: من 3 إلى 2
UPDATE equipment SET available_qty = 2 WHERE id = '2a116785-19c7-4de1-a81c-4a6f7759aa69';

-- تحديث ارم سي استاند: من 6 إلى 5
UPDATE equipment SET available_qty = 5 WHERE id = '57cf495c-f86b-415c-8f2f-02311f4be0f2';

-- تحديث استاند اضائة: من 12 إلى 11
UPDATE equipment SET available_qty = 11 WHERE id = '172ba600-8f2b-43ff-a48b-6279ad27d44a';

-- تحديث استاند كاميرا: من 16 إلى 12
UPDATE equipment SET available_qty = 12 WHERE id = '2614ad32-f4b4-407f-81d7-2e1fe67107a6';

-- تحديث استاند مثبت قو برو: من 5 إلى 4
UPDATE equipment SET available_qty = 4 WHERE id = '00c6daef-06a4-4468-be72-686bdc801d6d';

-- تحديث بطاريات كاميرا: من 48 إلى 1
UPDATE equipment SET available_qty = 1 WHERE id = '2fc20f21-f796-4502-94c4-4a72bc246287';

-- تحديث تاس كام: من 32 إلى 25
UPDATE equipment SET available_qty = 25 WHERE id = '08453ce3-3650-463b-8285-69f3e549e47d';

-- تحديث ذواكر كاميرا 320 قيقا: من 11 إلى 5
UPDATE equipment SET available_qty = 5 WHERE id = '7ee54952-04d1-4e6e-9bdc-e892bdf3c7c0';

-- تحديث ذواكر مايكرو 128 قيقا: من 10 إلى 7
UPDATE equipment SET available_qty = 7 WHERE id = '06e88954-2eae-4080-896f-bcf721a6308b';

-- تحديث ذواكر مايكرو صوت: من 13 إلى 11
UPDATE equipment SET available_qty = 11 WHERE id = '50e877d0-2d83-4dd4-b606-c3c65db5f08b';

-- تحديث رونين مانع اهتزاز: من 2 إلى 1
UPDATE equipment SET available_qty = 1 WHERE id = '1f199770-c865-4e84-b84b-e4daebf37e8e';

-- تحديث سي استاند: من 8 إلى 7
UPDATE equipment SET available_qty = 7 WHERE id = '1c3359fd-c088-4119-8a08-c9cf7ab51e33';

-- تحديث شدقن مايك: من 9 إلى 4
UPDATE equipment SET available_qty = 4 WHERE id = '5e793191-04f3-49f1-ad97-d0a76c84a375';

-- تحديث شنطة نقل معدات وسط: من 2 إلى 0
UPDATE equipment SET available_qty = 0 WHERE id = '10797811-8415-456b-bbac-8194da748217';

-- تحديث شواحن بطاريات كاميرا: من 13 إلى 11
UPDATE equipment SET available_qty = 11 WHERE id = '53491793-c9c1-4b71-8966-05e4b77f2c47';

-- تحديث شواحن قو برو: من 6 إلى 5
UPDATE equipment SET available_qty = 5 WHERE id = '3610c5d4-2291-49d5-8637-7ef66bc7887b';

-- تحديث وزن سي استاند: من 8 إلى 7
UPDATE equipment SET available_qty = 7 WHERE id = '321b1414-e981-4610-acba-69c53c4b9719';

-- ============================================
-- التحقق من التحديثات
SELECT name, total_qty, available_qty FROM equipment ORDER BY name;
