import React, { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import ReturnPage from './pages/Return'
import Home from './pages/Home'
import { supabase } from './lib/supabase'

// Lazy load heavy admin pages for better performance
const Admin = lazy(() => import('./pages/Admin'))
const AdminVerify = lazy(() => import('./pages/AdminVerify'))

export default function App(){
  const [user, setUser] = useState(null)
  const nav = useNavigate()
  const location = useLocation()
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

  function handleBackClick(){
    if(window.history?.state?.idx > 0){
      nav(-1)
    }else{
      nav('/')
    }
  }

  const canGoBack = location.pathname !== '/'

  return (
    <div className="app">
      {isAuthenticated && (
        <header className="app-topbar">
          <Link to="/" className="app-brand">
            <img src="/logo.png" alt="شعار نظام إدارة العهد" className="app-logo" />
            <span>نظام إدارة العهد</span>
          </Link>
          <button className="logout-btn" onClick={handleLogout}>تسجيل الخروج</button>
        </header>
      )}
      <main className={isAuthenticated ? 'with-topbar' : ''}>
        <div className="page-back-button">
          <button
            type="button"
            className="btn-outline"
            onClick={handleBackClick}
            disabled={!canGoBack}
          >
            رجوع
          </button>
        </div>
        <Routes>
          {isAuthenticated ? (
            <>
              <Route path="/" element={<Home/>} />
              <Route path="/dashboard" element={<Dashboard/>} />
              <Route path="/checkout" element={<Checkout/>} />
              <Route path="/return" element={<ReturnPage/>} />
              <Route path="/admin" element={
                <Suspense fallback={<div className="page-container"><div className="page-card" style={{textAlign:'center',padding:'40px'}}>جاري تحميل لوحة المشرف...</div></div>}>
                  <Admin/>
                </Suspense>
              } />
              <Route path="/admin/verify" element={
                <Suspense fallback={<div className="page-container"><div className="page-card" style={{textAlign:'center',padding:'40px'}}>جاري تحميل صفحة التحقق...</div></div>}>
                  <AdminVerify/>
                </Suspense>
              } />
              <Route path="/login" element={<Home/>} />
              <Route path="/*" element={<Home/>} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login/>} />
              <Route path="/*" element={<Login/>} />
            </>
          )}
        </Routes>
      </main>
    </div>
  )
}
