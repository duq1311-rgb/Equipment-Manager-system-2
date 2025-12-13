import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const READ_ONLY_ADMIN_UUIDS = [
  '6992bff2-1fbe-4991-84f3-9da4dcca9434',
  '7058bd02-a5bc-4c1e-a935-0b28c2c31976'
]

const SUPERVISOR_UUIDS = [
  'f32927f5-b616-44a3-88f5-5085fa951731',
  '85975a3c-e601-4c66-bed1-42ad6e953873'
]

const ALL_ADMIN_UUIDS = [...READ_ONLY_ADMIN_UUIDS, ...SUPERVISOR_UUIDS]

export default function Home(){
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState({ openTransactions: 0, totalProjects: 0, loading: true })
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(()=>{
    let mounted = true
    async function load(){
      try{
        const { data } = await supabase.auth.getUser()
        const user = data?.user || null
        if(!user){ if(mounted) setDisplayName(''); return }

        if(mounted) setCurrentUserId(user.id)

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
    async function loadStats(){
      try{
        const { data: userData } = await supabase.auth.getUser()
        const user = userData?.user || null
        if(!user) return

        const isAdmin = ALL_ADMIN_UUIDS.includes(user.id)

        let txQuery = supabase.from('transactions').select('id, user_id, status, transaction_items(admin_verified), transaction_assistants(assistant_user_id)')
        
        const { data: transactions } = await txQuery
        const allTransactions = transactions || []

        // فلترة المعاملات حسب المستخدم (إذا لم يكن أدمن)
        const userTransactions = isAdmin 
          ? allTransactions 
          : allTransactions.filter(t => {
              if(t.user_id === user.id) return true
              if((t.transaction_assistants || []).some(link => link.assistant_user_id === user.id)) return true
              return false
            })

        const openCount = userTransactions.filter(t => t.status === 'open').length
        const totalProjects = userTransactions.length
        
        if(mounted){
          setStats({
            openTransactions: openCount,
            totalProjects: totalProjects,
            loading: false
          })
        }
      }catch(e){
        if(mounted) setStats({ openTransactions: 0, totalProjects: 0, loading: false })
      }
    }
    load()
    loadStats()
    return ()=>{ mounted = false }
  },[])

  return (
    <div className="page-container">
      <section className="page-hero">
        <h1>مرحباً {displayName || 'فريق فالكنز'}</h1>
  <p>إنَّ اللهَ تعالى يُحِبُّ إذا عمِلَ أحدُكمْ عملًا أنْ يُتقِنَهُ.</p>
      </section>

      <section className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
      <section className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-label">العهد المفتوحة</div>
            <div className="stat-value">{stats.loading ? '...' : stats.openTransactions}</div>
          </div>
        </div>
        <div className="stat-card stat-card-info">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">إجمالي المشاريع</div>
            <div className="stat-value">{stats.loading ? '...' : stats.totalProjects}</div>
          </div>
        </div>
      </section>={{color:'var(--text-muted)'}}>اختر المسار المناسب لعملك الحالي:</p>
        <div className="home-actions">
          <button type="button" onClick={()=>nav('/checkout')}>استلام عهدة</button>
          <button type="button" onClick={()=>nav('/return')}>تسليم العهدة</button>
          <button type="button" onClick={()=>nav('/admin')}>لوحة المشرف</button>
        </div>
      </section>
    </div>
  )
}
