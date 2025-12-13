import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home(){
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState({ openTransactions: 0, pendingVerification: 0, totalEquipment: 0, loading: true })

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
    async function loadStats(){
      try{
        const [txRes, equipRes] = await Promise.all([
          supabase.from('transactions').select('id, status, transaction_items(admin_verified)'),
          supabase.from('equipment').select('id', { count: 'exact', head: true })
        ])
        
        const transactions = txRes.data || []
        const openCount = transactions.filter(t => t.status === 'open').length
        const pendingCount = transactions.filter(t => 
          t.status === 'open' && (t.transaction_items || []).some(it => !it.admin_verified)
        ).length
        
        if(mounted){
          setStats({
            openTransactions: openCount,
            pendingVerification: pendingCount,
            totalEquipment: equipRes.count || 0,
            loading: false
          })
        }
      }catch(e){
        if(mounted) setStats({ openTransactions: 0, pendingVerification: 0, totalEquipment: 0, loading: false })
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
            <div className="stat-label">العهد المفتوحة</div>
            <div className="stat-value">{stats.loading ? '...' : stats.openTransactions}</div>
          </div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-label">بانتظار التحقق</div>
            <div className="stat-value">{stats.loading ? '...' : stats.pendingVerification}</div>
          </div>
        </div>
        <div className="stat-card stat-card-info">
          <div className="stat-icon">🎬</div>
          <div className="stat-content">
            <div className="stat-label">إجمالي المعدات</div>
            <div className="stat-value">{stats.loading ? '...' : stats.totalEquipment}</div>
          </div>
        </div>
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
