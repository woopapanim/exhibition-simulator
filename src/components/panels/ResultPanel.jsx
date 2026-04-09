import { useRef, useEffect, useState } from 'react'
import Chart from 'chart.js/auto'
import useSimStore from '../../store/simulationStore'

// 표정 아이콘: level 'good' | 'neutral' | 'caution' | 'bad'
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

// ── 전체 건강도 점수 카드 ──
function HealthScoreCard({ flowEff, convRate, avgWait, avgSkipRate, setTab }) {
  // Normalize each metric to 0-100 score (higher = better)
  const s1 = Math.min(100, flowEff ?? 0)
  const s2 = Math.min(100, convRate ?? 0)
  const s3 = avgWait != null ? Math.max(0, 100 - avgWait * 2.5) : 50
  const s4 = avgSkipRate != null ? Math.max(0, 100 - avgSkipRate * 1.5) : 50
  const score = Math.round(s1 * 0.3 + s2 * 0.3 + s3 * 0.2 + s4 * 0.2)

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
  const gradeColor = grade === 'A' ? '#059669' : grade === 'B' ? '#2563EB' : grade === 'C' ? '#D97706' : '#DC2626'
  const gradeBg = grade === 'A' ? '#ECFDF5' : grade === 'B' ? '#EFF6FF' : grade === 'C' ? '#FFFBEB' : '#FEF2F2'
  const gradeText = grade === 'A' ? '우수한 전시 운영 상태입니다' : grade === 'B' ? '일부 개선으로 완성도를 높일 수 있습니다' : grade === 'C' ? '주요 지표에 개선이 필요합니다' : '즉각적인 개선 조치가 필요합니다'

  const metrics = [
    { label: '도달률', val: s1, unit: '%', raw: flowEff },
    { label: '체험 전환율', val: s2, unit: '%', raw: convRate },
    { label: '혼잡도', val: s3, unit: '', raw: avgWait != null ? avgWait + '초' : '-', invert: true },
    { label: '스킵율', val: s4, unit: '', raw: avgSkipRate != null ? avgSkipRate + '%' : '-', invert: true },
  ]

  return (
    <div style={{
      background: gradeBg,
      border: `1px solid ${gradeColor}25`,
      borderLeft: `4px solid ${gradeColor}`,
      borderRadius: 10, padding: '12px 16px', marginBottom: 16,
      display: 'flex', gap: 14, alignItems: 'center',
    }}>
      {/* Grade badge */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
        background: '#fff', border: `2.5px solid ${gradeColor}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 1px 8px ${gradeColor}20`,
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</span>
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: gradeColor, marginBottom: 4 }}>{gradeText}</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {metrics.map(m => (
            <span key={m.label} style={{ fontSize: 11, color: '#6B7280' }}>
              {m.label}: <strong style={{ color: '#111827', fontWeight: 700 }}>{m.raw ?? '-'}</strong>
            </span>
          ))}
        </div>
      </div>
      {/* Score */}
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>점수</div>
      </div>
      {/* CTA */}
      {(grade === 'C' || grade === 'D') && setTab && (
        <button onClick={() => setTab('build')} style={{
          flexShrink: 0, background: gradeColor, color: '#fff',
          border: 'none', borderRadius: 8, padding: '7px 12px',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          boxShadow: `0 2px 8px ${gradeColor}40`, whiteSpace: 'nowrap',
        }}>
          Build →
        </button>
      )}
    </div>
  )
}

// ── 개선 액션 플랜 ──
const ACTION_PRIORITY = {
  urgent: { label: '긴급', color: '#DC2626', bg: '#FEF2F2', dot: '🔴' },
  recommend: { label: '권장', color: '#D97706', bg: '#FFFBEB', dot: '🟡' },
  maintain: { label: '유지', color: '#059669', bg: '#ECFDF5', dot: '🟢' },
}
const ACTION_CATEGORY = {
  zone: '구역 배치',
  media: '미디어 설정',
  content: '콘텐츠',
  flow: '동선 유도',
  capacity: '수용 인원',
}

function ActionCard({ priority, category, title, detail, onBuild, setTab }) {
  const p = ACTION_PRIORITY[priority]
  return (
    <div style={{
      background: '#fff', border: `1px solid ${p.color}20`,
      borderLeft: `3px solid ${p.color}`,
      borderRadius: 8, padding: '10px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{p.dot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 600, color: p.color,
            background: p.bg, borderRadius: 3, padding: '1px 5px',
          }}>{p.label}</span>
          <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>{ACTION_CATEGORY[category] || category}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#222', marginBottom: detail ? 2 : 0 }}>{title}</div>
        {detail && <div style={{ fontSize: 11, color: '#666', lineHeight: 1.45 }}>{detail}</div>}
      </div>
      {setTab && (
        <button onClick={() => setTab('build')} style={{
          flexShrink: 0, background: '#E6F7F1', border: '1px solid #A7E3CD',
          borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700,
          color: '#1D9E75', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center',
        }}>
          Build →
        </button>
      )}
    </div>
  )
}

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
  const gradeOf = sr => sr>50?{g:'D',c:'#DC2626',bg:'#FEF2F2'}:sr>20?{g:'C',c:'#D97706',bg:'#FFFBEB'}:sr>10?{g:'B',c:'#2563EB',bg:'#EFF6FF'}:{g:'A',c:'#059669',bg:'#ECFDF5'}
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
          legend:{ display:true, position:'top', align:'end', labels:{ font:{size:11,weight:'500'}, color:'#6B7280', boxWidth:10, boxHeight:10, borderRadius:3, padding:16, usePointStyle:true } },
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
            ticks:{ color:'#9CA3AF', font:{size:10}, maxTicksLimit:5 },
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

  // Pre-compute summary metrics for HealthScoreCard + ActionPlan
  const _visitedZones = rzones.filter(z=>z.entries>0).length
  const _totalZones = rzones.length
  const _flowEffNum = _totalZones>0 ? Math.round(_visitedZones/_totalZones*100) : (data?.flowEff||0)
  const _totEnt = rzones.reduce((s,z)=>s+(z.entries||0),0)
  const _totEnged = rzones.reduce((s,z)=>s+(z.engaged||0),0)
  const _engRateNum = _totEnt>0 ? Math.round(_totEnged/_totEnt*100) : (data?.engRate||0)
  const _totWaitW = rzones.reduce((s,z)=>s+(z.avgWait||0)*(z.entries||0),0)
  const _avgWait = _totEnt>0 ? Math.round(_totWaitW/_totEnt) : (data?.avgWait||0)

  return (<>
    {/* 전시 건강도 */}
    {(_totalZones > 0 || srs.length > 0) && (
      <HealthScoreCard
        flowEff={_flowEffNum}
        convRate={_engRateNum}
        avgWait={_avgWait}
        avgSkipRate={avgSR}
        setTab={setTab}
      />
    )}
    {/* ① 메인 KPI 4개 */}
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
        <div className="rpt-kpi-row">
          <div className="rpt-kpi" style={{borderTop:'3px solid #1D9E75'}}>
            <span className="rpt-kpi-l">도달률</span>
            <span className={`rpt-kpi-v${hasFlow&&flowEffNum>=70?' ok':hasFlow&&flowEffNum<40?' warn':''}`}>
              {hasFlow?flowEffNum:'-'}<small>{hasFlow?'%':''}</small>
            </span>
            <span className="rpt-kpi-sub">{visitedZones}/{totalZones} 구역 방문</span>
          </div>
          <div className="rpt-kpi" style={{borderTop:'3px solid #6366f1'}}>
            <span className="rpt-kpi-l">체험 전환율</span>
            <span className={`rpt-kpi-v${hasEng&&engRateNum>=60?' ok':hasEng&&engRateNum<30?' warn':''}`}>
              {hasEng?engRateNum:'-'}<small>{hasEng?'%':''}</small>
            </span>
            <span className="rpt-kpi-sub">{totEnged}/{totEnt} 체험</span>
          </div>
          <div className="rpt-kpi" style={{borderTop:'3px solid #F59E0B'}}>
            <span className="rpt-kpi-l">평균 체류시간</span>
            <span className="rpt-kpi-v">{avgDw>0?avgDw:'-'}<small>{avgDw>0?'초':''}</small></span>
            <span className="rpt-kpi-sub">슬롯 평균</span>
          </div>
          <div className="rpt-kpi" style={{borderTop:`3px solid ${avgWait>20?'#DC2626':avgWait>10?'#D97706':'#E4E6EA'}`}}>
            <span className="rpt-kpi-l">평균 혼잡도</span>
            <span className={`rpt-kpi-v${avgWait>20?' warn':''}`}>{avgWait}<small>초</small></span>
            <span className="rpt-kpi-sub">{totV}명 입장</span>
          </div>
        </div>
      )
    })()}
    {/* 보조 지표 */}
    <div style={{display:'flex',gap:20,marginBottom:16,padding:'8px 0',borderBottom:'1px solid #E4E6EA',flexWrap:'wrap'}}>
      <span style={{fontSize:11,color:'#6B7280'}}>평균 스킵율 <strong style={{color:avgSR>30?'#DC2626':avgSR>10?'#D97706':'#059669',fontWeight:700}}>{avgSR}%</strong></span>
      <span style={{fontSize:11,color:'#6B7280'}}>평균 몰입 강도 <strong style={{color:'#7C3AED',fontWeight:700}}>{avgEng!=='-'?`★${avgEng}`:'-'}</strong></span>
      <span style={{fontSize:11,color:'#6B7280'}}>병목 발생 <strong style={{color:totBN>0?'#DC2626':'#6B7280',fontWeight:700}}>{totBN}건</strong></span>
      <span style={{fontSize:11,color:'#6B7280'}}>총 입장객 <strong style={{color:'#111827',fontWeight:700}}>{totV}명</strong></span>
    </div>

    {/* ② 구역별 분석 차트 */}
    {rzones.length>0&&(
      <div className="rpt-section">
        <div className="rpt-section-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span>구역별 분석 차트</span>
          <span style={{fontSize:10,fontWeight:500,color:'#9CA3AF',marginBottom:0}}>진입수 · 체험 전환율</span>
        </div>
        <div className="chart-wrap"><canvas ref={chartRef}/></div>
      </div>
    )}

    {/* ③ 시간대별 결과 */}
    {srs.length>0&&(
      <div className="rpt-section">
        <div className="rpt-section-title">시간대별 결과</div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr><th>시간대</th><th>입장객</th><th>스킵율</th><th>평균 체류</th><th>몰입 강도</th><th>병목</th></tr></thead>
            <tbody>
              {srs.map(r=>(
                <tr key={r.slot}>
                  <td style={{fontWeight:500}}>{r.label}</td>
                  <td>{r.visitors}명</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{flex:1,height:4,background:'#f0f0f0',borderRadius:2,overflow:'hidden',minWidth:40}}>
                        <div style={{height:'100%',width:`${Math.min(100,r.skipRate)}%`,background:r.skipRate>30?'#DC2626':r.skipRate>10?'#D97706':'#059669',borderRadius:2}}/>
                      </div>
                      <span style={{color:r.skipRate>30?'#DC2626':r.skipRate>10?'#D97706':'#059669',fontWeight:600,fontSize:11}}>{r.skipRate}%</span>
                    </div>
                  </td>
                  <td>{r.avgDwell}초</td>
                  <td style={{color:'#7C3AED'}}>{r.engIdx!=='-'?`★${r.engIdx}`:'-'}</td>
                  <td style={{color:r.bottlenecks>0?'#DC2626':'#9CA3AF'}}>{r.bottlenecks}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ④ 구역별 분석 */}
    {rzones.length>0&&(
      <div className="rpt-section">
        <div className="rpt-section-title">구역별 분석</div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>구역</th>
              <th>진입</th><th>전환율</th><th>평균 대기</th>
              <th>스킵율</th><th>몰입 강도</th><th>등급</th>
            </tr></thead>
            <tbody>
              {[...rzones].sort((a,b)=>(b.entries||0)-(a.entries||0)).map(z=>{
                const convRate = z.convRate??0
                const avgWait = z.avgWait??0
                const g = gradeOf(z.skipRate)
                // grade by conversion rate
                const convGrade = convRate>60?{g:'A',c:'#059669',bg:'#ECFDF5'}:convRate>30?{g:'B',c:'#2563EB',bg:'#EFF6FF'}:convRate>0?{g:'C',c:'#D97706',bg:'#FFFBEB'}:{g:'-',c:'#888',bg:'#f5f5f5'}
                return (
                  <tr key={z.id}>
                    <td style={{fontWeight:600,textAlign:'left'}}>{zLabel(z)}</td>
                    <td style={{fontSize:11}}>{z.entries??'-'}명</td>
                    <td>
                      {z.entries>0?(
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{flex:1,height:5,background:'#f0f0f0',borderRadius:3,overflow:'hidden',minWidth:36}}>
                            <div style={{height:'100%',width:`${Math.min(100,convRate)}%`,background:convRate>60?'#059669':convRate>30?'#2563EB':'#D97706',borderRadius:3}}/>
                          </div>
                          <span style={{fontWeight:700,fontSize:11,color:convRate>60?'#059669':convRate>30?'#2563EB':'#D97706'}}>{convRate}%</span>
                        </div>
                      ):<span style={{color:'#ccc',fontSize:11}}>-</span>}
                    </td>
                    <td style={{fontSize:11,color:avgWait>20?'#DC2626':avgWait>10?'#D97706':'#888',fontWeight:avgWait>10?600:400}}>
                      {z.entries>0?avgWait+'초':'-'}
                    </td>
                    <td>
                      <span style={{fontSize:11,color:z.skipRate>50?'#DC2626':z.skipRate>20?'#D97706':'#059669',fontWeight:600}}>{z.skipRate}%</span>
                    </td>
                    <td style={{color:'#7C3AED',fontSize:11}}>{z.engIdx!==null?starsOf(z.engIdx)+` (${z.engIdx})`:'-'}</td>
                    <td><span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,fontSize:11,fontWeight:700,background:convGrade.bg,color:convGrade.c}}>{convGrade.g}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ⑤ 미디어별 분석 */}
    {allMedia.length>0&&(
      <div className="rpt-section">
        <div className="rpt-section-title">미디어별 분석 <span style={{fontSize:10,fontWeight:400,color:'#9CA3AF'}}>— 스킵율 높은 순</span></div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>미디어</th>
              <th style={{textAlign:'left'}}>구역</th>
              <th>노출</th><th>스킵율</th><th>몰입 강도</th><th>등급</th>
            </tr></thead>
            <tbody>
              {allMedia.map(m=>{
                const g=gradeOf(m.skipRate)
                return (
                  <tr key={m.uid}>
                    <td style={{textAlign:'left'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                        <span style={{width:10,height:10,borderRadius:3,background:m.bg||'#eee',border:`1.5px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                        <span style={{fontWeight:500,fontSize:12}}>{m.name}</span>
                      </span>
                    </td>
                    <td style={{textAlign:'left',fontSize:11,color:'#9CA3AF'}}>{m.zoneName}</td>
                    <td style={{fontSize:11}}>{m.exposure>0?`${m.exposure}회`:'-'}</td>
                    <td>
                      {m.exposure>0?(
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{flex:1,height:4,background:'#f0f0f0',borderRadius:2,overflow:'hidden',minWidth:36}}>
                            <div style={{height:'100%',width:`${Math.min(100,m.skipRate)}%`,background:m.skipRate>50?'#DC2626':m.skipRate>20?'#D97706':'#059669',borderRadius:2}}/>
                          </div>
                          <span style={{fontWeight:700,fontSize:11,color:m.skipRate>50?'#DC2626':m.skipRate>20?'#D97706':'#059669'}}>{m.skipRate}%</span>
                        </div>
                      ):<span style={{color:'#ccc',fontSize:11}}>-</span>}
                    </td>
                    <td style={{fontSize:11,color:'#7C3AED',fontWeight:600}}>
                      {m.engIdx!=null?`★${m.engIdx}`:<span style={{color:'#ccc'}}>-</span>}
                    </td>
                    <td>
                      {m.exposure>0?<span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,fontSize:11,fontWeight:700,background:g.bg,color:g.c}}>{g.g}</span>:<span style={{color:'#ccc',fontSize:11}}>-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ⑥ 개선 액션 플랜 */}
    <div className="rpt-section">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <span className="rpt-section-title" style={{marginBottom:0}}>개선 액션 플랜</span>
        <span style={{fontSize:10,color:'#9CA3AF'}}>시뮬레이션 결과 기반 자동 생성</span>
      </div>
      {(()=>{
        const actions=[]
        const totEnt2=_totEnt
        const overallConv=_engRateNum
        const flowEffVal=_flowEffNum
        const avgEntries=totEnt2/Math.max(rzones.length,1)

        // ─ 긴급 이슈 ─
        // 심각한 병목 구역 (대기 > 20초)
        rzones.filter(z=>(z.avgWait||0)>20).sort((a,b)=>(b.avgWait||0)-(a.avgWait||0)).forEach(z=>{
          actions.push({priority:'urgent',category:'capacity',key:`uw${z.id}`,
            title:`${zLabel(z)} — 심각한 혼잡 (대기 ${z.avgWait}초)`,
            detail:`수용 인원(${z.media?.map(m=>m.name).join(', ')})을 늘리거나 미디어 추가 배치를 검토하세요.`,
          })
        })
        // 스킵율 > 50% 미디어
        allMedia.filter(m=>m.skipRate>50&&m.exposure>0).forEach(m=>{
          actions.push({priority:'urgent',category:'content',key:`um${m.uid}`,
            title:`${m.name} — 스킵율 ${m.skipRate}% 위험`,
            detail:`콘텐츠 길이·내용을 재검토하거나 ${m.zoneName}의 진입 유도를 강화하세요.`,
          })
        })
        // 전환율 < 20%
        if (totEnt2>0&&overallConv<20)
          actions.push({priority:'urgent',category:'flow',key:'uconv',
            title:`전체 체험 전환율 ${overallConv}% — 매우 낮음`,
            detail:'관람객이 미디어를 경험하지 않고 이탈 중입니다. 콘텐츠 노출 시간과 진입 동선을 점검하세요.',
          })

        // ─ 권장 개선 ─
        // 도달률 낮음
        if (rzones.length>0&&flowEffVal<70)
          actions.push({priority:'recommend',category:'flow',key:'rflow',
            title:`도달률 ${flowEffVal}% — 미방문 구역 발생`,
            detail:`${rzones.filter(z=>!(z.entries>0)).map(z=>zLabel(z)).join(', ')||'일부 구역'}이 방문되지 않고 있습니다. 동선 유도 또는 입구 위치를 조정하세요.`,
          })
        // 대기 > 10초 구역
        rzones.filter(z=>(z.avgWait||0)>10&&(z.avgWait||0)<=20).forEach(z=>{
          actions.push({priority:'recommend',category:'capacity',key:`rw${z.id}`,
            title:`${zLabel(z)} — 대기 ${z.avgWait}초 주의`,
            detail:'혼잡 시간대 인력 배치 또는 미디어 수용 인원 소폭 확대를 고려하세요.',
          })
        })
        // 전환율 낮은 구역
        rzones.filter(z=>(z.entries||0)>0&&(z.convRate||0)<30).forEach(z=>{
          actions.push({priority:'recommend',category:'content',key:`rc${z.id}`,
            title:`${zLabel(z)} — 체험 전환율 ${z.convRate||0}%`,
            detail:'초입 미디어 콘텐츠 매력도를 높이거나 관람객 유인 요소를 추가하세요.',
          })
        })
        // 저활용 구역
        rzones.filter(z=>(z.entries||0)>0&&z.entries<avgEntries*0.35).forEach(z=>{
          actions.push({priority:'recommend',category:'zone',key:`ru${z.id}`,
            title:`${zLabel(z)} — 저활용 구역 (진입 ${z.entries}명)`,
            detail:'구역 위치 이동 또는 연결 동선 강화, 안내 미디어 추가를 검토하세요.',
          })
        })
        // 스킵율 > 30% 미디어 (긴급 제외)
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

        return (<>
          {urgentCount>0&&<div style={{fontSize:11,fontWeight:600,color:'#DC2626',marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
            🔴 긴급 {urgentCount}건 — 즉시 개선 필요
          </div>}
          {actions.filter(a=>a.priority==='urgent').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={setTab}/>
          ))}
          {recCount>0&&<div style={{fontSize:11,fontWeight:600,color:'#D97706',marginTop:urgentCount>0?12:0,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
            🟡 권장 개선 {recCount}건
          </div>}
          {actions.filter(a=>a.priority==='recommend').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={setTab}/>
          ))}
          {actions.filter(a=>a.priority==='maintain').length>0&&<div style={{fontSize:11,fontWeight:600,color:'#059669',marginTop:12,marginBottom:6,display:'flex',alignItems:'center',gap:5}}>
            🟢 잘 되고 있는 것들
          </div>}
          {actions.filter(a=>a.priority==='maintain').map(a=>(
            <ActionCard key={a.key} priority={a.priority} category={a.category} title={a.title} detail={a.detail} setTab={null}/>
          ))}
        </>)
      })()}
    </div>
  </>)
}

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
  const gradeC = sr=>sr>50?'#DC2626':sr>20?'#D97706':'#059669'
  return (<>
    <div style={{background:'#fff',border:'1px solid #e8ede8',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',userSelect:'none'}}
        onClick={()=>setOpen(o=>!o)}>
        <span style={{fontSize:10,color:'#9CA3AF',flexShrink:0}}>{log.ts}</span>
        <span style={{fontSize:11,fontWeight:600,color:'#111',flex:1}}>{log.project}</span>
        <span style={{fontSize:10,color:'#6B7280',background:'#E6F7F1',borderRadius:5,padding:'2px 6px',flexShrink:0}}>{log.rangeLabel}</span>
        <span style={{fontSize:10,color:'#6B7280',flexShrink:0}}>입장 {totV}명</span>
        <span style={{fontSize:10,color:avgSR>30?'#DC2626':'#059669',fontWeight:600,flexShrink:0}}>스킵 {avgSR}%</span>
        {avgEng!=='-'&&<span style={{fontSize:10,color:'#7C3AED',fontWeight:600,flexShrink:0}}>★{avgEng}</span>}
        <span style={{fontSize:10,color:'#9CA3AF',flexShrink:0}}>{open?'▲':'▼'}</span>
        <button style={{background:'#E6F7F1',border:'1px solid #A7E3CD',borderRadius:5,cursor:'pointer',fontSize:10,color:'#16855f',padding:'2px 7px',flexShrink:0,fontWeight:600}}
          onClick={e=>{e.stopPropagation(); setDetailOpen(true)}} title="상세 보기">상세 보기</button>
        <button style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#ccc',padding:'0 2px',flexShrink:0}}
          onClick={e=>{e.stopPropagation(); onDelete(log.id)}} title="삭제">✕</button>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid #f0f0f0'}}>
          <div style={{padding:'8px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#9CA3AF',marginBottom:5}}>시간대별 요약</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f8faf8'}}>
                  {['시간대','입장객','스킵율','체류','몰입 강도','병목'].map(h=>(
                    <th key={h} style={{padding:'3px 6px',fontWeight:600,color:'#9CA3AF',textAlign:'center',borderBottom:'1px solid #eee',fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.results.map(r=>(
                  <tr key={r.slot} style={{borderBottom:'0.5px solid rgba(0,0,0,0.05)'}}>
                    <td style={{padding:'4px 6px',fontWeight:500,textAlign:'center'}}>{r.label}</td>
                    <td style={{padding:'4px 6px',textAlign:'center'}}>{r.visitors}명</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:gradeC(r.skipRate),fontWeight:600}}>{r.skipRate}%</td>
                    <td style={{padding:'4px 6px',textAlign:'center'}}>{r.avgDwell}초</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:'#7C3AED'}}>{r.engIdx!=='-'?`★${r.engIdx}`:'-'}</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:r.bottlenecks>0?'#e88':'#ccc'}}>{r.bottlenecks}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {zones.length>0&&(
            <div style={{borderTop:'1px solid #f5f5f5'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',cursor:'pointer'}}
                onClick={()=>setZoneOpen(o=>!o)}>
                <span style={{fontSize:11,fontWeight:600,color:'#9CA3AF'}}>구역 · 미디어 분석</span>
                <span style={{fontSize:10,color:'#bbb'}}>{zoneOpen?'▲':'▼'}</span>
              </div>
              {zoneOpen&&(
                <div style={{padding:'0 12px 10px'}}>
                  {worstMedia.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:9,color:'#9CA3AF',fontWeight:600,marginBottom:4}}>스킵율 높은 미디어 TOP{worstMedia.length}</div>
                      {worstMedia.map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{width:7,height:7,borderRadius:2,background:m.bg||'#eee',border:`1px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                          <span style={{fontSize:10,flex:1,fontWeight:500}}>{m.name}</span>
                          <span style={{fontSize:9,color:'#9CA3AF'}}>{m.zoneName}</span>
                          <span style={{fontSize:10,fontWeight:700,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:10,color:'#7C3AED'}}>★{m.engIdx}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:9,color:'#9CA3AF',fontWeight:600,marginBottom:4}}>구역별 스킵율 · 몰입 강도</div>
                  {zones.map(z=>(
                    <div key={z.id} style={{marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:10,fontWeight:600,flex:1}}>{z.name}{z.floor>0?` (Area ${z.floor+1})`:''}</span>
                        <span style={{fontSize:10,fontWeight:700,color:gradeC(z.skipRate)}}>스킵 {z.skipRate}%</span>
                        {z.engIdx!=null&&<span style={{fontSize:10,color:'#7C3AED'}}>★{z.engIdx}</span>}
                      </div>
                      {z.media.filter(m=>m.exposure>0).map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:5,paddingLeft:10,marginBottom:2}}>
                          <span style={{width:6,height:6,borderRadius:2,background:m.bg||'#eee',border:`1px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                          <span style={{fontSize:10,flex:1,color:'#6B7280'}}>{m.name}</span>
                          <span style={{fontSize:9,color:'#9CA3AF'}}>{m.exposure}회</span>
                          <span style={{fontSize:10,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:10,color:'#7C3AED'}}>★{m.engIdx}</span>}
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
              <span style={{fontSize:13,fontWeight:700,color:'#111'}}>{log.project}</span>
              <span style={{fontSize:11,color:'#9CA3AF'}}>{log.ts} · {log.rangeLabel}</span>
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

export default function ResultPanel({ tab, saveReport }) {
  const { reportData, slotResults, simLogs, setSimLogs, setReportData, setTab } = useSimStore()

  return (
    <div style={{display: tab==='report' ? 'block' : 'none', position:'absolute', inset:0, overflowY:'auto', background:'#F4F5F7'}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'0 24px 40px'}}>
      {/* 헤더 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,padding:'24px 0 16px',borderBottom:'1px solid #E4E6EA'}}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <span style={{fontSize:18,fontWeight:800,color:'#111827',letterSpacing:'-0.02em'}}>Insights</span>
          {reportData && (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              {reportData._logId && simLogs.length > 0 && (()=>{
                const idx = simLogs.findIndex(l=>l.id===reportData._logId)
                const runNo = idx>=0 ? simLogs.length - idx : null
                const log = simLogs[idx]
                return runNo ? (
                  <span style={{fontSize:10,background:'#E6F7F1',border:'1px solid #1D9E75',color:'#1D9E75',borderRadius:4,padding:'1px 6px',fontWeight:700}}>
                    Run #{runNo}
                  </span>
                ) : null
              })()}
              {reportData._logId && simLogs.length > 0 && (()=>{
                const log = simLogs.find(l=>l.id===reportData._logId)
                return log?.scenario ? (
                  <span style={{fontSize:10,color:'#9CA3AF'}}>{log.scenario} · {reportData.range?.label||''}</span>
                ) : null
              })()}
              {!reportData._logId && <span style={{fontSize:11,color:'#9CA3AF'}}>{reportData.range?.label||''}</span>}
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
        ? <div className="rpt-warn caution"><span>●</span><span>시뮬레이션을 실행하면 분석 결과가 표시됩니다.</span></div>
        : <ReportView data={reportData||{slotResults,zones:[],rangeLabel:''}} visible={tab==='report'} setTab={setTab}/>
      }

      {/* ── Run 비교 테이블 ── */}
      {simLogs.length > 0 && (
        <div style={{marginTop:20,background:'#fff',border:'1px solid #E4E6EA',borderRadius:14,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>Run 비교</span>
              <span style={{fontSize:11,color:'#9CA3AF',marginLeft:8}}>최신 {Math.min(simLogs.length,10)}개</span>
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
                    <th key={h} style={{padding:'8px 16px',fontWeight:600,color:'#9CA3AF',textAlign:h===''||h==='시나리오'||h==='범위'?'left':'center',fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
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

                  // 이전 Run 대비 델타 계산
                  const prevTotV = prev?.results?.reduce((s,r)=>s+(r.visitors||0),0) ?? null
                  const prevSR   = prev?.results?.length ? Math.round(prev.results.reduce((s,r)=>s+(r.skipRate||0),0)/prev.results.length) : null
                  const prevEff  = prev?.flowEff ?? null
                  const prevEng  = prev?.engRate ?? null
                  const prevWait = prev?.avgWait ?? null

                  const Delta = ({ cur, prev: pv, unit='%', higherBetter=true }) => {
                    if (cur==null||pv==null) return null
                    const d = cur - pv
                    if (Math.abs(d) < 0.5) return <span style={{fontSize:9,color:'#9CA3AF',marginLeft:3}}>±0</span>
                    const good = higherBetter ? d > 0 : d < 0
                    return (
                      <span style={{fontSize:9,color:good?'#059669':'#DC2626',fontWeight:600,marginLeft:3}}>
                        {d>0?'+':''}{Math.round(d)}{unit}
                      </span>
                    )
                  }

                  // 전체 runs에서 최고값 찾기 (best value highlighting)
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
                        background: isActive ? '#E6F7F1' : i%2===0?'#fff':'#fafafa',
                        borderBottom:'1px solid #f0f0f0',
                        cursor:'pointer',
                        transition:'background 0.15s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background='#E6F7F1'}
                      onMouseLeave={e=>e.currentTarget.style.background=isActive?'#E6F7F1':i%2===0?'#fff':'#fafafa'}
                    >
                      <td style={{padding:'8px 10px',fontWeight:800,color:'#1D9E75',whiteSpace:'nowrap'}}>
                        #{simLogs.length - ([...simLogs].reverse().findIndex(l=>l.id===log.id))}
                        {isActive && <span style={{fontSize:8,background:'#1D9E75',color:'#fff',borderRadius:3,padding:'1px 4px',marginLeft:4}}>현재</span>}
                      </td>
                      <td style={{padding:'8px 10px',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>
                        {log.scenario||log.project}
                      </td>
                      <td style={{padding:'8px 10px',color:'#9CA3AF',whiteSpace:'nowrap'}}>{log.rangeLabel}</td>
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
          <div style={{fontSize:10,color:'#9CA3AF',marginTop:6,textAlign:'right'}}>
            행 클릭 시 해당 Run의 Insights를 불러옵니다 · 🏆 = 항목별 최고값
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
