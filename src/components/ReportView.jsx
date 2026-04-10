import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

/**
 * ReportView — 시뮬레이션 분석 결과를 시각화하는 공용 컴포넌트
 *
 * @param {{ data: ReportData, visible: boolean }} props
 * @typedef {{ slotResults: SlotResult[], zones: ZoneData[], rangeLabel: string }} ReportData
 */
export default function ReportView({ data, visible = true }) {
  const chartRef  = useRef(null)
  const chartInst = useRef(null)

  const { slotResults: srs = [], zones: rzones = [], rangeLabel = '' } = data || {}

  const multiFloor = rzones.some(z => z.floor > 0)
  const zLabel     = z => multiFloor ? `${z.name} (Area ${z.floor+1})` : z.name

  const totV   = srs.reduce((s,r) => s+r.visitors, 0)
  const avgSR  = srs.length ? Math.round(srs.reduce((s,r) => s+r.skipRate, 0) / srs.length) : 0
  const engNums = srs.map(r => parseFloat(r.engIdx)).filter(n => !isNaN(n))
  const avgEng  = engNums.length ? (engNums.reduce((s,n) => s+n, 0) / engNums.length).toFixed(1) : '-'
  const totBN   = srs.reduce((s,r) => s+r.bottlenecks, 0)
  const allMedia = rzones.flatMap(z => z.media.map(m => ({ ...m, zoneName: zLabel(z) }))).sort((a,b) => b.skipRate-a.skipRate)

  const gradeOf = sr =>
    sr>50 ? {g:'D',c:'#ef4444',bg:'#fef2f2'} :
    sr>20 ? {g:'C',c:'#d97706',bg:'#fffbeb'} :
    sr>10 ? {g:'B',c:'#3b82f6',bg:'#eff6ff'} :
            {g:'A',c:'#16a34a',bg:'#f0fdf4'}

  const starsOf = eng => {
    if (eng === null) return '-'
    const f = Math.round(eng)
    return '★'.repeat(f) + '☆'.repeat(Math.max(0, 5-f))
  }

  // 차트 생성 / 갱신
  useEffect(() => {
    if (!visible || !chartRef.current || !rzones.length) return
    if (chartInst.current) chartInst.current.destroy()
    const mf = rzones.some(z => z.floor > 0)
    const lb  = z => mf ? `${z.name} (Area ${z.floor+1})` : z.name
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: rzones.map(lb),
        datasets: [
          { label:'스킵 건수', data:rzones.map(z=>z.skipCount||0), backgroundColor:rzones.map(z=>z.skipRate>=50?'rgba(239,68,68,0.7)':z.skipRate>=20?'rgba(217,119,6,0.6)':'rgba(24,24,27,0.5)'), borderRadius:4, yAxisID:'y' },
          { label:'스킵율(%)', data:rzones.map(z=>z.skipRate),     type:'line', borderColor:'#d97706', backgroundColor:'rgba(217,119,6,0.1)', pointRadius:4, borderWidth:2, yAxisID:'y1' },
          { label:'몰입 강도',    data:rzones.map(z=>z.engIdx||0),    type:'line', borderColor:'#7c3aed', backgroundColor:'rgba(124,58,237,0.1)',  pointRadius:4, borderWidth:2, yAxisID:'y2' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display:true, labels:{ font:{size:10}, boxWidth:12 } } },
        scales: {
          y:  { beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{color:'#888',font:{size:10}} },
          y1: { beginAtZero:true, max:100, position:'right', grid:{display:false}, ticks:{color:'#d97706',font:{size:10},callback:v=>v+'%'} },
          y2: { beginAtZero:true, max:5,   position:'right', grid:{display:false}, ticks:{color:'#7c3aed',font:{size:10}}, display:false },
        },
      },
    })
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [visible, rzones])

  if (!srs.length && !rzones.length) return null

  return (<>
    {/* ① KPI */}
    <div className="rpt-kpi-row">
      <div className="rpt-kpi">
        <span className="rpt-kpi-v">{totV}<small>명</small></span>
        <span className="rpt-kpi-l">총 입장객</span>
      </div>
      <div className="rpt-kpi">
        <span className={`rpt-kpi-v${avgSR>30?' warn':avgSR<10&&totV>0?' ok':''}`}>{avgSR}<small>%</small></span>
        <span className="rpt-kpi-l">평균 스킵율</span>
      </div>
      <div className="rpt-kpi">
        <span className={`rpt-kpi-v${avgEng!=='-'&&parseFloat(avgEng)>=4?' ok':''}`}>
          {avgEng!=='-' ? <>★<span>{avgEng}</span></> : '-'}
        </span>
        <span className="rpt-kpi-l">평균 몰입 강도</span>
      </div>
      <div className="rpt-kpi">
        <span className={`rpt-kpi-v${totBN>0?' warn':''}`}>{totBN}<small>건</small></span>
        <span className="rpt-kpi-l">병목 발생</span>
      </div>
    </div>

    {/* ② 시간대별 결과 */}
    {srs.length > 0 && (
      <div className="rpt-section">
        <div className="rpt-section-title">시간대별 결과</div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr><th>시간대</th><th>입장객</th><th>스킵율</th><th>평균 체류</th><th>몰입 강도</th><th>병목</th></tr></thead>
            <tbody>
              {srs.map(r => (
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
                  <td style={{color:'var(--color-purple)'}}>{r.engIdx!=='-' ? `★${r.engIdx}` : '-'}</td>
                  <td style={{color:r.bottlenecks>0?'var(--color-error)':'var(--color-text-muted)'}}>{r.bottlenecks}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rzones.length > 0 && (
          <div className="chart-wrap" style={{marginTop:10}}>
            <canvas ref={chartRef}/>
          </div>
        )}
      </div>
    )}

    {/* ③ 구역별 분석 */}
    {rzones.length > 0 && (
      <div className="rpt-section">
        <div className="rpt-section-title">구역별 분석</div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>구역</th><th>스킵율</th><th>몰입 강도</th><th>밀집도</th><th>미디어</th><th>등급</th>
            </tr></thead>
            <tbody>
              {[...rzones].sort((a,b) => b.skipRate-a.skipRate).map(z => {
                const g = gradeOf(z.skipRate)
                const densLv = z.heatVal>500 ? '높음' : z.heatVal>100 ? '보통' : '낮음'
                const densC  = z.heatVal>500 ? 'var(--color-error)' : z.heatVal>100 ? 'var(--color-warning)' : 'var(--color-text-muted)'
                return (
                  <tr key={z.id}>
                    <td style={{fontWeight:600,textAlign:'left'}}>{zLabel(z)}</td>
                    <td>
                      <div className="prog-wrap">
                        <div className="prog-bar" style={{minWidth:50,height:5}}><div className={`prog-fill ${z.skipRate>50?'error':z.skipRate>20?'warn':'success'}`} style={{width:`${Math.min(100,z.skipRate)}%`}}/></div>
                        <span style={{fontWeight:700,fontSize:12,color:z.skipRate>50?'var(--color-error)':z.skipRate>20?'var(--color-warning)':'var(--color-success)'}}>{z.skipRate}%</span>
                      </div>
                    </td>
                    <td style={{color:'var(--color-purple)',fontSize:11}}>{z.engIdx!==null ? starsOf(z.engIdx)+` (${z.engIdx})` : '-'}</td>
                    <td style={{color:densC,fontSize:11,fontWeight:600}}>{densLv}</td>
                    <td style={{fontSize:11,color:'var(--color-text-muted)'}}>{z.media.length}개</td>
                    <td><span className={`badge ${g.g==='A'?'grade-a':g.g==='B'?'grade-b':g.g==='C'?'grade-c':'grade-d'}`}>{g.g}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ④ 미디어별 분석 */}
    {allMedia.length > 0 && (
      <div className="rpt-section">
        <div className="rpt-section-title">
          미디어별 분석 <span style={{fontSize:10,fontWeight:400,color:'var(--color-text-muted)'}}>— 스킵율 높은 순</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="rpt-table">
            <thead><tr>
              <th style={{textAlign:'left'}}>미디어</th>
              <th style={{textAlign:'left'}}>구역</th>
              <th>노출</th><th>스킵율</th><th>몰입 강도</th><th>등급</th>
            </tr></thead>
            <tbody>
              {allMedia.map(m => {
                const g = gradeOf(m.skipRate)
                return (
                  <tr key={m.uid}>
                    <td style={{textAlign:'left'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                        <span className="seg-dot" style={{background:m.bg||'#eee',border:`1.5px solid ${m.color||'#ccc'}`}}/>
                        <span style={{fontWeight:500,fontSize:12}}>{m.name}</span>
                      </span>
                    </td>
                    <td style={{textAlign:'left',fontSize:11,color:'var(--color-text-muted)'}}>{m.zoneName}</td>
                    <td style={{fontSize:11}}>{m.exposure>0 ? `${m.exposure}회` : '-'}</td>
                    <td>
                      {m.exposure > 0 ? (
                        <div className="prog-wrap">
                          <div className="prog-bar"><div className={`prog-fill ${m.skipRate>50?'error':m.skipRate>20?'warn':'success'}`} style={{width:`${Math.min(100,m.skipRate)}%`}}/></div>
                          <span style={{fontWeight:700,fontSize:11,color:m.skipRate>50?'var(--color-error)':m.skipRate>20?'var(--color-warning)':'var(--color-success)'}}>{m.skipRate}%</span>
                        </div>
                      ) : <span style={{color:'var(--color-text-muted)',fontSize:11}}>-</span>}
                    </td>
                    <td style={{fontSize:11,color:'var(--color-purple)',fontWeight:600}}>
                      {m.engIdx != null ? `★${m.engIdx}` : <span style={{color:'var(--color-text-muted)'}}>-</span>}
                    </td>
                    <td>
                      {m.exposure > 0
                        ? <span className={`badge ${g.g==='A'?'grade-a':g.g==='B'?'grade-b':g.g==='C'?'grade-c':'grade-d'}`}>{g.g}</span>
                        : <span style={{color:'var(--color-text-muted)',fontSize:11}}>-</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ⑤ 개선 제안 */}
    <div className="rpt-section">
      <div className="rpt-section-title">개선 제안</div>
      {(()=>{
        const warns = []
        rzones.forEach(z => {
          if (z.skipRate>50)       warns.push(<div key={`z${z.id}sr`}  className="rpt-warn danger" ><span>⚠</span><span><strong>{zLabel(z)}</strong> — 스킵율 {z.skipRate}% 위험. 콘텐츠 길이 단축 또는 동선 유도 개선 필요.</span></div>)
          else if (z.skipRate>20)  warns.push(<div key={`z${z.id}sr2`} className="rpt-warn caution"><span>●</span><span><strong>{zLabel(z)}</strong> — 스킵율 {z.skipRate}% 주의. 첫 5초 집중도 높은 도입부 콘텐츠 추가 권장.</span></div>)
          if (z.engIdx!==null && z.engIdx>=4) warns.push(<div key={`z${z.id}eng`} className="rpt-warn ok"><span>★</span><span><strong>{zLabel(z)}</strong> — 몰입 강도 우수 (★{z.engIdx}). 유사 콘텐츠 확장 검토.</span></div>)
        })
        allMedia.filter(m => m.skipRate>50 && m.exposure>0).forEach(m => {
          warns.push(<div key={`m${m.uid}`} className="rpt-warn danger"><span>⚠</span><span><strong>{m.name}</strong> ({m.zoneName}) — 스킵율 {m.skipRate}%. 콘텐츠 내용·길이 재검토 필요.</span></div>)
        })
        if (avgSR<10 && totV>0) warns.push(<div key="ok" className="rpt-warn ok"><span>✓</span><span>전체 스킵율 {avgSR}% — 우수한 관람 흐름. 현재 배치 유지 권장.</span></div>)
        if (totBN>5)             warns.push(<div key="bn" className="rpt-warn caution"><span>●</span><span>병목 {totBN}건 발생. 입구 주변 구역 수용인원 확대 또는 입장 간격 조정 검토.</span></div>)
        return warns.length > 0 ? warns : <div className="rpt-warn ok"><span>✓</span><span>모든 지표 정상 범위입니다.</span></div>
      })()}
    </div>
  </>)
}
