import React, { useEffect, useMemo, useState } from 'react'
console.log('Admin.jsx loaded')
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// الأدمن (مشاهدة فقط - بدون صلاحيات تعديل/حذف)
const READ_ONLY_ADMIN_UUIDS = [
  '6992bff2-1fbe-4991-84f3-9da4dcca9434',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976'
]

// المشرفين (كل الصلاحيات)
const SUPERVISOR_UUIDS = [
  'f32927f5-b616-44a3-88f5-5085fa951731', // عبدالعزيز الغامدي
  '85975a3c-e601-4c66-bed1-42ad6e953873'  // تركي العسبلي
]

// جميع من لديهم صلاحية دخول لوحة الأدمن
const FALLBACK_ADMIN_UUIDS = [
  ...READ_ONLY_ADMIN_UUIDS,
  ...SUPERVISOR_UUIDS
]

const ADMIN_ONLY_NAMES = {
  '6992bff2-1fbe-4991-84f3-9da4dcca9434': 'مشرف',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976': 'مشرف إضافي',
  'f32927f5-b616-44a3-88f5-5085fa951731': 'عبدالعزيز الغامدي',
  '85975a3c-e601-4c66-bed1-42ad6e953873': 'تركي العسبلي'
}

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
    return new Date(value).toLocaleString('en-US', { hour12: false })
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
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [lastLoadedRange, setLastLoadedRange] = useState({ from: '', to: '' })
  const [deletingProjectId, setDeletingProjectId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isReadOnlyAdmin, setIsReadOnlyAdmin] = useState(false)

  useEffect(()=>{ secureAdminAndLoad() }, [])

  async function secureAdminAndLoad(){
    // حماية صفحة الأدمن عبر UUID
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    // استخدام قيمة البيئة أو قيمة احتياطية مؤقتة
    const ADMIN_UUIDS = Array.from(new Set([
      ...String(import.meta.env.VITE_ADMIN_UUID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
      ...FALLBACK_ADMIN_UUIDS
    ]))
    if(!user || ADMIN_UUIDS.length===0 || !ADMIN_UUIDS.includes(user.id)){
      setMsg('ليست لديك صلاحية الدخول إلى لوحة المشرف')
      // إعادة توجيه سريع إلى الصفحة الرئيسية
      setTimeout(()=>{ window.location.href = '/' }, 1200)
      return
    }
    // تحديد نوع المستخدم
    setCurrentUserId(user.id)
    setIsReadOnlyAdmin(READ_ONLY_ADMIN_UUIDS.includes(user.id))
    setMsg('')
    await loadEmployees()
  }

  async function loadEmployees(){
    setIsLoadingEmployees(true)
    try{
      // قراءة الموظفين مباشرة من Supabase
      const [
        { data: profiles, error: profilesError },
        { data: transactions, error: txError },
        { data: assistantLinks, error: assistantsError }
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name'),
        supabase.from('transactions').select('id, user_id, assistant_user_id'),
        supabase.from('transaction_assistants').select('transaction_id, assistant_user_id')
      ])

      if(profilesError) throw profilesError
      if(txError) throw txError
      if(assistantsError) throw assistantsError

      // حساب عدد المشاريع لكل موظف (كصاحب مشروع أو مساعد)
      const countMap = {}
      
      function increment(id){
        if(!id) return
        countMap[id] = (countMap[id] || 0) + 1
      }

      // إنشاء خريطة للمساعدين لكل transaction
      const assistantsByTransaction = new Map()
      ;(assistantLinks || []).forEach(link => {
        if(!link.transaction_id || !link.assistant_user_id) return
        const set = assistantsByTransaction.get(link.transaction_id) || new Set()
        if(!set.has(link.assistant_user_id)){
          set.add(link.assistant_user_id)
          increment(link.assistant_user_id)
        }
        assistantsByTransaction.set(link.transaction_id, set)
      })

      // عد المشاريع (صاحب + مساعد قديم في نفس الجدول)
      ;(transactions || []).forEach(tx => {
        increment(tx.user_id)
        const assistantsForTransaction = assistantsByTransaction.get(tx.id)
        if((!assistantsForTransaction || assistantsForTransaction.size === 0) && tx.assistant_user_id){
          increment(tx.assistant_user_id)
        }
      })

      // تحويل البيانات للصيغة المطلوبة واستبعاد الأدمن
      const ADMIN_IDS = new Set(READ_ONLY_ADMIN_UUIDS)
      
      const employeesList = (profiles || [])
        .filter(profile => !ADMIN_IDS.has(profile.id)) // استبعاد الأدمن فقط
        .map(profile => ({
          id: profile.id,
          name: profile.full_name || profile.id,
          email: '',
          projectsCount: countMap[profile.id] || 0
        }))

      setEmployees(employeesList)
    }catch(error){
      setMsg(`تعذّر جلب بيانات الموظفين: ${error.message}`)
      setEmployees([])
    }finally{
      setIsLoadingEmployees(false)
    }
  }

  const employeeNameMap = useMemo(()=>{
    const map = {}
    employees.forEach(emp => {
      if(emp?.id) map[emp.id] = emp.name || emp.email || emp.id
    })
    Object.entries(ADMIN_ONLY_NAMES).forEach(([id, name]) => {
      if(!map[id]) map[id] = name
    })
    return map
  }, [employees])

  function getEmployeeName(id){
    if(!id) return '—'
    return employeeNameMap[id] || id
  }

  function handleSelectEmployee(emp){
    if(!emp) return
    setMsg('')
    setFilterFrom('')
    setFilterTo('')
    setLastLoadedRange({ from: '', to: '' })
    loadEmployeeProjects(emp, { from: '', to: '' })
  }

  async function loadEmployeeProjects(emp, options = {}){
    if(!emp) return
    console.log('emp.id', emp?.id)
    setIsLoadingProjects(true)
    setSelectedEmployee(emp)
    try{
      const fromValue = typeof options.from === 'string' ? options.from : filterFrom
      const toValue = typeof options.to === 'string' ? options.to : filterTo
      const params = new URLSearchParams({ userId: emp.id })
      if(fromValue) params.append('from', fromValue)
      if(toValue) params.append('to', toValue)
      // عند جلب المشاريع
      const resp = await fetch(`/api/employee-projects?${params.toString()}`, { cache: 'no-store' })
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok){
        throw new Error(json?.error || 'فشل جلب مشاريع الموظف')
      }
      setMsg('')
      setEmployeeProjects((json.projects || []).map(project => ({
        ...project,
        assignment_role: project.assignment_role || (project.user_id === emp.id ? 'owner' : 'assistant')
      })))
      setLastLoadedRange({ from: fromValue || '', to: toValue || '' })
    }catch(error){
      setMsg(`تعذّر جلب مشاريع الموظف: ${error.message}`)
      setEmployeeProjects([])
    }finally{
      setIsLoadingProjects(false)
    }
  }

  function handleApplyFilters(){
    if(!selectedEmployee){
      setMsg('رجاء اختر موظفاً أولاً لعرض سجله.')
      return
    }
    if(filterFrom && filterTo && new Date(filterFrom) > new Date(filterTo)){
      setMsg('تاريخ البداية يجب أن يسبق تاريخ النهاية.')
      return
    }
    setMsg('')
    loadEmployeeProjects(selectedEmployee, { from: filterFrom, to: filterTo })
  }

  async function handleDeleteProject(project){
    if(!project?.id) return
    const confirmed = window.confirm(`هل أنت متأكد من حذف مشروع "${project.project_name || 'بدون اسم'}"؟ سيتم إعادة العهدة إلى المخزون.`)
    if(!confirmed) return
    setDeletingProjectId(project.id)
    setMsg('')
    try{
      const { data: sessionRes } = await supabase.auth.getSession()
      const token = sessionRes?.session?.access_token || ''
      const resp = await fetch('/api/delete-transaction', { method: 'POST', body: JSON.stringify({ id: project.id }), headers: { 'Content-Type': 'application/json' }, cache: 'no-store' })
      const json = await resp.json().catch(()=>({}))
      if(!resp.ok){
        throw new Error(json?.error || 'فشل حذف المشروع')
      }
      setEmployeeProjects(prev => prev.filter(p => p.id !== project.id))
      setMsg('تم حذف المشروع وإرجاع المعدات للمخزون')
    }catch(error){
      setMsg(error.message || 'تعذر حذف المشروع')
    }finally{
      setDeletingProjectId(null)
    }
  }

  function handlePrint(){
    if(!selectedEmployee){
      setMsg('اختر موظفاً لطباعة سجله.')
      return
    }
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if(!printWindow) return

    const preparedRange = (lastLoadedRange.from || lastLoadedRange.to)
      ? `الفترة: ${lastLoadedRange.from || 'غير محدد'} → ${lastLoadedRange.to || 'غير محدد'}`
      : 'الفترة: جميع التواريخ'

    const logoUrl = `${window.location.origin}/logo.png`

    const projectsHtml = employeeProjects.length
      ? employeeProjects.map(project => {
        const assistants = Array.isArray(project.assistants) && project.assistants.length
          ? Array.from(new Set(project.assistants.filter(Boolean))).map(id => `<span class="chip">${getEmployeeName(id)}</span>`).join(' ')
          : '<span class="chip chip-muted">لا يوجد مساعدين</span>'
        const items = (project.transaction_items || []).map(item => {
          const itemName = (item?.equipment && item.equipment.name) || item?.equipment_id || 'معدة'
          return `<li>${itemName} — كمية: ${item?.qty ?? 0}</li>`
        }).join('') || '<li>لا توجد معدات مسجلة</li>'
        const roleLabel = project.assignment_role === 'assistant'
          ? 'دور الموظف: مساعد'
          : project.assignment_role === 'owner'
            ? 'دور الموظف: مسؤول'
            : ''

        return `
          <article class="project-card">
            <header>
              <div>
                <h2>${project.project_name || 'مشروع بدون اسم'}</h2>
                <div class="meta-row">
                  <span class="chip">${project.project_owner || 'بدون مالك'}</span>
                  <span class="chip">${statusArabic(project.status)}</span>
                  ${roleLabel ? `<span class="chip">${roleLabel}</span>` : ''}
                </div>
              </div>
            </header>
            <section class="assistants">
              <strong>المساعدون:</strong>
              <div class="chips">${assistants}</div>
            </section>
            <section class="timeline">
              <div>وقت الاستلام: ${formatDateTime(project.checkout_time)}</div>
              <div>وقت التصوير: ${formatDateTime(project.shoot_time)}</div>
              <div>وقت الإرجاع: ${formatDateTime(project.return_time)}</div>
            </section>
            <section>
              <strong>المعدات:</strong>
              <ul>${items}</ul>
            </section>
          </article>
        `
      }).join('')
      : '<p class="empty">لا توجد سجلات ضمن النطاق الحالي.</p>'

    const generatedAt = new Date().toLocaleString('en-US', { hour12: false })
    const styles = `
      body{ font-family:'Cairo','Inter',sans-serif; direction:rtl; padding:24px; color:#102044; }
      .print-header{ display:flex; align-items:center; gap:18px; margin-bottom:18px; direction:ltr; }
      .print-logo{ width:80px; height:80px; object-fit:contain; border-radius:18px; background:#fff; box-shadow:0 8px 18px rgba(11,58,130,0.15); padding:10px; }
      .print-text{ direction:rtl; flex:1; }
      .print-text h1{ margin:0 0 6px; font-size:1.6rem; color:#0B3A82; }
      .header-meta{ color:#5E6A88; display:flex; flex-direction:column; gap:4px; }
      .project-card{ border:1px solid rgba(11,58,130,0.12); border-radius:16px; padding:16px; margin-bottom:16px; }
      .project-card h2{ margin:0 0 8px; color:#0B3A82; font-size:1.2rem; }
      .meta-row{ display:flex; flex-wrap:wrap; gap:8px; }
      .chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#F3F6FE; font-size:0.85rem; }
      .chip-muted{ background:#f0f0f0; color:#626262; }
      .chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
      ul{ margin:6px 0 0; padding-inline-start:20px; }
      .timeline{ margin:10px 0; color:#5E6A88; display:grid; gap:4px; font-size:0.92rem; }
      .empty{ color:#5E6A88; }
    `

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar">
        <head>
          <meta charSet="utf-8" />
          <title>سجل ${selectedEmployee.name}</title>
          <style>${styles}</style>
        </head>
        <body>
          <header class="print-header">
            <img src="${logoUrl}" alt="شعار النظام" class="print-logo" />
            <div class="print-text">
              <h1>سجل العهدة للموظف ${selectedEmployee.name || selectedEmployee.email || selectedEmployee.id}</h1>
              <div class="header-meta">
                <div>${preparedRange}</div>
                <div>تاريخ التحضير: ${generatedAt}</div>
              </div>
            </div>
          </header>
          ${projectsHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(()=>{ printWindow.print() }, 150)
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
            {employees.map(emp => {
              console.log('Render employee:', emp);
              return (
                <div key={emp.id} className="list-tile">
                  <div>
                    <div style={{fontWeight:700}}>{emp.name}</div>
                    <small>عدد المشاريع: {emp.projectsCount}</small>
                  </div>
                  <button type="button" onClick={()=>handleSelectEmployee(emp)}>عرض التفاصيل</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedEmployee && (
        <section className="page-card">
          <h2>مشاريع {selectedEmployee.name}</h2>
          <div className="filter-bar">
            <div className="filter-field">
              <label htmlFor="date-from">من تاريخ</label>
              <input id="date-from" type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
            </div>
            <div className="filter-field">
              <label htmlFor="date-to">إلى تاريخ</label>
              <input id="date-to" type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
            </div>
            <button type="button" className="btn-outline" onClick={handleApplyFilters} disabled={isLoadingProjects}>تطبيق الفلتر</button>
            <button type="button" className="btn-primary" onClick={handlePrint} disabled={isLoadingProjects}>طباعة السجل</button>
          </div>
          {isLoadingProjects ? (
            <p className="empty-state">جاري تحميل مشاريع الموظف...</p>
          ) : employeeProjects.length === 0 ? (
            <p className="empty-state">لم يتم تسجيل مشاريع لهذا الموظف بعد.</p>
          ) : (
            <div className="projects-list">
              {employeeProjects.map(p => (
                <div key={p.id} className="project-card">
                  <ProjectItem
                    project={p}
                    getEmployeeName={getEmployeeName}
                    onDelete={isReadOnlyAdmin ? null : handleDeleteProject}
                    deletingProjectId={deletingProjectId}
                  />
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
function ProjectItem({ project, getEmployeeName, onDelete, deletingProjectId }){
  const [expanded, setExpanded] = useState(false)
  const ownerName = project.user_id ? getEmployeeName(project.user_id) : null
  const assistantIdsSet = new Set()
  if(Array.isArray(project.assistants)){
    project.assistants.forEach(id => { if(id) assistantIdsSet.add(id) })
  }
  if(project.assistant_user_id) assistantIdsSet.add(project.assistant_user_id)
  if(Array.isArray(project.transaction_assistants)){
    project.transaction_assistants.forEach(link => {
      if(link?.assistant_user_id) assistantIdsSet.add(link.assistant_user_id)
    })
  }
  const assistantIds = Array.from(assistantIdsSet)
  const role = project.assignment_role === 'assistant' ? 'دورك: مساعد' : project.assignment_role === 'owner' ? 'دورك: مسؤول' : null
  return (
    <div>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap'}}>
        <div>
          <h4 style={{margin:'0 0 4px'}}>{project.project_name || 'مشروع بدون اسم'}</h4>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <span className="chip">{project.project_owner || 'بدون مالك'}</span>
            <span className="chip">{statusArabic(project.status)}</span>
            {ownerName && <span className="chip">المسؤول: {ownerName}</span>}
            {assistantIds.map(id => (
              <span key={`${project.id}-assistant-${id}`} className="chip">المساعد: {getEmployeeName(id)}</span>
            ))}
            {role && <span className="chip">{role}</span>}
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button type="button" className="btn-outline" onClick={()=>setExpanded(e=>!e)}>
            {expanded ? 'إخفاء المعدات' : 'عرض المعدات'}
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={()=>onDelete(project)}
              disabled={deletingProjectId === project.id}
            >
              {deletingProjectId === project.id ? 'جاري الحذف...' : 'حذف المشروع'}
            </button>
          )}
        </div>
      </header>

      <div className="project-timestamps">
        <div>وقت الاستلام: {formatDateTime(project.checkout_time)}</div>
        <div>وقت التصوير: {formatDateTime(project.shoot_time)}</div>
        <div>وقت الإرجاع: {formatDateTime(project.return_time)}</div>
      </div>

      {expanded && (
        <div className="equipment-items" style={{marginTop:12}}>
          {(project.transaction_items||[]).map(it=> (
            <div key={it.id} className="equipment-row" style={{boxShadow:'none', background:'rgba(241,245,255,0.7)'}}>
              <div style={{flex:1}}>{(it.equipment && it.equipment.name) || it.equipment_id}</div>
              <span className="chip">كمية: {it.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
