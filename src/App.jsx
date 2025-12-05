import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import ReturnPage from './pages/Return'
import Admin from './pages/Admin'
import AdminVerify from './pages/AdminVerify'
// import ImportExcel from './pages/ImportExcel'
import Home from './pages/Home'
import { supabase } from './lib/supabase'

export default function App(){
  const [user, setUser] = useState(null)
  const nav = useNavigate()
  const isAuthenticated = !!user

  async function handleLogout(){
    try{
      if(supabase.auth?.signOut){
        await supabase.auth.signOut()
      }
    }catch(_error){ /* ignore */ }
    setUser(null)
    nav('/login')
  }

  useEffect(()=>{
    let mounted = true

    async function fetchUser(){
      try{
        const resp = await (supabase.auth?.getUser ? supabase.auth.getUser() : Promise.resolve({ data: { user: null } }))
        if(mounted){
          setUser(resp?.data?.user || null)
        }
      }catch(_error){
        if(mounted) setUser(null)
      }
    }

    fetchUser()

    const sub = supabase.auth?.onAuthStateChange?.((_event, session)=>{
      setUser(session?.user || null)
    }) || null

    return ()=>{
      mounted = false
      if(sub?.data?.subscription?.unsubscribe) sub.data.subscription.unsubscribe()
    }
  },[])

  return (
    <div className="app">
      <header className="app-topbar">
        <Link to={isAuthenticated ? '/' : '/login'} className="app-brand">
          <img src="/logo.png" alt="شعار نظام إدارة العهد" className="app-logo" />
          <span>نظام إدارة العهد</span>
        </Link>
        {isAuthenticated && (
          <button className="logout-btn" onClick={handleLogout}>تسجيل الخروج</button>
        )}
      </header>
      <main>
        <Routes>
          {isAuthenticated ? (
            <>
              <Route path="/" element={<Home/>} />
              <Route path="/dashboard" element={<Dashboard/>} />
              <Route path="/checkout" element={<Checkout/>} />
              <Route path="/return" element={<ReturnPage/>} />
              <Route path="/admin" element={<Admin/>} />
              <Route path="/admin/verify" element={<AdminVerify/>} />
              <Route path="/login" element={<Home/>} />
              <Route path="/*" element={<Home/>} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login/>} />
              <Route path="/*" element={<Login/>} />
            </>
          )}
          {/* صفحة الاستيراد أزيلت من الموقع */}
        </Routes>
      </main>
    </div>
  )
}
