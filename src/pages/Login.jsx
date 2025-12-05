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
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if(error){
        setMsg(error.message)
      }else{
        setMsg('تم تسجيل الدخول')
        navigate('/')
      }
    }catch(err){
      setMsg(err.message || 'خطأ في تسجيل الدخول')
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo-block">
          <img
            src="/logo.png"
            alt="شعار نظام إدارة العهد"
            className="login-logo"
            onError={(e)=>{ e.currentTarget.style.display='none' }}
          />
          <div className="login-team">Team Falcons</div>
        </div>

        <h2>تسجيل الدخول</h2>
        <p className="login-subtitle">نظام ادارة معدات التصوير</p>

        <form onSubmit={handleSubmit} className="login-form">
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
        {msg && (
          <div className={`login-message ${msg.includes('خطأ') || msg.includes('error') ? 'login-message-error' : 'login-message-success'}`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}
