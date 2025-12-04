import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home(){
  const nav = useNavigate()
  return (
    <div>
      <h2>مرحباً</h2>
      <p>اختر الإجراء:</p>
      <div style={{display:'flex', gap:12}}>
        <Link to="/checkout" role="button">استلام عهدة</Link>
        <Link to="/return" role="button" className="secondary">تسليم العهدة</Link>
      </div>
    </div>
  )
}
