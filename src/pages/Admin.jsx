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
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeProjects, setEmployeeProjects] = useState([])
  // إزالة إدارة المستخدمين من لوحة الأدمن

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
    await loadEmployees()
  }

  async function fetchAll(){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .order('created_at', {ascending:false})
    setTx(data||[])
  }

  async function loadEmployees(){
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name', { ascending: true })

    const { data: txCounts } = await supabase
      .from('transactions')
      .select('user_id, id')

    const countMap = {}
    ;(txCounts||[]).forEach(t => {
      if(!t.user_id) return
      countMap[t.user_id] = (countMap[t.user_id]||0) + 1
    })

    const list = (profiles||[]).map(p => ({
      id: p.id,
      name: p.full_name || p.id,
      projectsCount: countMap[p.id] || 0,
    }))
    setEmployees(list)
  }

  async function loadEmployeeProjects(emp){
    const { data } = await supabase
      .from('transactions')
      .select('*, transaction_items(*, equipment(name))')
      .eq('user_id', emp.id)
      .order('created_at', { ascending: false })
    setSelectedEmployee(emp)
    setEmployeeProjects(data||[])
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
      <div style={{marginBottom:12, display:'flex', gap:8}}>
        <a href="/admin/verify"><button>الانتقال إلى صفحة التحقق من العهدة</button></a>
      </div>
      {msg && <div style={{color:'green'}}>{msg}</div>}

      <section style={{padding:'8px 0', borderTop:'1px solid #ddd'}}>
        <h3>الموظفين</h3>
        <ul>
          {employees.map(emp => (
            <li key={emp.id} style={{margin:'6px 0'}}>
              <button style={{background:'transparent', color:'#0B3A82'}} onClick={()=>loadEmployeeProjects(emp)}>
                {emp.name}
              </button>
              {' '}— عدد المشاريع المسجلة: {emp.projectsCount}
            </li>
          ))}
        </ul>
      </section>

      {selectedEmployee && (
        <section style={{padding:'8px 0', borderTop:'1px solid #ddd', marginTop:8}}>
          <h3>مشاريع الموظف: {selectedEmployee.name}</h3>
          <ul>
            {employeeProjects.map(p => (
              <li key={p.id} style={{marginBottom:8}}>
                <ProjectItem project={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* تمت إزالة قائمة التحقق من هذه الصفحة ونُقلت إلى /admin/verify */}
    </div>
  )
}
function ProjectItem({ project }){
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <div>
        <button style={{background:'transparent', color:'#0B3A82'}} onClick={()=>setExpanded(e=>!e)}>
          {project.project_name || 'مشروع'} — {project.project_owner || ''} — {statusArabic(project.status)}
        </button>
      </div>
      {expanded && (
        <ul style={{marginTop:6}}>
          {(project.transaction_items||[]).map(it=> (
            <li key={it.id}>
              {(it.equipment && it.equipment.name) || it.equipment_id} — كمية: {it.qty}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
