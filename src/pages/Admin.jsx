import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateTimeArabic, formatNumberArabic } from '../lib/locale'

function statusArabic(s){
  switch(s){
    case 'open': return 'عهدة مفتوحة'
    case 'closed': return 'عهدة مسلّمة'
    default: return s || ''
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
    <div className="page-container">
      <section className="page-hero">
        <h1>لوحة المشرف</h1>
        <p>إدارة الموظفين ومتابعة جميع المشاريع المسجلة لحظياً.</p>
        <div className="page-hero-actions">
          <Link to="/admin/verify" style={{textDecoration:'none'}}>
            <button type="button" className="btn-secondary">الانتقال إلى التحقق من العهدة</button>
          </Link>
        </div>
      </section>

      <section className="page-card">
        <h2>الموظفون</h2>
        {isLoadingEmployees ? (
          <p className="empty-state">جاري تحميل بيانات الموظفين...</p>
        ) : employees.length === 0 ? (
          <p className="empty-state">لا يوجد موظفون مسجلون حالياً.</p>
        ) : (
          <div className="list-tiles">
            {employees.map(emp => (
              <div key={emp.id} className="list-tile">
                <div>
                  <div style={{fontWeight:700}}>{emp.name}</div>
                  <small>عدد المشاريع: {formatNumberArabic(emp.projectsCount)}</small>
                </div>
                <button type="button" onClick={()=>loadEmployeeProjects(emp)}>عرض التفاصيل</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedEmployee && (
        <section className="page-card">
          <h2>مشاريع {selectedEmployee.name}</h2>
          {isLoadingProjects ? (
            <p className="empty-state">جاري تحميل مشاريع الموظف...</p>
          ) : employeeProjects.length === 0 ? (
            <p className="empty-state">لم يتم تسجيل مشاريع لهذا الموظف بعد.</p>
          ) : (
            <div className="projects-list">
              {employeeProjects.map(p => (
                <div key={p.id} className="project-card">
                  <ProjectItem project={p} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {msg && <div className="form-message">{msg}</div>}
    </div>
  )
}
function ProjectItem({ project }){
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap'}}>
        <div>
          <h4 style={{margin:'0 0 4px'}}>{project.project_name || 'مشروع بدون اسم'}</h4>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <span className="chip">{project.project_owner || 'بدون مالك'}</span>
            <span className="chip">{statusArabic(project.status)}</span>
          </div>
        </div>
        <button type="button" className="btn-outline" onClick={()=>setExpanded(e=>!e)}>
          {expanded ? 'إخفاء المعدات' : 'عرض المعدات'}
        </button>
      </header>

      <div className="project-timestamps">
  <div>وقت الاستلام: {formatDateTimeArabic(project.checkout_time)}</div>
  <div>وقت التصوير: {formatDateTimeArabic(project.shoot_time)}</div>
  <div>وقت الإرجاع: {formatDateTimeArabic(project.return_time)}</div>
      </div>

      {expanded && (
        <div className="equipment-items" style={{marginTop:12}}>
          {(project.transaction_items||[]).map(it=> (
            <div key={it.id} className="equipment-row" style={{boxShadow:'none', background:'rgba(241,245,255,0.7)'}}>
              <div style={{flex:1}}>{(it.equipment && it.equipment.name) || it.equipment_id}</div>
              <span className="chip">كمية: {formatNumberArabic(it.qty)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
