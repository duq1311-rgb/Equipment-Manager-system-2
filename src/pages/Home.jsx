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
    <div>
      <h2>مرحباً {displayName || ''}</h2>
      <p>اختر الإجراء:</p>
      <div style={{display:'flex', gap:12}}>
        <button onClick={()=>nav('/checkout')} style={{padding:12}}>استلام عهدة</button>
        <button onClick={()=>nav('/return')} style={{padding:12}}>تسليم العهدة</button>
        <button onClick={()=>nav('/admin')} style={{padding:12}}>لوحة المشرف</button>
      </div>
    </div>
  )
}
