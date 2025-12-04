import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e){
    e.preventDefault()
    try{
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if(error) setMsg(error.message)
      else {
        setMsg('تم تسجيل الدخول')
        // redirect to home
        navigate('/')
      }
    }catch(err){
      setMsg(err.message || 'خطأ في تسجيل الدخول')
    }
  }

  return (
    <section style={{maxWidth:600, margin:'0 auto'}}>
      <header style={{textAlign:'center', marginBottom:12}}>
        {/* شعار الشركة */}
  <img src="/logo.png" alt="Company Logo" style={{width:120, height:120, objectFit:'contain', display:'inline-block'}} onError={(e)=>{ e.currentTarget.style.display='none' }} />
  <h2 style={{marginTop:8}}>نظام ادارة معدات التصوير</h2>
        <p style={{color:'#666'}}>Photography Equipment Management System</p>
      </header>

      <form onSubmit={handleSubmit}>
        <label>
          البريد الإلكتروني / Email
          <input type="email" placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label>
          كلمة السر / Password
          <input type="password" placeholder="•••••••" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <button type="submit">تسجيل الدخول / Login</button>
      </form>
      {msg && <div style={{marginTop:8, color: msg.includes('خطأ')||msg.includes('error') ? 'red' : 'green'}}>{msg}</div>}
    </section>
  )
}
