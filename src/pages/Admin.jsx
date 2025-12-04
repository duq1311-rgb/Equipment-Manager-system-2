import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
  }
}

export default function Admin(){
  const [tx, setTx] = useState([])
  const [msg, setMsg] = useState('')
  const [showOnlyPending, setShowOnlyPending] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('employee')
  const [users, setUsers] = useState([])

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    // حماية صفحة الأدمن عبر UUID
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    // استخدام قيمة البيئة أو قيمة احتياطية مؤقتة
    const ADMIN_UUID = import.meta.env.VITE_ADMIN_UUID || 'f32927f5-b616-44a3-88f5-5085fa951731'
    if(!user || !ADMIN_UUID || user.id !== ADMIN_UUID){
      setMsg('ليست لديك صلاحية الدخول إلى لوحة المشرف')
      // إعادة توجيه سريع إلى الصفحة الرئيسية
      setTimeout(()=>{ window.location.href = '/' }, 1200)
      return
    }
    await fetchAll()
    await loadUsers()
  }

  async function fetchAll(){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  async function loadUsers(){
    try{
      const resp = await fetch('/api/list-users')
      const json = await resp.json()
      if(!resp.ok){ setMsg(`فشل جلب المستخدمين: ${json.error||''}`); return }
      setUsers(json.users||[])
    }catch(e){ setMsg('خطأ في جلب المستخدمين') }
  }

  async function approveReturnItem(item){
    // وضع علامة تحقق من الأدمن على عنصر مُعاد
    const { data, error } = await supabase
      .from('transaction_items')
      .update({ admin_verified: true })
      .eq('id', item.id)
      .select()
    if(error){
      const detail = error?.message || ''
      // إيضاح محتمل: إذا كان العمود غير موجود
      const hint = detail.includes('column') && detail.includes('admin_verified')
        ? 'يبدو أن عمود admin_verified غير موجود. أضف العمود في Supabase: ALTER TABLE public.transaction_items ADD COLUMN admin_verified boolean NOT NULL DEFAULT false;'
        : ''
      setMsg(`فشل التحقق من العنصر${detail ? `: ${detail}` : ''}${hint ? ` — ${hint}` : ''}`)
      return
    }
    setMsg('تم التحقق من العنصر')
    await fetchAll()
  }

  async function finalizeTransactionIfAllVerified(t){
    // إذا كانت كل عناصر الطلب مُعادَة ومتحقَّق منها، اغلق العهدة
    const items = t.transaction_items || []
    const allVerified = items.length>0 && items.every(it => it.admin_verified)
    if(!allVerified){ setMsg('هناك عناصر لم يتم التحقق منها بعد'); return }
    if(t.status !== 'open'){ setMsg('العهدة ليست قيد الانتظار للإغلاق'); return }
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'closed', return_time: new Date().toISOString() })
      .eq('id', t.id)
    if(error){ setMsg('فشل إغلاق العهدة'); return }
    setMsg('تم إغلاق العهدة بعد التحقق')
    await fetchAll()
  }

  const visibleTx = useMemo(()=>{
    if(!showOnlyPending) return tx
    // عرض العهد قيد التحقق فقط: فيها عناصر غير مُتحقّق منها وحالة العهدة مفتوحة
    return (tx||[]).filter(t => t.status==='open' && (t.transaction_items||[]).some(it=>!it.admin_verified))
  }, [tx, showOnlyPending])

  return (
    <div>
      <h2>لوحة المشرف</h2>
      <p>إدارة الإرجاعات والتحقق:</p>
      <div style={{marginBottom:8}}>
        <label>
          <input type="checkbox" checked={showOnlyPending} onChange={e=>setShowOnlyPending(e.target.checked)} />
          عرض “العهد قيد التحقق” فقط
        </label>
      </div>
      {msg && <div style={{color:'green'}}>{msg}</div>}

      <section style={{padding:'8px 0', borderTop:'1px solid #ddd', marginTop:8}}>
        <h3>إنشاء حساب موظف / أدمن</h3>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <input type="email" placeholder="الإيميل" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
          <input type="password" placeholder="كلمة السر" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
          <label>
            الدور:
            <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
              <option value="employee">موظف</option>
              <option value="admin">اداري</option>
            </select>
          </label>
          <button onClick={async()=>{
            setMsg('جارٍ إنشاء المستخدم...')
            try{
              const resp = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole })
              })
              const json = await resp.json()
              if(!resp.ok){
                setMsg(`فشل إنشاء المستخدم: ${json.error || 'خطأ غير معروف'}`)
              }else{
                setMsg('تم إنشاء المستخدم بنجاح')
                setNewEmail(''); setNewPassword(''); setNewRole('employee')
              }
            }catch(e){
              setMsg('حدث خطأ أثناء الاتصال بالخادم')
            }
          }}>إنشاء</button>
        </div>
        <p style={{fontSize:12, color:'#666'}}>ملاحظة: يتطلب هذا إعداد مفتاح الخدمة في Vercel (SUPABASE_SERVICE_ROLE_KEY).</p>
      </section>

      <section style={{padding:'8px 0', borderTop:'1px solid #ddd', marginTop:8}}>
        <h3>المستخدمون</h3>
        <button onClick={loadUsers}>تحديث القائمة</button>
        <ul>
          {users.map(u=> (
            <li key={u.id} style={{margin:'6px 0'}}>
              {u.email} — الدور الحالي: {u.role}
              <select defaultValue={u.role} onChange={async(e)=>{
                const role = e.target.value
                setMsg('جارٍ تحديث الدور...')
                const resp = await fetch('/api/update-user-role', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, role })
                })
                const json = await resp.json()
                if(!resp.ok){ setMsg(`فشل تحديث الدور: ${json.error||''}`) }
                else { setMsg('تم تحديث الدور'); await loadUsers() }
              }}>
                <option value="employee">موظف</option>
                <option value="admin">اداري</option>
              </select>
              <button style={{marginInlineStart:8}} onClick={async()=>{
                if(!confirm('هل أنت متأكد من حذف المستخدم؟')) return
                setMsg('جارٍ حذف المستخدم...')
                const resp = await fetch('/api/delete-user', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id })
                })
                const json = await resp.json()
                if(!resp.ok){ setMsg(`فشل حذف المستخدم: ${json.error||''}`) }
                else { setMsg('تم حذف المستخدم'); await loadUsers() }
              }}>حذف</button>
            </li>
          ))}
        </ul>
      </section>
      <ul>
        {visibleTx.map(t=> (
          <li key={t.id} style={{marginBottom:10}}>
            <div>
              <strong>{t.project_name}</strong> — {t.project_owner} — {statusArabic(t.status)}
            </div>
            <ul>
              {(t.transaction_items||[]).map(it=> (
                <li key={it.id}>
                  {(it.equipment && it.equipment.name) || it.equipment_id} — كمية: {it.qty}
                  {/* عناصر الإرجاع تحتاج تحقق الأدمن */}
                  <div style={{display:'inline-block', marginInlineStart:8}}>
                    حالة التحقق: {it.admin_verified ? 'تم التحقق' : 'بانتظار التحقق'}
                    {!it.admin_verified && (
                      <button style={{marginInlineStart:8}} onClick={()=>approveReturnItem(it)}>تم التحقق</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {t.status==='open' && (
              <div style={{marginTop:6}}>
                <button
                  onClick={()=>finalizeTransactionIfAllVerified(t)}
                  disabled={(t.transaction_items||[]).some(it=>!it.admin_verified)}
                >إغلاق العهدة بعد التحقق</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
