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
  const gradeC = sr=>sr>50?'#DC2626':sr>20?'#D97706':'#059669'
  return (<>
    <div style={{background:'#fff',border:'1px solid #e8ede8',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      {/* 헤더 행 */}
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
          {/* 시간대별 결과 */}
          <div style={{padding:'8px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#6B7280',marginBottom:5}}>시간대별 요약</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f8faf8'}}>
                  {['시간대','입장객','스킵율','체류','몰입 강도','병목'].map(h=>(
                    <th key={h} style={{padding:'3px 6px',fontWeight:600,color:'#9CA3AF',textAlign:'center',borderBottom:'1px solid #eee',fontSize:10}}>{h}</th>
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

          {/* 구역·미디어 분석 (zones 있을 때만) */}
          {zones.length>0&&(
            <div style={{borderTop:'1px solid #f5f5f5'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 12px',cursor:'pointer'}}
                onClick={()=>setZoneOpen(o=>!o)}>
                <span style={{fontSize:11,fontWeight:600,color:'#6B7280'}}>구역 · 미디어 분석</span>
                <span style={{fontSize:10,color:'#bbb'}}>{zoneOpen?'▲':'▼'}</span>
              </div>
              {zoneOpen&&(
                <div style={{padding:'0 12px 10px'}}>
                  {worstMedia.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:'#9CA3AF',fontWeight:600,marginBottom:4}}>스킵율 높은 미디어 TOP{worstMedia.length}</div>
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
                  <div style={{fontSize:11,color:'#9CA3AF',fontWeight:600,marginBottom:4}}>구역별 스킵율 · 몰입 강도</div>
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
