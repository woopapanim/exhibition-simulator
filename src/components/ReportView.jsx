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
    sr>50 ? {g:'D',c:'#DC2626',bg:'#FEF2F2'} :
    sr>20 ? {g:'C',c:'#D97706',bg:'#FFFBEB'} :
    sr>10 ? {g:'B',c:'#2563EB',bg:'#EFF6FF'} :
            {g:'A',c:'#059669',bg:'#ECFDF5'}

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
          { label:'스킵 건수', data:rzones.map(z=>z.skipCount||0), backgroundColor:rzones.map(z=>z.skipRate>=50?'rgba(226,75,74,0.7)':z.skipRate>=20?'rgba(239,159,39,0.6)':'rgba(55,138,221,0.6)'), borderRadius:4, yAxisID:'y' },
          { label:'스킵율(%)', data:rzones.map(z=>z.skipRate),     type:'line', borderColor:'#EF9F27', backgroundColor:'rgba(239,159,39,0.1)', pointRadius:4, borderWidth:2, yAxisID:'y1' },
          { label:'몰입 강도',    data:rzones.map(z=>z.engIdx||0),    type:'line', borderColor:'#534AB7', backgroundColor:'rgba(83,74,183,0.1)',  pointRadius:4, borderWidth:2, yAxisID:'y2' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display:true, labels:{ font:{size:10}, boxWidth:12 } } },
        scales: {
          y:  { beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{color:'#888',font:{size:10}} },
          y1: { beginAtZero:true, max:100, position:'right', grid:{display:false}, ticks:{color:'#EF9F27',font:{size:10},callback:v=>v+'%'} },
          y2: { beginAtZero:true, max:5,   position:'right', grid:{display:false}, ticks:{color:'#534AB7',font:{size:10}}, display:false },
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
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{flex:1,height:4,background:'#f0f0f0',borderRadius:2,overflow:'hidden',minWidth:40}}>
                        <div style={{height:'100%',width:`${Math.min(100,r.skipRate)}%`,background:r.skipRate>30?'#DC2626':r.skipRate>10?'#D97706':'#059669',borderRadius:2}}/>
                      </div>
                      <span style={{color:r.skipRate>30?'#DC2626':r.skipRate>10?'#D97706':'#059669',fontWeight:600,fontSize:11}}>{r.skipRate}%</span>
                    </div>
                  </td>
                  <td>{r.avgDwell}초</td>
                  <td style={{color:'#7C3AED'}}>{r.engIdx!=='-' ? `★${r.engIdx}` : '-'}</td>
                  <td style={{color:r.bottlenecks>0?'#DC2626':'#888'}}>{r.bottlenecks}건</td>
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
                const densC  = z.heatVal>500 ? '#DC2626' : z.heatVal>100 ? '#D97706' : '#888'
                return (
                  <tr key={z.id}>
                    <td style={{fontWeight:600,textAlign:'left'}}>{zLabel(z)}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{flex:1,height:5,background:'#f0f0f0',borderRadius:3,overflow:'hidden',minWidth:50}}>
                          <div style={{height:'100%',width:`${Math.min(100,z.skipRate)}%`,background:z.skipRate>50?'#DC2626':z.skipRate>20?'#D97706':'#059669',borderRadius:3}}/>
                        </div>
                        <span style={{fontWeight:700,fontSize:12,color:z.skipRate>50?'#DC2626':z.skipRate>20?'#D97706':'#059669'}}>{z.skipRate}%</span>
                      </div>
                    </td>
                    <td style={{color:'#7C3AED',fontSize:11}}>{z.engIdx!==null ? starsOf(z.engIdx)+` (${z.engIdx})` : '-'}</td>
                    <td style={{color:densC,fontSize:11,fontWeight:600}}>{densLv}</td>
                    <td style={{fontSize:11,color:'#888'}}>{z.media.length}개</td>
                    <td><span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,fontSize:11,fontWeight:700,background:g.bg,color:g.c}}>{g.g}</span></td>
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
          미디어별 분석 <span style={{fontSize:10,fontWeight:400,color:'#888'}}>— 스킵율 높은 순</span>
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
                        <span style={{width:10,height:10,borderRadius:3,background:m.bg||'#eee',border:`1.5px solid ${m.color||'#ccc'}`,flexShrink:0}}/>
                        <span style={{fontWeight:500,fontSize:12}}>{m.name}</span>
                      </span>
                    </td>
                    <td style={{textAlign:'left',fontSize:11,color:'#888'}}>{m.zoneName}</td>
                    <td style={{fontSize:11}}>{m.exposure>0 ? `${m.exposure}회` : '-'}</td>
                    <td>
                      {m.exposure > 0 ? (
                        <div style={{display:'flex',alignItems:'center',gap:5}}>
                          <div style={{flex:1,height:4,background:'#f0f0f0',borderRadius:2,overflow:'hidden',minWidth:36}}>
                            <div style={{height:'100%',width:`${Math.min(100,m.skipRate)}%`,background:m.skipRate>50?'#DC2626':m.skipRate>20?'#D97706':'#059669',borderRadius:2}}/>
                          </div>
                          <span style={{fontWeight:700,fontSize:11,color:m.skipRate>50?'#DC2626':m.skipRate>20?'#D97706':'#059669'}}>{m.skipRate}%</span>
                        </div>
                      ) : <span style={{color:'#ccc',fontSize:11}}>-</span>}
                    </td>
                    <td style={{fontSize:11,color:'#7C3AED',fontWeight:600}}>
                      {m.engIdx != null ? `★${m.engIdx}` : <span style={{color:'#ccc'}}>-</span>}
                    </td>
                    <td>
                      {m.exposure > 0
                        ? <span style={{display:'inline-block',padding:'2px 7px',borderRadius:4,fontSize:11,fontWeight:700,background:g.bg,color:g.c}}>{g.g}</span>
                        : <span style={{color:'#ccc',fontSize:11}}>-</span>
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
