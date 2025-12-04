import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import ReturnPage from './pages/Return'
import Admin from './pages/Admin'
// import ImportExcel from './pages/ImportExcel'
import Home from './pages/Home'
import { supabase } from './lib/supabase'

export default function App(){
  const [user, setUser] = useState(null)
  const nav = useNavigate()

  async function handleLogout(){
    try{
      if(supabase.auth && supabase.auth.signOut){
        await supabase.auth.signOut()
      }
    }catch(e){ /* ignore */ }
    nav('/login')
  }

  useEffect(()=>{
    let mounted = true
    async function getUser(){
      try{
        const resp = await (supabase.auth && supabase.auth.getUser ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }))
        if(mounted && resp && resp.data && resp.data.user) setUser(resp.data.user)
      }catch(e){
        // ignore
      }
    }
    getUser()
    const sub = (supabase.auth && supabase.auth.onAuthStateChange) ? supabase.auth.onAuthStateChange((event, session)=>{
      if(session && session.user) setUser(session.user)
      else setUser(null)
    }) : null

    return ()=>{ mounted = false; if(sub && sub.data && sub.data.unsubscribe) sub.data.unsubscribe() }
  },[])

  if(!user){
    // if not logged in, show only login page
    return (
      <div className="app">
        <main>
          <Routes>
            <Route path="/login" element={<Login/>} />
            <Route path="/*" element={<Login/>} />
          </Routes>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-topbar">
        <div className="left">
          <button className="logout-btn" onClick={handleLogout}>تسجيل الخروج</button>
        </div>
        <div className="right" />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/checkout" element={<Checkout/>} />
          <Route path="/return" element={<ReturnPage/>} />
          <Route path="/admin" element={<Admin/>} />
          {/* صفحة الاستيراد أزيلت من الموقع */}
        </Routes>
      </main>
    </div>
  )
}
