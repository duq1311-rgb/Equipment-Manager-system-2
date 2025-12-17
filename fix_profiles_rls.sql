-- إصلاح Row Level Security لجدول profiles
-- نفّذ هذا الكود في Supabase SQL Editor

-- السماح للجميع بقراءة جدول profiles (للموظفين)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- حذف أي سياسات قديمة
DROP POLICY IF EXISTS "Allow public read access to profiles" ON profiles;

-- إنشاء سياسة جديدة للسماح بالقراءة للجميع
CREATE POLICY "Allow public read access to profiles"
ON profiles
FOR SELECT
TO public
USING (true);

-- السماح للمستخدمين بتعديل بياناتهم الخاصة فقط
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- السماح بإنشاء profile عند التسجيل
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
