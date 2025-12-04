import React from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Home(){
  const nav = useNavigate()
  return (
    <section className="card">
      <h2>مرحباً</h2>
      <p>اختر الإجراء:</p>
      <div style={{display:'flex', gap:12}}>
        <Link to="/checkout" role="button">استلام عهدة</Link>
        <Link to="/return" role="button" className="secondary">تسليم العهدة</Link>
      </div>
    </section>
  )
}
