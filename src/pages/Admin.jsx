import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
  }
}

function formatDateTime(value){
  if(!value) return '—'
  try{
    return new Date(value).toLocaleString('ar-SA', { hour12: false })
  }catch(_){
    return value
  }
}

export default function Admin(){
  const [msg, setMsg] = useState('')
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeProjects, setEmployeeProjects] = useState([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

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
    setMsg('')
    await loadEmployees()
  }

  async function loadEmployees(){
    setIsLoadingEmployees(true)
    try{
      const resp = await fetch('/api/list-employees')
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok){
        throw new Error(json?.error || 'فشل جلب بيانات الموظفين')
      }
      setEmployees(json.employees || [])
    }catch(error){
      setMsg(`تعذّر جلب بيانات الموظفين: ${error.message}`)
      setEmployees([])
    }finally{
      setIsLoadingEmployees(false)
    }
  }

  async function loadEmployeeProjects(emp){
    setIsLoadingProjects(true)
    setSelectedEmployee(emp)
    try{
      const params = new URLSearchParams({ userId: emp.id })
      const resp = await fetch(`/api/employee-projects?${params.toString()}`)
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok){
        throw new Error(json?.error || 'فشل جلب مشاريع الموظف')
      }
      setEmployeeProjects(json.projects || [])
    }catch(error){
      setMsg(`تعذّر جلب مشاريع الموظف: ${error.message}`)
      setEmployeeProjects([])
    }finally{
      setIsLoadingProjects(false)
    }
  }

  return (
    <div>
      <h2>لوحة المشرف</h2>
      <div style={{marginBottom:12, display:'flex', gap:8}}>
        <Link to="/admin/verify" style={{textDecoration:'none'}}>
          <button type="button">الانتقال إلى صفحة التحقق من العهدة</button>
        </Link>
      </div>
      {msg && <div style={{color:'green'}}>{msg}</div>}

      <section style={{padding:'8px 0', borderTop:'1px solid #ddd'}}>
        <h3>الموظفين</h3>
        {isLoadingEmployees ? (
          <p>جاري تحميل بيانات الموظفين...</p>
        ) : employees.length === 0 ? (
          <p>لا يوجد موظفون مسجلون حالياً.</p>
        ) : (
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
        )}
      </section>

      {selectedEmployee && (
        <section style={{padding:'8px 0', borderTop:'1px solid #ddd', marginTop:8}}>
          <h3>مشاريع الموظف: {selectedEmployee.name}</h3>
          {isLoadingProjects ? (
            <p>جاري تحميل مشاريع الموظف...</p>
          ) : employeeProjects.length === 0 ? (
            <p>لم يتم تسجيل مشاريع لهذا الموظف بعد.</p>
          ) : (
            <ul>
              {employeeProjects.map(p => (
                <li key={p.id} style={{marginBottom:8}}>
                  <ProjectItem project={p} />
                </li>
              ))}
            </ul>
          )}
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
      <div style={{marginTop:4, lineHeight:1.6}}>
        <div>وقت الاستلام: {formatDateTime(project.checkout_time)}</div>
        <div>وقت التصوير: {formatDateTime(project.shoot_time)}</div>
        <div>وقت الإرجاع: {formatDateTime(project.return_time)}</div>
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
