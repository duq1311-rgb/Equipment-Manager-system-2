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
      <h2>تسجيل دخول</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>البريد الإلكتروني</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label>كلمة السر</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button type="submit">دخول</button>
      </form>
      <div>{msg}</div>
    </div>
  )
}
