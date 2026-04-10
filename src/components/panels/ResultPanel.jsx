import { useRef, useEffect, useState } from 'react'
import Chart from 'chart.js/auto'
import useSimStore from '../../store/simulationStore'

// ── Face icon ──
const FACE = {
  good:    { emoji:'😊', bg:'#dcfce7', border:'#86efac', color:'#15803d' },
  neutral: { emoji:'😐', bg:'#fef9c3', border:'#fde047', color:'#a16207' },
  caution: { emoji:'😟', bg:'#ffedd5', border:'#fdba74', color:'#c2410c' },
  bad:     { emoji:'😠', bg:'#fee2e2', border:'#fca5a5', color:'#b91c1c' },
}
function FaceIcon({ level, size=40 }) {
  const t = FACE[level] || FACE.neutral
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:size, height:size, borderRadius:size*0.28,
      background:t.bg,
      fontSize:size*0.52, lineHeight:1, userSelect:'none',
    }}>
      {t.emoji}
    </span>
  )
}

// ── 전시 건강도 점수 카드 (redesigned) ──
function HealthScoreCard({ flowEff, convRate, avgWait, avgSkipRate, setTab }) {
  const s1 = Math.min(100, flowEff ?? 0)
  const s2 = Math.min(100, convRate ?? 0)
  const s3 = avgWait != null ? Math.max(0, 100 - avgWait * 2.5) : 50
  const s4 = avgSkipRate != null ? Math.max(0, 100 - avgSkipRate * 1.5) : 50
  const score = Math.round(s1 * 0.3 + s2 * 0.3 + s3 * 0.2 + s4 * 0.2)

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
  const gradeColor = grade === 'A' ? '#16a34a' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#d97706' : '#ef4444'
  const gradeBg    = grade === 'A' ? '#f0fdf4' : grade === 'B' ? '#eff6ff' : grade === 'C' ? '#fffbeb' : '#fef2f2'
  const gradeText  = grade === 'A' ? '우수한 전시 운영 상태입니다' : grade === 'B' ? '일부 개선으로 완성도를 높일 수 있습니다' : grade === 'C' ? '주요 지표에 개선이 필요합니다' : '즉각적인 개선 조치가 필요합니다'

  const subScores = [
    { label: '동선 도달률', val: s1, color: '#18181b' },
    { label: '체험 전환율', val: s2, color: '#3b82f6' },
    { label: '혼잡도',     val: s3, color: '#d97706' },
    { label: '참여도',     val: s4, color: '#7c3aed' },
  ]

  const metricPills = [
    { label: '도달률',   raw: flowEff != null ? `${flowEff}%` : '-' },
    { label: '전환율',   raw: convRate != null ? `${convRate}%` : '-' },
    { label: '혼잡도',   raw: avgWait != null ? `${avgWait}초` : '-' },
    { label: '스킵율',   raw: avgSkipRate != null ? `${avgSkipRate}%` : '-' },
  ]

  return (
    <div style={{
      background: '#18181b',
      borderRadius: 4,
      padding: '20px 24px',
      marginBottom: 16,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 5px rgba(0,0,0,.14), 0 1px 10px rgba(0,0,0,.12), 0 2px 4px rgba(0,0,0,.20)',
    }}>
      {/* subtle background accent */}
      <div style={{
        position: 'absolute', right: -30, top: -30,
        width: 160, height: 160, borderRadius: '50%',
        background: `${gradeColor}18`, pointerEvents: 'none',
      }}/>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        {/* Score + Grade */}
        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 72 }}>
          <div style={{
            fontSize: 52, fontWeight: 900, color: gradeColor,
            lineHeight: 1, letterSpacing: '-0.03em',
          }}>{score}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginTop: 2 }}>/ 100</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: `${gradeColor}22`, border: `2px solid ${gradeColor}`,
            marginTop: 8,
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: gradeColor }}>{grade}</span>
          </div>
        </div>

        {/* Right side */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 4, letterSpacing: '0.0125em' }}>
            전시 건강도
          </div>
          <div style={{ fontSize: 12, color: '#BBDEFB', fontWeight: 400, marginBottom: 12 }}>
            {gradeText}
          </div>

          {/* Metric pills row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {metricPills.map(m => (
              <span key={m.label} style={{
                background: 'rgba(255,255,255,0.12)', borderRadius: 4,
                padding: '3px 10px', fontSize: 10, color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{m.label} </span>
                <strong style={{ color: '#fff', fontWeight: 500 }}>{m.raw}</strong>
              </span>
            ))}
          </div>

          {/* Sub-score bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subScores.map(ss => (
              <div key={ss.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 400, minWidth: 60, flexShrink: 0 }}>{ss.label}</span>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, ss.val)}%`,
                    background: ss.color,
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }}/>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 500, minWidth: 30, textAlign: 'right' }}>{Math.round(ss.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {(grade === 'C' || grade === 'D') && setTab && (
          <button onClick={() => setTab('build')} style={{
            flexShrink: 0, alignSelf: 'center',
            background: gradeColor, color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 14px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 2px 12px ${gradeColor}50`, whiteSpace: 'nowrap',
          }}>
            Build →
          </button>
        )}
      </div>
    </div>
  )
}

// ── 개선 액션 플랜 constants ──
const ACTION_PRIORITY = {
  urgent:    { label: '긴급', color: '#ef4444', bg: '#fef2f2', dot: '🔴' },
  recommend: { label: '권장', color: '#d97706', bg: '#fffbeb', dot: '🟡' },
  maintain:  { label: '유지', color: '#16a34a', bg: '#f0fdf4', dot: '🟢' },
}
const ACTION_CATEGORY = {
  zone:     '구역 배치',
  media:    '미디어 설정',
  content:  '콘텐츠',
  flow:     '동선 유도',
  capacity: '수용 인원',
}

// ── ActionCard (redesigned) ──
function ActionCard({ priority, category, title, detail, onBuild, setTab }) {
  const p = ACTION_PRIORITY[priority]
  return (
    <div style={{
      background: '#fff',
      borderRadius: '0 4px 4px 0',
      padding: '12px 16px',
      marginBottom: 8,
      boxShadow: '0 2px 2px rgba(0,0,0,.14), 0 3px 1px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.20)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      borderLeft: `4px solid ${p.color}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: p.color,
            background: p.bg, borderRadius: 4, padding: '2px 7px',
            border: `1px solid ${p.color}30`, letterSpacing: '0.02em',
          }}>{p.label}</span>
          <span style={{
            fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600,
            background: 'var(--color-bg-section)', borderRadius: 3, padding: '1px 5px',
          }}>{ACTION_CATEGORY[category] || category}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', marginBottom: detail ? 3 : 0, lineHeight: 1.4, letterSpacing: '0.0125em' }}>{title}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, letterSpacing: '0.01786em' }}>{detail}</div>}
      </div>
      {setTab && (
        <button onClick={() => setTab('build')} style={{
          flexShrink: 0, background: 'transparent', border: 'none',
          borderRadius: 4, padding: '5px 8px', fontSize: 12, fontWeight: 500,
          color: '#18181b', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center',
          letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>
          BUILD
        </button>
      )}
    </div>
  )
}

// ── Priority section banner ──
function PriorityBanner({ dot, label, count, color, bg, borderColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: bg, border: `1px solid ${borderColor || color + '30'}`,
      borderRadius: 4, padding: '8px 14px', marginBottom: 8, marginTop: 4,
    }}>
      <span style={{ fontSize: 14 }}>{dot}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
        {label} {count}건
      </span>
      <span style={{ fontSize: 10, color, opacity: 0.75, marginLeft: 'auto' }}>
        {label === '긴급' ? '즉시 개선 필요' : label === '권장' ? '개선 시 효과 기대' : '현재 상태 유지'}
      </span>
    </div>
  )
}

// ── MD2 Section title helper ──
function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: 'var(--color-text)',
          letterSpacing: '0.0125em',
        }}>{children}</span>
        {sub && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-secondary)' }}>{sub}</span>}
      </div>
    </div>
  )
}

// ── ReportView ──
function ReportView({ data, visible=true, setTab }) {
  const chartRef = useRef(null)
  const chartInst = useRef(null)
  const { slotResults: srs=[], zones: rzones=[], rangeLabel='' } = data||{}
  const multiFloor = rzones.some(z=>z.floor>0)
  const zLabel = z => multiFloor ? `${z.name} (Area ${z.floor+1})` : z.name
  const totV = srs.reduce((s,r)=>s+r.visitors,0)
  const avgSR = srs.length ? Math.round(srs.reduce((s,r)=>s+r.skipRate,0)/srs.length) : 0
  const engNums = srs.map(r=>parseFloat(r.engIdx)).filter(n=>!isNaN(n))
  const avgEng = engNums.length ? (engNums.reduce((s,n)=>s+n,0)/engNums.length).toFixed(1) : '-'
  const totBN = srs.reduce((s,r)=>s+r.bottlenecks,0)
  const allMedia = rzones.flatMap(z=>z.media.map(m=>({...m,zoneName:zLabel(z)}))).sort((a,b)=>b.skipRate-a.skipRate)
  const gradeOf = sr => sr>50?{g:'D',c:'var(--color-error)',bg:'var(--color-error-bg)'}:sr>20?{g:'C',c:'var(--color-warning)',bg:'var(--color-warning-bg)'}:sr>10?{g:'B',c:'var(--color-info)',bg:'var(--color-info-bg)'}:{g:'A',c:'var(--color-success)',bg:'var(--color-success-bg)'}
  const starsOf = eng => { if(eng===null) return '-'; const f=Math.round(eng); return '★'.repeat(f)+'☆'.repeat(Math.max(0,5-f)) }

  useEffect(()=>{
    if (!visible || !chartRef.current || !rzones.length) return
    if (chartInst.current) chartInst.current.destroy()
    const mf = rzones.some(z=>z.floor>0)
    const lb = z => mf?`${z.name} (Area ${z.floor+1})`:z.name
    const ctx2 = chartRef.current.getContext('2d')
    const gradBar = ctx2.createLinearGradient(0,0,0,200)
    gradBar.addColorStop(0,'rgba(29,158,117,0.85)')
    gradBar.addColorStop(1,'rgba(29,158,117,0.25)')
    const gradLine = ctx2.createLinearGradient(0,0,0,200)
    gradLine.addColorStop(0,'rgba(99,102,241,0.18)')
    gradLine.addColorStop(1,'rgba(99,102,241,0)')
    chartInst.current = new Chart(chartRef.current, {
      type:'bar',
      data:{ labels:rzones.map(lb), datasets:[
        {
          label:'진입수', data:rzones.map(z=>z.entries||0),
          backgroundColor:gradBar, borderRadius:6, borderSkipped:false,
          yAxisID:'y', order:2,
        },
        {
          label:'전환율', data:rzones.map(z=>z.convRate||0),
          type:'line', borderColor:'#6366f1', backgroundColor:gradLine,
          pointBackgroundColor:'#fff', pointBorderColor:'#6366f1',
          pointRadius:4, pointHoverRadius:6, pointBorderWidth:2,
          borderWidth:2, tension:0.4, fill:true, yAxisID:'y1', order:1,
        },
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{
          legend:{ display:true, position:'top', align:'end', labels:{ font:{size:11,weight:'500'}, color:'#71717a', boxWidth:10, boxHeight:10, borderRadius:3, padding:16, usePointStyle:true } },
          tooltip:{
            backgroundColor:'rgba(15,25,20,0.85)', titleFont:{size:11,weight:'600'}, bodyFont:{size:11},
            padding:10, cornerRadius:8, boxPadding:4,
            callbacks:{ label: ctx=>ctx.dataset.label==='전환율'?` ${ctx.parsed.y}%`:` ${ctx.parsed.y}명` }
          }
        },
        scales:{
          y:{
            beginAtZero:true, position:'left',
            grid:{ color:'rgba(0,0,0,0.04)', drawBorder:false },
            border:{ display:false },
            ticks:{ color:'#a1a1aa', font:{size:10}, maxTicksLimit:5 },
          },
          y1:{
            beginAtZero:true, max:100, position:'right',
            grid:{ display:false }, border:{ display:false },
            ticks:{ color:'#a5b4fc', font:{size:10}, callback:v=>v+'%', maxTicksLimit:5 },
          },
          x:{
            grid:{ display:false }, border:{ display:false },
            ticks:{ color:'#999', font:{size:10}, maxRotation:0 },
          }
        }
      }
    })
    return ()=>{ if(chartInst.current){ chartInst.current.destroy(); chartInst.current=null } }
  }, [visible, rzones])

  if (!srs.length && !rzones.length) return null

  // Pre-compute summary metrics
  const _visitedZones = rzones.filter(z=>z.entries>0).length
  const _totalZones = rzones.length
  const _flowEffNum = _totalZones>0 ? Math.round(_visitedZones/_totalZones*100) : (data?.flowEff||0)
  const _totEnt = rzones.reduce((s,z)=>s+(z.entries||0),0)
  const _totEnged = rzones.reduce((s,z)=>s+(z.engaged||0),0)
  const _engRateNum = _totEnt>0 ? Math.round(_totEnged/_totEnt*100) : (data?.engRate||0)
  const _totWaitW = rzones.reduce((s,z)=>s+(z.avgWait||0)*(z.entries||0),0)
  const _avgWait = _totEnt>0 ? Math.round(_totWaitW/_totEnt) : (data?.avgWait||0)

  // Pre-compute action plan for brief summary
  const _urgentCount = (()=>{
    let n = 0
    rzones.filter(z=>(z.avgWait||0)>20).forEach(()=>n++)
    allMedia.filter(m=>m.skipRate>50&&m.exposure>0).forEach(()=>n++)
    if (_totEnt>0 && _engRateNum<20) n++
    return n
  })()

  return (<>
    {/* ── 전시 건강도 ── */}
    {(_totalZones > 0 || srs.length > 0) && (
      <HealthScoreCard
        flowEff={_flowEffNum}
        convRate={_engRateNum}
        avgWait={_avgWait}
        avgSkipRate={avgSR}
        setTab={setTab}
      />
    )}

    {/* ── Brief narrative summary ── */}
    {(_totalZones > 0 || srs.length > 0) && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--color-bg-section)', border: '1px solid var(--color-border)',
        borderRadius: 8, padding: '8px 14px', marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{_visitedZones}개 구역</strong> 방문
        </span>
        <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{totV}명</strong> 체험
        </span>
        <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          <strong style={{ color: _urgentCount > 0 ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 700 }}>
            {_urgentCount}건
          </strong> 개선 필요
        </span>
        <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          평균 스킵율 <strong style={{ color: avgSR>30?'var(--color-error)':avgSR>10?'var(--color-warning)':'var(--color-success)', fontWeight:700 }}>{avgSR}%</strong>
        </span>
        {avgEng !== '-' && <>
          <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            몰입 강도 <strong style={{ color: 'var(--color-purple)', fontWeight: 700 }}>★{avgEng}</strong>
          </span>
        </>}
        {totBN > 0 && <>
          <span style={{ color: 'var(--color-border)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            병목 <strong style={{ color: 'var(--color-error)', fontWeight: 700 }}>{totBN}건</strong>
          </span>
        </>}
      </div>
    )}

    {/* ── ① 개선 액션 플랜 (TOP — most prominent) ── */}
    <div className="rpt-section" style={{ marginBottom: 20 }}>
      <SectionTitle sub="시뮬레이션 결과 기반 자동 생성">개선 액션 플랜</SectionTitle>
      {(()=>{
        const actions=[]
        const totEnt2=_totEnt
        const overallConv=_engRateNum
        const flowEffVal=_flowEffNum
        const avgEntries=totEnt2/Math.max(rzones.length,1)

        // ─ 긴급 이슈 ─
        rzones.filter(z=>(z.avgWait||0)>20).sort((a,b)=>(b.avgWait||0)-(a.avgWait||0)).forEach(z=>{
          actions.push({priority:'urgent',category:'capacity',key:`uw${z.id}`,
            title:`${zLabel(z)} — 심각한 혼잡 (대기 ${z.avgWait}초)`,
            detail:`수용 인원(${z.media?.map(m=>m.name).join(', ')})을 늘리거나 미디어 추가 배치를 검토하세요.`,
          })
        })
        allMedia.filter(m=>m.skipRate>50&&m.exposure>0).forEach(m=>{
          actions.push({priority:'urgent',category:'content',key:`um${m.uid}`,
            title:`${m.name} — 스킵율 ${m.skipRate}% 위험`,
            detail:`콘텐츠 길이·내용을 재검토하거나 ${m.zoneName}의 진입 유도를 강화하세요.`,
          })
        })
        if (totEnt2>0&&overallConv<20)
          actions.push({priority:'urgent',category:'flow',key:'uconv',
            title:`전체 체험 전환율 ${overallConv}% — 매우 낮음`,
            detail:'관람객이 미디어를 경험하지 않고 이탈 중입니다. 콘텐츠 노출 시간과 진입 동선을 점검하세요.',
          })

        // ─ 권장 개선 ─
        if (rzones.length>0&&flowEffVal<70)
          actions.push({priority:'recommend',category:'flow',key:'rflow',
            title:`도달률 ${flowEffVal}% — 미방문 구역 발생`,
            detail:`${rzones.filter(z=>!(z.entries>0)).map(z=>zLabel(z)).join(', ')||'일부 구역'}이 방문되지 않고 있습니다. 동선 유도 또는 입구 위치를 조정하세요.`,
          })
        rzones.filter(z=>(z.avgWait||0)>10&&(z.avgWait||0)<=20).forEach(z=>{
          actions.push({priority:'recommend',category:'capacity',key:`rw${z.id}`,
            title:`${zLabel(z)} — 대기 ${z.avgWait}초 주의`,
            detail:'혼잡 시간대 인력 배치 또는 미디어 수용 인원 소폭 확대를 고려하세요.',
          })
        })
        rzones.filter(z=>(z.entries||0)>0&&(z.convRate||0)<30).forEach(z=>{
          actions.push({priority:'recommend',category:'content',key:`rc${z.id}`,
            title:`${zLabel(z)} — 체험 전환율 ${z.convRate||0}%`,
            detail:'초입 미디어 콘텐츠 매력도를 높이거나 관람객 유인 요소를 추가하세요.',
          })
        })
        rzones.filter(z=>(z.entries||0)>0&&z.entries<avgEntries*0.35).forEach(z=>{
          actions.push({priority:'recommend',category:'zone',key:`ru${z.id}`,
            title:`${zLabel(z)} — 저활용 구역 (진입 ${z.entries}명)`,
            detail:'구역 위치 이동 또는 연결 동선 강화, 안내 미디어 추가를 검토하세요.',
          })
        })
        allMedia.filter(m=>m.skipRate>30&&m.skipRate<=50&&m.exposure>0).forEach(m=>{
          actions.push({priority:'recommend',category:'content',key:`rm${m.uid}`,
            title:`${m.name} — 스킵율 ${m.skipRate}% 주의`,
            detail:'콘텐츠 길이 단축 또는 인터랙션 강화를 고려하세요.',
          })
        })

        // ─ 긍정 유지 ─
        if (flowEffVal>=85)
          actions.push({priority:'maintain',category:'flow',key:'mflow',
            title:`도달률 ${flowEffVal}% — 우수한 동선`,
            detail:'전체 구역이 고르게 방문되고 있습니다. 현재 배치를 유지하세요.',
          })
        if (overallConv>=60)
          actions.push({priority:'maintain',category:'content',key:'mconv',
            title:`체험 전환율 ${overallConv}% — 우수`,
            detail:'관람객이 콘텐츠에 적극 참여 중입니다. 고몰입 구역 콘텐츠를 다른 구역에도 적용해 보세요.',
          })
        rzones.filter(z=>z.engIdx!=null&&z.engIdx>=4).forEach(z=>{
          actions.push({priority:'maintain',category:'content',key:`meng${z.id}`,
            title:`${zLabel(z)} — 몰입 강도 ★${z.engIdx} 우수`,
            detail:'이 구역의 콘텐츠 구성을 레퍼런스로 다른 구역에 적용해 보세요.',
          })
        })

        if (actions.length===0)
          return <ActionCard priority="maintain" category="flow" title="모든 지표 정상 범위" detail="현재 전시 구성과 동선이 잘 최적화되어 있습니다. 다음 시뮬레이션 Run에서 소폭 변형하며 비교해 보세요." setTab={null}/>

        const urgentCount = actions.filter(a=>a.priority==='urgent').length
        const recCount = actions.filter(a=>a.priority==='recommend').length
        const maintainCount = actions.filter(a=>a.priority==='maintain').length

        return (<>
          {urgentCount>0&&(
            <PriorityBanner dot="🔴" label="긴급" count={urgentCount} color="#ef4444" bg="#fef2f2" borderColor="#fecaca"/>
          )}
          {actions.filter(a=>a.priority==='urgent').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={setTab}/>
          ))}
          {recCount>0&&(
            <PriorityBanner dot="🟡" label="권장" count={recCount} color="#d97706" bg="#fffbeb" borderColor="#fed7aa"/>
          )}
          {actions.filter(a=>a.priority==='recommend').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={setTab}/>
          ))}
          {maintainCount>0&&(
            <PriorityBanner dot="🟢" label="유지" count={maintainCount} color="#16a34a" bg="#f0fdf4" borderColor="#86efac"/>
          )}
          {actions.filter(a=>a.priority==='maintain').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={null}/>
          ))}
        </>)
      })()}
    </div>

    {/* ── ② 메인 KPI 4개 ── */}
    {(()=>{
      const visitedZones = _visitedZones
      const totalZones = _totalZones
      const flowEffNum = _flowEffNum
      const totEnt = _totEnt
      const totEnged = _totEnged
      const engRateNum = _engRateNum
      const avgDw = srs.length ? Math.round(srs.reduce((s,r)=>s+(r.avgDwell||0),0)/srs.length) : 0
      const avgWait = _avgWait
      const hasFlow = totalZones > 0 || data?.flowEff != null
      const hasEng = totEnt > 0 || data?.engRate != null
      return (
        <div className="rpt-kpi-row" style={{ marginBottom: 8 }}>
          <div className="rpt-kpi" style={{ borderTop: '3px solid #18181b', minHeight: 88 }}>
            <span className="rpt-kpi-l">도달률</span>
            <span className={`rpt-kpi-v${hasFlow&&flowEffNum>=70?' ok':hasFlow&&flowEffNum<40?' warn':''}`}
              style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {hasFlow?flowEffNum:'-'}<small style={{ fontSize: 13 }}>{hasFlow?'%':''}</small>
            </span>
            <span className="rpt-kpi-sub" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{visitedZones}/{totalZones} 구역 방문</span>
          </div>
          <div className="rpt-kpi" style={{ borderTop: '3px solid #3b82f6', minHeight: 88 }}>
            <span className="rpt-kpi-l">체험 전환율</span>
            <span className={`rpt-kpi-v${hasEng&&engRateNum>=60?' ok':hasEng&&engRateNum<30?' warn':''}`}
              style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {hasEng?engRateNum:'-'}<small style={{ fontSize: 13 }}>{hasEng?'%':''}</small>
            </span>
            <span className="rpt-kpi-sub" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{totEnged}/{totEnt} 체험</span>
          </div>
          <div className="rpt-kpi" style={{ borderTop: '3px solid var(--color-warning)', minHeight: 88 }}>
            <span className="rpt-kpi-l">평균 체류시간</span>
            <span className="rpt-kpi-v" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {avgDw>0?avgDw:'-'}<small style={{ fontSize: 13 }}>{avgDw>0?'초':''}</small>
            </span>
            <span className="rpt-kpi-sub" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>슬롯 평균</span>
          </div>
          <div className="rpt-kpi" style={{ borderTop: `3px solid ${avgWait>20?'var(--color-error)':avgWait>10?'var(--color-warning)':'var(--color-border)'}`, minHeight: 88 }}>
            <span className="rpt-kpi-l">평균 혼잡도</span>
            <span className={`rpt-kpi-v${avgWait>20?' warn':''}`} style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
              {avgWait}<small style={{ fontSize: 13 }}>초</small>
            </span>
            <span className="rpt-kpi-sub" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{totV}명 입장</span>
          </div>
        </div>
      )
    })()}

    {/* 보조 지표 row */}
    <div style={{display:'flex',gap:20,marginBottom:20,padding:'8px 12px',background:'var(--color-bg-section)',borderRadius:4,flexWrap:'wrap'}}>
      <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>평균 스킵율 <strong style={{color:avgSR>30?'var(--color-error)':avgSR>10?'var(--color-warning)':'var(--color-success)',fontWeight:500}}>{avgSR}%</strong></span>
      <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>평균 몰입 강도 <strong style={{color:'var(--color-purple)',fontWeight:500}}>{avgEng!=='-'?`★${avgEng}`:'-'}</strong></span>
      <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>병목 발생 <strong style={{color:totBN>0?'var(--color-error)':'var(--color-text-muted)',fontWeight:500}}>{totBN}건</strong></span>
      <span style={{fontSize:12,color:'var(--color-text-secondary)'}}>총 입장객 <strong style={{color:'var(--color-text)',fontWeight:500}}>{totV}명</strong></span>
    </div>

    {/* ── ③ 구역별 분석 차트 ── */}
    {rzones.length>0&&(
      <div className="rpt-section">
        <SectionTitle sub="진입수 · 체험 전환율">구역별 분석 차트</SectionTitle>
        <div className="chart-wrap"><canvas ref={chartRef}/></div>
      </div>
    )}

    {/* ── ④ 시간대별 결과 ── */}
    {srs.length>0&&(
      <div className="rpt-section">
        <SectionTitle>시간대별 결과</SectionTitle>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr><th>시간대</th><th>입장객</th><th>스킵율</th><th>평균 체류</th><th>몰입 강도</th><th>병목</th></tr></thead>
            <tbody>
              {srs.map(r=>(
                <tr key={r.slot}>
                  <td style={{fontWeight:500}}>{r.label}</td>
                  <td>{r.visitors}명</td>
                  <td>
                    <div className="prog-wrap">
                      <div className="prog-bar"><div className={`prog-fill ${r.skipRate>30?'error':r.skipRate>10?'warn':'success'}`} style={{width:`${Math.min(100,r.skipRate)}%`}}/></div>
                      <span style={{color:r.skipRate>30?'var(--color-error)':r.skipRate>10?'var(--color-warning)':'var(--color-success)',fontWeight:600,fontSize:11}}>{r.skipRate}%</span>
                    </div>
                  </td>
                  <td>{r.avgDwell}초</td>
                  <td style={{color:'var(--color-purple)'}}>{r.engIdx!=='-'?`★${r.engIdx}`:'-'}</td>
                  <td style={{color:r.bottlenecks>0?'var(--color-error)':'var(--color-text-muted)'}}>{r.bottlenecks}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ── ⑤ 구역별 분석 (bar cards, no table) ── */}
    {rzones.length>0&&(
      <div className="rpt-section">
        <SectionTitle>구역 성과 분석</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...rzones].sort((a,b)=>(b.entries||0)-(a.entries||0)).map(z=>{
            const convRate = z.convRate??0
            const avgWait = z.avgWait??0
            const convGrade = convRate>60?{g:'A',c:'var(--color-success)',bg:'var(--color-success-bg)'}:convRate>30?{g:'B',c:'var(--color-info)',bg:'var(--color-info-bg)'}:convRate>0?{g:'C',c:'var(--color-warning)',bg:'var(--color-warning-bg)'}:{g:'-',c:'var(--color-text-muted)',bg:'var(--color-bg-section)'}
            const waitColor = avgWait>20?'var(--color-error)':avgWait>10?'var(--color-warning)':'var(--color-success)'
            const skipColor = z.skipRate>50?'var(--color-error)':z.skipRate>20?'var(--color-warning)':'var(--color-success)'
            return (
              <div key={z.id} style={{
                background: '#fff', border: '1px solid #E4E6EA',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                {/* Zone name + grade */}
                <div style={{ minWidth: 0, flex: '0 0 120px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#09090b', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zLabel(z)}</div>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    fontSize: 11, fontWeight: 700, background: convGrade.bg, color: convGrade.c,
                  }}>{convGrade.g}</span>
                </div>

                {/* Conversion bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>체험 전환율</div>
                  {z.entries>0 ? (
                    <div className="prog-wrap">
                      <div className="prog-bar" style={{height:6}}><div className="prog-fill" style={{width:`${Math.min(100,convRate)}%`,background:convGrade.c}}/></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: convGrade.c, minWidth: 32, textAlign: 'right' }}>{convRate}%</span>
                    </div>
                  ) : <span style={{ fontSize: 10, color: 'var(--color-border)' }}>데이터 없음</span>}
                </div>

                {/* Wait time pill */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 52 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>대기</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: waitColor }}>{z.entries>0 ? avgWait+'초' : '-'}</span>
                </div>

                {/* Skip rate */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>스킵</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: skipColor }}>{z.skipRate}%</span>
                </div>

                {/* Engagement */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 56 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>몰입 강도</div>
                  <span style={{ fontSize: 11, color: 'var(--color-purple)', fontWeight: 600 }}>
                    {z.engIdx!==null ? starsOf(z.engIdx)+` (${z.engIdx})` : '-'}
                  </span>
                </div>

                {/* Entries */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 40 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>진입</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>{z.entries??'-'}명</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}

    {/* ── ⑥ 미디어별 분석 (compact + tiny bars) ── */}
    {allMedia.length>0&&(
      <div className="rpt-section">
        <SectionTitle sub="스킵율 높은 순">미디어 효과 분석</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allMedia.map(m=>{
            const g=gradeOf(m.skipRate)
            return (
              <div key={m.uid} style={{
                background: '#fff', border: '1px solid #E4E6EA',
                borderRadius: 8, padding: '9px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}>
                {/* Media name + zone */}
                <div style={{ flex: '0 0 130px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: m.bg||'#eee', border: `1.5px solid ${m.color||'#ccc'}`, flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#09090b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', paddingLeft: 15 }}>{m.zoneName}</span>
                </div>

                {/* Skip bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>스킵율</div>
                  {m.exposure>0 ? (
                    <div className="prog-wrap">
                      <div className="prog-bar" style={{height:5}}><div className={`prog-fill ${m.skipRate>50?'error':m.skipRate>20?'warn':'success'}`} style={{width:`${Math.min(100,m.skipRate)}%`}}/></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.skipRate>50?'var(--color-error)':m.skipRate>20?'var(--color-warning)':'var(--color-success)', minWidth: 32, textAlign: 'right' }}>{m.skipRate}%</span>
                    </div>
                  ) : <span style={{ fontSize: 10, color: 'var(--color-border)' }}>-</span>}
                </div>

                {/* Exposure */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>노출</div>
                  <span style={{ fontSize: 11, color: 'var(--color-text)' }}>{m.exposure>0?`${m.exposure}회`:'-'}</span>
                </div>

                {/* Engagement */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 3 }}>몰입</div>
                  <span style={{ fontSize: 11, color: 'var(--color-purple)', fontWeight: 600 }}>
                    {m.engIdx!=null?`★${m.engIdx}`:<span style={{color:'var(--color-border)'}}>-</span>}
                  </span>
                </div>

                {/* Grade badge */}
                <div style={{ flexShrink: 0 }}>
                  {m.exposure>0
                    ? <span className={`badge ${g.g==='A'?'grade-a':g.g==='B'?'grade-b':g.g==='C'?'grade-c':'grade-d'}`}>{g.g}</span>
                    : <span style={{ fontSize:11, color:'var(--color-border)' }}>-</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}
  </>)
}

// ── SimLogCard ──
function SimLogCard({ log, onDelete }) {
  const [open, setOpen] = useState(false)
  const [zoneOpen, setZoneOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const totV = log.results.reduce((s,r)=>s+r.visitors,0)
  const avgSR = log.results.length
    ? Math.round(log.results.reduce((s,r)=>s+r.skipRate,0)/log.results.length)
    : 0
  const avgEng = (()=>{
    const nums=log.results.map(r=>parseFloat(r.engIdx)).filter(n=>!isNaN(n))
    return nums.length ? (nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(1) : '-'
  })()
  const zones = log.zones||[]
  const worstMedia = zones.flatMap(z=>z.media.map(m=>({...m,zoneName:z.name}))).filter(m=>m.exposure>0).sort((a,b)=>b.skipRate-a.skipRate).slice(0,3)
  const gradeC = sr=>sr>50?'var(--color-error)':sr>20?'var(--color-warning)':'var(--color-success)'
  return (<>
    <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',userSelect:'none'}}
        onClick={()=>setOpen(o=>!o)}>
        <span style={{fontSize:10,color:'var(--color-text-muted)',flexShrink:0}}>{log.ts}</span>
        <span style={{fontSize:11,fontWeight:600,color:'var(--color-text)',flex:1}}>{log.project}</span>
        <span className="badge badge-info" style={{flexShrink:0}}>{log.rangeLabel}</span>
        <span style={{fontSize:10,color:'var(--color-text-secondary)',flexShrink:0}}>입장 {totV}명</span>
        <span style={{fontSize:10,color:avgSR>30?'var(--color-error)':'var(--color-success)',fontWeight:600,flexShrink:0}}>스킵 {avgSR}%</span>
        {avgEng!=='-'&&<span style={{fontSize:10,color:'var(--color-purple)',fontWeight:600,flexShrink:0}}>★{avgEng}</span>}
        <span style={{fontSize:10,color:'var(--color-text-muted)',flexShrink:0}}>{open?'▲':'▼'}</span>
        <button style={{background:'#F0F0EE',border:'1px solid #D4D4D4',borderRadius:5,cursor:'pointer',fontSize:10,color:'#0F172A',padding:'2px 7px',flexShrink:0,fontWeight:600}}
          onClick={e=>{e.stopPropagation(); setDetailOpen(true)}} title="상세 보기">상세 보기</button>
        <button style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#ccc',padding:'0 2px',flexShrink:0}}
          onClick={e=>{e.stopPropagation(); onDelete(log.id)}} title="삭제">✕</button>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid var(--color-border-light)'}}>
          <div style={{padding:'8px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:600,color:'var(--color-text-muted)',marginBottom:5}}>시간대별 요약</div>
            <table className="data-table">
              <thead>
                <tr>
                  {['시간대','입장객','스킵율','체류','몰입 강도','병목'].map(h=>(
                    <th key={h} style={{textAlign:'center'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.results.map(r=>(
                  <tr key={r.slot}>
                    <td className="td-center" style={{fontWeight:500}}>{r.label}</td>
                    <td className="td-center">{r.visitors}명</td>
                    <td className="td-center" style={{color:gradeC(r.skipRate),fontWeight:600}}>{r.skipRate}%</td>
                    <td className="td-center">{r.avgDwell}초</td>
                    <td className="td-center" style={{color:'var(--color-purple)'}}>{r.engIdx!=='-'?`★${r.engIdx}`:'-'}</td>
                    <td className="td-center" style={{color:r.bottlenecks>0?'var(--color-error)':'var(--color-text-muted)'}}>{r.bottlenecks}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {zones.length>0&&(
            <div style={{borderTop:'1px solid var(--color-border-light)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',cursor:'pointer'}}
                onClick={()=>setZoneOpen(o=>!o)}>
                <span style={{fontSize:11,fontWeight:600,color:'var(--color-text-muted)'}}>구역 · 미디어 분석</span>
                <span style={{fontSize:10,color:'var(--color-text-muted)'}}>{zoneOpen?'▲':'▼'}</span>
              </div>
              {zoneOpen&&(
                <div style={{padding:'0 12px 10px'}}>
                  {worstMedia.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:9,color:'var(--color-text-muted)',fontWeight:600,marginBottom:4}}>스킵율 높은 미디어 TOP{worstMedia.length}</div>
                      {worstMedia.map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{width:7,height:7,borderRadius:2,background:m.bg||'#eee',border:`1px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                          <span style={{fontSize:10,flex:1,fontWeight:500}}>{m.name}</span>
                          <span style={{fontSize:9,color:'var(--color-text-muted)'}}>{m.zoneName}</span>
                          <span style={{fontSize:10,fontWeight:700,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:10,color:'var(--color-purple)'}}>★{m.engIdx}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:9,color:'var(--color-text-muted)',fontWeight:600,marginBottom:4}}>구역별 스킵율 · 몰입 강도</div>
                  {zones.map(z=>(
                    <div key={z.id} style={{marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:10,fontWeight:600,flex:1}}>{z.name}{z.floor>0?` (Area ${z.floor+1})`:''}</span>
                        <span style={{fontSize:10,fontWeight:700,color:gradeC(z.skipRate)}}>스킵 {z.skipRate}%</span>
                        {z.engIdx!=null&&<span style={{fontSize:10,color:'var(--color-purple)'}}>★{z.engIdx}</span>}
                      </div>
                      {z.media.filter(m=>m.exposure>0).map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:5,paddingLeft:10,marginBottom:2}}>
                          <span style={{width:6,height:6,borderRadius:2,background:m.bg||'#eee',border:`1px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                          <span style={{fontSize:10,flex:1,color:'var(--color-text-secondary)'}}>{m.name}</span>
                          <span style={{fontSize:9,color:'var(--color-text-muted)'}}>{m.exposure}회</span>
                          <span style={{fontSize:10,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:10,color:'var(--color-purple)'}}>★{m.engIdx}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    {detailOpen&&(
      <div className="log-modal-backdrop" onClick={()=>setDetailOpen(false)}>
        <div className="log-modal-box" onClick={e=>e.stopPropagation()}>
          <div className="log-modal-header">
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>{log.project}</span>
              <span style={{fontSize:11,color:'var(--color-text-muted)'}}>{log.ts} · {log.rangeLabel}</span>
            </div>
            <button className="log-modal-close" onClick={()=>setDetailOpen(false)}>✕</button>
          </div>
          <div className="log-modal-body">
            <ReportView data={{slotResults:log.results, zones:log.zones||[], rangeLabel:log.rangeLabel}} visible={detailOpen}/>
          </div>
        </div>
      </div>
    )}
  </>)
}

// ── Empty state ──
function EmptyState({ setTab }) {
  const tiles = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: '전시 건강도 점수',
      desc: '도달률·전환율·혼잡도·참여도를 종합한 0-100 점수와 A–D 등급',
      color: '#0F172A',
      bg: '#F0F0EE',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      ),
      title: '개선 액션 플랜',
      desc: '긴급·권장·유지 3단계로 정렬된 구체적 개선 과제 자동 생성',
      color: '#ef4444',
      bg: '#fef2f2',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
      title: '구역 성과 분석',
      desc: '구역별 전환율 바, 대기 시간, 스킵율, 몰입 강도 시각화',
      color: '#18181b',
      bg: '#eff6ff',
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      ),
      title: '미디어 효과 분석',
      desc: '미디어별 스킵율, 노출 횟수, 몰입 강도를 등급과 함께 비교',
      color: '#7c3aed',
      bg: '#F3E5F5',
    },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px 40px', textAlign: 'center',
    }}>
      {/* Icon graphic */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: '#eff6ff',
        border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 2px 2px rgba(0,0,0,.14), 0 3px 1px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.20)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4l-5 5-4-4-3 3"/>
        </svg>
      </div>

      <div style={{ fontSize: 20, fontWeight: 400, color: 'var(--color-text)', marginBottom: 8, letterSpacing: '0.0125em' }}>
        Insights will appear here
      </div>
      <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 32, maxWidth: 340, lineHeight: 1.5, letterSpacing: '0.01786em' }}>
        시뮬레이션을 실행하면 전시관 운영 데이터를 분석해<br/>아래 4가지 인사이트를 자동으로 생성합니다.
      </div>

      {/* 2x2 feature tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 12, width: '100%', maxWidth: 480, marginBottom: 32,
      }}>
        {tiles.map(t => (
          <div key={t.title} style={{
            background: '#fff', border: 'none',
            borderRadius: 4, padding: '16px',
            textAlign: 'left',
            boxShadow: '0 2px 2px rgba(0,0,0,.14), 0 3px 1px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.20)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 4,
              background: t.bg, color: t.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10,
            }}>{t.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', marginBottom: 4, letterSpacing: '0.0125em' }}>{t.title}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {setTab && (
        <button onClick={() => setTab('simulate')} style={{
          background: '#18181b', color: '#fff',
          border: 'none', borderRadius: 4, padding: '0 24px', height: 42,
          fontSize: 14, fontWeight: 500, cursor: 'pointer',
          boxShadow: '0 2px 2px rgba(0,0,0,.14), 0 3px 1px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.20)',
          letterSpacing: '0.0892em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>
          시뮬레이션 실행하기
        </button>
      )}
    </div>
  )
}

export default function ResultPanel({ tab, saveReport }) {
  const { reportData, slotResults, simLogs, setSimLogs, setReportData, setTab } = useSimStore()

  return (
    <div style={{display: tab==='report' ? 'block' : 'none', position:'absolute', inset:0, overflowY:'auto', background:'var(--color-bg)'}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'0 24px 40px'}}>
      {/* 헤더 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,padding:'24px 0 16px',borderBottom:'1px solid var(--color-border)'}}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <span style={{fontSize:18,fontWeight:800,color:'var(--color-text)',letterSpacing:'-0.02em'}}>Insights</span>
          {reportData && (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              {reportData._logId && simLogs.length > 0 && (()=>{
                const idx = simLogs.findIndex(l=>l.id===reportData._logId)
                const runNo = idx>=0 ? simLogs.length - idx : null
                const log = simLogs[idx]
                return runNo ? (
                  <span style={{fontSize:10,background:'#0F172A',border:'1px solid #0F172A',color:'#fff',borderRadius:4,padding:'1px 6px',fontWeight:700}}>
                    Run #{runNo}
                  </span>
                ) : null
              })()}
              {reportData._logId && simLogs.length > 0 && (()=>{
                const log = simLogs.find(l=>l.id===reportData._logId)
                return log?.scenario ? (
                  <span style={{fontSize:10,color:'#a1a1aa'}}>{log.scenario} · {reportData.range?.label||''}</span>
                ) : null
              })()}
              {!reportData._logId && <span style={{fontSize:11,color:'#a1a1aa'}}>{reportData.range?.label||''}</span>}
            </div>
          )}
        </div>
        <button className="btn-s" onClick={saveReport}
          disabled={!reportData&&slotResults.length===0}
          title="시뮬레이션 결과를 엑셀 파일로 저장">
          ⬇ 엑셀 저장
        </button>
      </div>

      {!reportData&&slotResults.length===0
        ? <EmptyState setTab={setTab}/>
        : <ReportView data={reportData||{slotResults,zones:[],rangeLabel:''}} visible={tab==='report'} setTab={setTab}/>
      }

      {/* ── Run 비교 테이블 ── */}
      {simLogs.length > 0 && (
        <div style={{marginTop:20,background:'#fff',border:'1px solid #E4E6EA',borderRadius:14,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <span style={{fontSize:13,fontWeight:600,color:'#09090b'}}>Run 비교</span>
              <span style={{fontSize:11,color:'#a1a1aa',marginLeft:8}}>최신 {Math.min(simLogs.length,10)}개</span>
            </div>
            <button className="btn-s" style={{fontSize:10,color:'#e55',borderColor:'#fcc'}}
              onClick={()=>{
                if (!window.confirm('모든 히스토리를 삭제할까요?')) return
                setSimLogs([]); try{localStorage.removeItem('exsim_logs')}catch{}
              }}>전체 삭제</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#F9FAFB',borderBottom:'2px solid #E4E6EA'}}>
                  {['Run','시나리오','범위','방문객','관람효율','체험전환율','평균혼잡도','스킵율',''].map(h=>(
                    <th key={h} style={{padding:'8px 16px',fontWeight:600,color:'#a1a1aa',textAlign:h===''||h==='시나리오'||h==='범위'?'left':'center',fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...simLogs].reverse().slice(-10).map((log, i, arr) => {
                  const runNo = simLogs.length - (simLogs.length - 1 - ([...simLogs].reverse().indexOf(log)))
                  const prev = i > 0 ? arr[i-1] : null
                  const totV = log.results?.reduce((s,r)=>s+(r.visitors||0),0) ?? 0
                  const avgSR = log.results?.length ? Math.round(log.results.reduce((s,r)=>s+(r.skipRate||0),0)/log.results.length) : 0
                  const eff  = log.flowEff ?? null
                  const eng  = log.engRate ?? null
                  const wait = log.avgWait ?? null
                  const isActive = reportData?._logId === log.id

                  const prevTotV = prev?.results?.reduce((s,r)=>s+(r.visitors||0),0) ?? null
                  const prevSR   = prev?.results?.length ? Math.round(prev.results.reduce((s,r)=>s+(r.skipRate||0),0)/prev.results.length) : null
                  const prevEff  = prev?.flowEff ?? null
                  const prevEng  = prev?.engRate ?? null
                  const prevWait = prev?.avgWait ?? null

                  const Delta = ({ cur, prev: pv, unit='%', higherBetter=true }) => {
                    if (cur==null||pv==null) return null
                    const d = cur - pv
                    if (Math.abs(d) < 0.5) return <span style={{fontSize:9,color:'#a1a1aa',marginLeft:3}}>±0</span>
                    const good = higherBetter ? d > 0 : d < 0
                    return (
                      <span style={{fontSize:9,color:good?'#16a34a':'#ef4444',fontWeight:600,marginLeft:3}}>
                        {d>0?'+':''}{Math.round(d)}{unit}
                      </span>
                    )
                  }

                  const allEff  = simLogs.map(l=>l.flowEff).filter(v=>v!=null)
                  const allEng  = simLogs.map(l=>l.engRate).filter(v=>v!=null)
                  const allWait = simLogs.map(l=>l.avgWait).filter(v=>v!=null)
                  const allSR   = simLogs.map(l=>l.results?.length?Math.round(l.results.reduce((s,r)=>s+r.skipRate,0)/l.results.length):null).filter(v=>v!=null)
                  const isBestEff  = eff!=null  && eff  === Math.max(...allEff)
                  const isBestEng  = eng!=null  && eng  === Math.max(...allEng)
                  const isBestWait = wait!=null && wait === Math.min(...allWait)
                  const isBestSR   = avgSR!=null && avgSR === Math.min(...allSR)

                  const BestBadge = ({ isBest, children }) => isBest
                    ? <span style={{background:'#dcfce7',color:'#15803d',borderRadius:3,padding:'0 4px',fontWeight:700}}>{children} 🏆</span>
                    : <span>{children}</span>

                  return (
                    <tr key={log.id}
                      onClick={()=>{ setReportData({zones:log.zones||[],range:log.range||{label:log.rangeLabel},slotResults:log.results||[],flowEff:log.flowEff,engRate:log.engRate,avgWait:log.avgWait,_logId:log.id}) }}
                      style={{
                        background: isActive ? '#eff6ff' : i%2===0?'#fff':'#fafafa',
                        borderBottom:'1px solid #f0f0f0',
                        cursor:'pointer',
                        transition:'background 0.15s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background='#F0F0EE'}
                      onMouseLeave={e=>e.currentTarget.style.background=isActive?'#F0F0EE':i%2===0?'#fff':'#fafafa'}
                    >
                      <td style={{padding:'8px 10px',fontWeight:800,color:'#0F172A',whiteSpace:'nowrap'}}>
                        #{simLogs.length - ([...simLogs].reverse().findIndex(l=>l.id===log.id))}
                        {isActive && <span style={{fontSize:8,background:'#0F172A',color:'#fff',borderRadius:3,padding:'1px 4px',marginLeft:4}}>현재</span>}
                      </td>
                      <td style={{padding:'8px 10px',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>
                        {log.scenario||log.project}
                      </td>
                      <td style={{padding:'8px 10px',color:'#a1a1aa',whiteSpace:'nowrap'}}>{log.rangeLabel}</td>
                      <td style={{padding:'8px 10px',textAlign:'center'}}>
                        {totV}명<Delta cur={totV} prev={prevTotV} unit='명' higherBetter={true}/>
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'center',fontWeight:600}}>
                        <BestBadge isBest={isBestEff}>
                          {eff!=null?`${eff}%`:'-'}
                        </BestBadge>
                        <Delta cur={eff} prev={prevEff} unit='%' higherBetter={true}/>
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'center',fontWeight:600}}>
                        <BestBadge isBest={isBestEng}>
                          {eng!=null?`${eng}%`:'-'}
                        </BestBadge>
                        <Delta cur={eng} prev={prevEng} unit='%' higherBetter={true}/>
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'center',fontWeight:600}}>
                        <BestBadge isBest={isBestWait}>
                          {wait!=null?`${wait}초`:'-'}
                        </BestBadge>
                        <Delta cur={wait} prev={prevWait} unit='초' higherBetter={false}/>
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'center',fontWeight:600}}>
                        <BestBadge isBest={isBestSR}>
                          {avgSR}%
                        </BestBadge>
                        <Delta cur={avgSR} prev={prevSR} unit='%' higherBetter={false}/>
                      </td>
                      <td style={{padding:'8px 10px',textAlign:'right'}}>
                        <button onClick={e=>{
                          e.stopPropagation()
                          setSimLogs(prev=>{
                            const next=prev.filter(l=>l.id!==log.id)
                            try{localStorage.setItem('exsim_logs',JSON.stringify(next))}catch{}
                            return next
                          })
                        }} style={{background:'none',border:'none',color:'#ddd',cursor:'pointer',fontSize:12,padding:0}} title="삭제">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:10,color:'#a1a1aa',marginTop:6,textAlign:'right'}}>
            행 클릭 시 해당 Run의 Insights를 불러옵니다 · 🏆 = 항목별 최고값
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
