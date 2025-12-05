import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home(){
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')

  useEffect(()=>{
    let mounted = true
    async function load(){
      try{
        const { data } = await supabase.auth.getUser()
        const user = data?.user || null
        if(!user){ if(mounted) setDisplayName(''); return }

        let candidate = user.user_metadata?.full_name || user.email || ''
        if(user.id){
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          if(profile?.full_name) candidate = profile.full_name
        }
        if(mounted) setDisplayName(candidate)
      }catch(e){ if(mounted) setDisplayName('') }
    }
    load()
    return ()=>{ mounted = false }
  },[])

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>مرحباً {displayName || 'فريق فالكنز'}</h1>
  <p>إنَّ اللهَ تعالى يُحِبُّ إذا عمِلَ أحدُكمْ عملًا أنْ يُتقِنَهُ.</p>
      </section>

      <section className="page-card">
        <h2>الإجراءات السريعة</h2>
        <p style={{color:'var(--text-muted)'}}>اختر المسار المناسب لعملك الحالي:</p>
        <div className="home-actions">
          <button type="button" onClick={()=>nav('/checkout')}>استلام عهدة</button>
          <button type="button" onClick={()=>nav('/return')}>تسليم العهدة</button>
          <button type="button" onClick={()=>nav('/admin')}>لوحة المشرف</button>
        </div>
      </section>
    </div>
  )
}
