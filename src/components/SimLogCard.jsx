import { useState } from 'react'
import ReportView from './ReportView'

export default function SimLogCard({ log, onDelete }) {
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
  const gradeC = sr=>sr>50?'#ef4444':sr>20?'#d97706':'#16a34a'
  return (<>
    <div style={{background:'#fff',border:'none',borderRadius:4,marginBottom:8,overflow:'hidden',
      boxShadow:'0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06)', border:'1px solid #e4e4e7'}}>
      {/* 헤더 행 */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',userSelect:'none'}}
        onClick={()=>setOpen(o=>!o)}>
        <span style={{fontSize:12,color:'#a1a1aa',flexShrink:0}}>{log.ts}</span>
        <span style={{fontSize:13,fontWeight:500,color:'#09090b',flex:1,letterSpacing:'0.0125em'}}>{log.project}</span>
        <span style={{fontSize:11,color:'#18181b',background:'#f4f4f5',borderRadius:2,padding:'2px 6px',flexShrink:0}}>{log.rangeLabel}</span>
        <span style={{fontSize:11,color:'#71717a',flexShrink:0}}>입장 {totV}명</span>
        <span style={{fontSize:11,color:avgSR>30?'#ef4444':'#16a34a',fontWeight:500,flexShrink:0}}>스킵 {avgSR}%</span>
        {avgEng!=='-'&&<span style={{fontSize:11,color:'#7c3aed',fontWeight:500,flexShrink:0}}>★{avgEng}</span>}
        <span className="material-icons" style={{fontSize:16,color:'#a1a1aa'}}>{open?'expand_less':'expand_more'}</span>
        <button style={{background:'transparent',border:'1px solid rgba(0,0,0,0.12)',borderRadius:4,cursor:'pointer',fontSize:12,color:'#18181b',padding:'3px 10px',flexShrink:0,fontWeight:500,letterSpacing:'0.06em'}}
          onClick={e=>{e.stopPropagation(); setDetailOpen(true)}} title="상세 보기">상세</button>
        <button style={{background:'none',border:'none',cursor:'pointer',color:'#a1a1aa',padding:'0 2px',flexShrink:0,display:'flex',alignItems:'center'}}
          onClick={e=>{e.stopPropagation(); onDelete(log.id)}} title="삭제">
          <span className="material-icons" style={{fontSize:16}}>close</span>
        </button>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid rgba(0,0,0,0.12)'}}>
          {/* 시간대별 결과 */}
          <div style={{padding:'8px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:500,color:'#71717a',marginBottom:5,letterSpacing:'0.08em',textTransform:'uppercase'}}>시간대별 요약</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f4f4f5'}}>
                  {['시간대','입장객','스킵율','체류','몰입 강도','병목'].map(h=>(
                    <th key={h} style={{padding:'4px 6px',fontWeight:500,color:'#71717a',textAlign:'center',borderBottom:'1px solid rgba(0,0,0,0.12)',fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.results.map(r=>(
                  <tr key={r.slot} style={{borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
                    <td style={{padding:'4px 6px',fontWeight:500,textAlign:'center'}}>{r.label}</td>
                    <td style={{padding:'4px 6px',textAlign:'center'}}>{r.visitors}명</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:gradeC(r.skipRate),fontWeight:500}}>{r.skipRate}%</td>
                    <td style={{padding:'4px 6px',textAlign:'center'}}>{r.avgDwell}초</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:'#7c3aed'}}>{r.engIdx!=='-'?`★${r.engIdx}`:'-'}</td>
                    <td style={{padding:'4px 6px',textAlign:'center',color:r.bottlenecks>0?'#ef4444':'#a1a1aa'}}>{r.bottlenecks}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 구역·미디어 분석 (zones 있을 때만) */}
          {zones.length>0&&(
            <div style={{borderTop:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',cursor:'pointer'}}
                onClick={()=>setZoneOpen(o=>!o)}>
                <span style={{fontSize:12,fontWeight:500,color:'#71717a',letterSpacing:'0.06em',textTransform:'uppercase'}}>구역 · 미디어 분석</span>
                <span className="material-icons" style={{fontSize:16,color:'#a1a1aa'}}>{zoneOpen?'expand_less':'expand_more'}</span>
              </div>
              {zoneOpen&&(
                <div style={{padding:'0 12px 10px'}}>
                  {worstMedia.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:'#71717a',fontWeight:500,marginBottom:4}}>스킵율 높은 미디어 TOP{worstMedia.length}</div>
                      {worstMedia.map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                          <span style={{width:7,height:7,borderRadius:2,background:m.bg||'#E0E0E0',border:`1px solid ${m.color||'#BDBDBD'}`,flexShrink:0}}/>
                          <span style={{fontSize:11,flex:1,fontWeight:500}}>{m.name}</span>
                          <span style={{fontSize:10,color:'#a1a1aa'}}>{m.zoneName}</span>
                          <span style={{fontSize:11,fontWeight:500,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:11,color:'#7c3aed'}}>★{m.engIdx}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:'#71717a',fontWeight:500,marginBottom:4}}>구역별 스킵율 · 몰입 강도</div>
                  {zones.map(z=>(
                    <div key={z.id} style={{marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:500,flex:1}}>{z.name}{z.floor>0?` (Area ${z.floor+1})`:''}</span>
                        <span style={{fontSize:11,fontWeight:500,color:gradeC(z.skipRate)}}>스킵 {z.skipRate}%</span>
                        {z.engIdx!=null&&<span style={{fontSize:11,color:'#7c3aed'}}>★{z.engIdx}</span>}
                      </div>
                      {z.media.filter(m=>m.exposure>0).map(m=>(
                        <div key={m.uid} style={{display:'flex',alignItems:'center',gap:5,paddingLeft:10,marginBottom:2}}>
                          <span style={{width:6,height:6,borderRadius:2,background:m.bg||'#E0E0E0',border:`1px solid ${m.color||'#BDBDBD'}`,flexShrink:0}}/>
                          <span style={{fontSize:11,flex:1,color:'#71717a'}}>{m.name}</span>
                          <span style={{fontSize:10,color:'#a1a1aa'}}>{m.exposure}회</span>
                          <span style={{fontSize:11,color:gradeC(m.skipRate)}}>{m.skipRate}%</span>
                          {m.engIdx!=null&&<span style={{fontSize:11,color:'#7c3aed'}}>★{m.engIdx}</span>}
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
              <span style={{fontSize:14,fontWeight:500,color:'#09090b',letterSpacing:'0.0125em'}}>{log.project}</span>
              <span style={{fontSize:12,color:'#71717a'}}>{log.ts} · {log.rangeLabel}</span>
            </div>
            <button className="log-modal-close" onClick={()=>setDetailOpen(false)}>
              <span className="material-icons" style={{fontSize:20}}>close</span>
            </button>
          </div>
          <div className="log-modal-body">
            <ReportView data={{slotResults:log.results, zones:log.zones||[], rangeLabel:log.rangeLabel}} visible={detailOpen}/>
          </div>
        </div>
      </div>
    )}
  </>)
}
