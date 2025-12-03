import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import ReturnPage from './pages/Return'
import Admin from './pages/Admin'
import ImportExcel from './pages/ImportExcel'

export default function App(){
  return (
    <div className="app">
      <nav>
        <Link to="/">Dashboard</Link> | <Link to="/checkout">اخذ معدات</Link> | <Link to="/return">ارجاع</Link> | <Link to="/import">استيراد معدات</Link> | <Link to="/admin">Admin</Link> | <Link to="/login">تسجيل دخول</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/" element={<Dashboard/>} />
          <Route path="/checkout" element={<Checkout/>} />
          <Route path="/return" element={<ReturnPage/>} />
          <Route path="/admin" element={<Admin/>} />
          <Route path="/import" element={<ImportExcel/>} />
        </Routes>
      </main>
    </div>
  )
}
