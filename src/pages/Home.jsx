import React from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Home(){
  const nav = useNavigate()
  return (
    <div>
      <h2>مرحباً</h2>
      <p>اختر الإجراء:</p>
      <div style={{display:'flex', gap:12}}>
        <button onClick={()=>nav('/checkout')} style={{padding:12}}>استلام عهدة</button>
        <button onClick={()=>nav('/return')} style={{padding:12}}>تسليم العهدة</button>
        <button onClick={()=>nav('/admin')} style={{padding:12}}>لوحة المشرف</button>
      </div>
    </div>
  )
}
