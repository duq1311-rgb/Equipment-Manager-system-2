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
    <div>
      <div className="login-header">
        <span className="title">نظام ادارة معدات التصوير</span>
        <img src="/logo.png" alt="Logo" onError={(e)=>{ e.currentTarget.style.display='none' }} />
      </div>
      <div className="login-wrapper">
        <div className="login-card">
          <div style={{textAlign:'center'}}>
            <img src="/logo.png" alt="Logo" style={{width:72, height:72, objectFit:'contain'}} onError={(e)=>{ e.currentTarget.style.display='none' }} />
            <div style={{fontWeight:600, marginTop:6}}>Team Falcons</div>
          </div>

          <h2>تسجيل الدخول</h2>
          <form onSubmit={handleSubmit}>
            <label>
              اسم المستخدم
              <input type="email" placeholder="example@email.com" value={email} onChange={e=>setEmail(e.target.value)} />
            </label>
            <label>
              كلمة المرور
              <input type="password" placeholder="•••••••" value={password} onChange={e=>setPassword(e.target.value)} />
            </label>
            <button type="submit">دخول</button>
          </form>
          {msg && <div style={{marginTop:8, color: msg.includes('خطأ')||msg.includes('error') ? 'red' : 'green'}}>{msg}</div>}
        </div>
      </div>
    </div>
  )
}
