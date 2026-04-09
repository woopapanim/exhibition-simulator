import { SLOTS, SEGS, DOCENT_COLOR, VISITOR_TYPES } from '../constants'
import { SliderInput, MediaIcon } from './ui'
import { ALL_MT } from '../constants'

/**
 * RunPanel — Simulate 탭 + Heatmap 탭 UI
 */
export default function RunPanel({
  tab,
  // sim state
  simStatus,
  slot,
  speed,
  simRange,
  slotCfgs,
  slotCfg,
  segTotal,
  vtTotal,
  flowType,
  circularFlow,
  floorCount,
  viewFloor,
  heatTimeline,
  heatScrubIdx,
  canvasZoom,
  slotResults,
  skipTable,
  runningSlot,
  // setters
  setSlot,
  setSpeed,
  setSimRange,
  setSlotCfgs,
  setFlowType,
  setCircularFlow,
  setViewFloor,
  setHeatScrubIdx,
  setCanvasZoom,
  // refs
  sCRef,
  hCRef,
  heatScrubSnapRef,
  // actions
  startSim,
  pauseSim,
  stopSim,
  drawBuild,
}) {
  // ── Simulate 탭 ──
  const SimTab = () => (
    <div style={{display: tab==='sim' ? '' : 'none'}}>
      <div className="sim-layout">

        {/* ── 좌측 사이드바 ── */}
        <div className="sim-sidebar">

          {/* 실행 범위 */}
          <div className="sim-ctrl-section">
            <span className="sim-ctrl-label">실행 범위</span>
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6}}>
              <select className="sim-ctrl-select" value={simRange.start}
                disabled={simStatus==='running'||simStatus==='paused'}
                onChange={e=>setSimRange(p=>({...p,start:+e.target.value,end:Math.max(+e.target.value,p.end)}))}>
                {SLOTS.map((l,i)=><option key={i} value={i}>{l}</option>)}
              </select>
              <span style={{fontSize:10,color:'#9CA3AF'}}>~</span>
              <select className="sim-ctrl-select" value={simRange.end}
                disabled={simStatus==='running'||simStatus==='paused'}
                onChange={e=>setSimRange(p=>({...p,end:+e.target.value,start:Math.min(p.start,+e.target.value)}))}>
                {SLOTS.map((l,i)=><option key={i} value={i}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* 속도 */}
          <div className="sim-ctrl-section">
            <span className="sim-ctrl-label">재생 속도</span>
            <div className="spd-wrap" style={{marginTop:6,width:'100%',borderRadius:8}}>
              {[1,3,6].map(v=>(
                <button key={v} className={`sp${speed===v?' active':''}`}
                  style={{flex:1,padding:'5px 0',fontSize:12}}
                  onClick={()=>setSpeed(v)}>{v}x</button>
              ))}
            </div>
          </div>

          {/* 실행 버튼 */}
          <div className="sim-ctrl-section">
            <button className="sim-ctrl-btn primary" onClick={startSim}
              disabled={simStatus==='running'||simStatus==='paused'}>
              {simStatus==='idle'
                ? '시뮬레이션 실행'
                : simStatus==='running'
                  ? '실행 중...'
                  : '다시 실행'}
            </button>
            <button className="sim-ctrl-btn" onClick={pauseSim}
              disabled={simStatus==='idle'||simStatus==='done'} style={{marginTop:6}}>
              {simStatus==='paused'?'▶ 계속':'⏸ 일시정지'}
            </button>
            <button className="sim-ctrl-btn danger" onClick={()=>stopSim(false)}
              disabled={simStatus==='idle'&&slotResults.length===0} style={{marginTop:6}}>
              {simStatus==='done'?'↺ 초기화':'⏹ 종료'}
            </button>
          </div>

          {/* 실행 상태 */}
          {simStatus==='running' && (
            <div className="sim-ctrl-status">
              ▶ {SLOTS[runningSlot]}<br/>
              <span style={{fontSize:9,color:'#9CA3AF'}}>{runningSlot-simRange.start+1} / {simRange.end-simRange.start+1} 슬롯</span>
            </div>
          )}
          {simStatus==='done' && (
            <div className="sim-ctrl-status done">✅ 완료</div>
          )}
          {simStatus==='paused' && (
            <div className="sim-ctrl-status paused">⏸ 일시정지</div>
          )}
        </div>

        {/* ── 우측 메인 영역 ── */}
        <div className="sim-main">

          {/* 시간대 탭 */}
          <div className="time-bar" style={{marginBottom:8}}>
            <span style={{fontSize:11,color:'#9CA3AF',flexShrink:0}}>시간대:</span>
            {SLOTS.map((label,i)=>(
              <button key={i} className={`tb${slot===i?' active':''}`}
                onClick={()=>{setSlot(i);if(simStatus!=='idle')stopSim(false)}}>{label}</button>
            ))}
          </div>

          {/* 슬롯별 설정 */}
          <div className="sim-slot-panel">
            <div className="sim-slot-header">
              <span className="sim-slot-title">{SLOTS[slot]} 운영 설정</span>
              <button className="btn-s"
                onClick={()=>setSlotCfgs(prev=>prev.map(()=>({...slotCfg,docent:{...slotCfg.docent}})))}>
                전체 시간대에 복사
              </button>
            </div>

            {/* 섹션 1: 관람객 구성 */}
            <div className="sim-section">
              <span className="sim-sec-label">관람객 구성</span>
              <div className="sim-sec-body">
                <div className="cg">
                  <span className="cl">총 관람객</span>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <SliderInput min="0" max="200" step="10" value={slotCfg.total}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,total:+e.target.value}:c))}/>
                    <span className="cv">{slotCfg.total}명</span>
                  </div>
                </div>
                {SEGS.map(seg=>(
                  <div key={seg.key} className="cg">
                    <span className="cl">
                      <span style={{width:7,height:7,borderRadius:'50%',background:seg.color,display:'inline-block',flexShrink:0}}/>
                      {seg.label}
                    </span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <SliderInput min="0" max="100" step="5" value={slotCfg.segs[seg.key]}
                        onChange={e=>setSlotCfgs(p=>p.map((c,i)=>{
                          if(i!==slot)return c
                          const others=Object.entries(c.segs).filter(([k])=>k!==seg.key).reduce((s,[,v])=>s+v,0)
                          return {...c,segs:{...c.segs,[seg.key]:Math.min(+e.target.value,100-others)}}
                        }))}/>
                      <span className="cv">{slotCfg.segs[seg.key]}%</span>
                    </div>
                  </div>
                ))}
                <div className="sim-total-badge">
                  <span className={`seg-total${segTotal!==100?' warn':''}`}>합계 {segTotal}%</span>
                </div>
              </div>
            </div>

            <div className="sim-sec-divider"/>

            {/* 섹션 2: 방문자 타입 */}
            <div className="sim-section">
              <span className="sim-sec-label">방문자 타입</span>
              <div className="sim-sec-body">
                {VISITOR_TYPES.map(vt=>(
                  <div key={vt.key} className="cg">
                    <span className="cl" style={{display:'flex',alignItems:'center',gap:3}}>
                      <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:vt.color,flexShrink:0}}/>
                      <MediaIcon id={vt.key==='immersive'?'immersiveV':vt.key} size={11} color={vt.color}/> {vt.label}
                    </span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <SliderInput min="0" max="100" step="5"
                        value={(slotCfg.visitorTypes||{})[vt.key]??33}
                        onChange={e=>setSlotCfgs(p=>p.map((c,i)=>{
                          if(i!==slot)return c
                          const vts=c.visitorTypes||{}
                          const others=Object.entries(vts).filter(([k])=>k!==vt.key).reduce((s,[,v])=>s+v,0)
                          return {...c,visitorTypes:{...vts,[vt.key]:Math.min(+e.target.value,100-others)}}
                        }))}/>
                      <span className="cv">{(slotCfg.visitorTypes||{})[vt.key]??33}%</span>
                    </div>
                  </div>
                ))}
                <div className="sim-total-badge">
                  <span className={`seg-total${vtTotal!==100?' warn':''}`}>합계 {vtTotal}%</span>
                </div>
              </div>
            </div>

            <div className="sim-sec-divider"/>

            {/* 섹션 3: 운영 설정 */}
            <div className="sim-section">
              <span className="sim-sec-label">운영 설정</span>
              <div className="sim-sec-body">
                <div className="cg">
                  <span className="cl">스킵 임계</span>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <SliderInput min="5" max="60" step="5" value={slotCfg.skipThresh}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,skipThresh:+e.target.value}:c))}/>
                    <span className="cv">{slotCfg.skipThresh}초</span>
                  </div>
                </div>
                <div className="cg">
                  <span className="cl">도슨트 투어</span>
                  <label className={`sim-pill-toggle${slotCfg.docent.enabled?' active-docent':''}`}>
                    <input type="checkbox" checked={slotCfg.docent.enabled}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,enabled:e.target.checked}}:c))}
                      style={{accentColor:'#B87D2B'}}/>
                    도슨트 투어
                  </label>
                </div>
                {slotCfg.docent.enabled && <>
                  <div className="cg">
                    <span className="cl">인원</span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <SliderInput min="5" max="50" step="5" value={slotCfg.docent.size}
                        onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,size:+e.target.value}}:c))}/>
                      <span className="cv">{slotCfg.docent.size}명</span>
                    </div>
                  </div>
                  <div className="cg">
                    <span className="cl">간격</span>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <SliderInput min="10" max="120" step="10" value={slotCfg.docent.interval}
                        onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,interval:+e.target.value}}:c))}/>
                      <span className="cv">{slotCfg.docent.interval}분</span>
                    </div>
                  </div>
                </>}
                <div className="cg">
                  <span className="cl">동선</span>
                  <select value={flowType} onChange={e=>{setFlowType(e.target.value);if(simStatus!=='idle')stopSim(false)}}>
                    <option value="guided">유도 동선</option>
                    <option value="free">자유 동선</option>
                    <option value="hybrid">혼합형 동선</option>
                  </select>
                </div>
                <div className="cg">
                  <span className="cl">레이아웃</span>
                  <label className={`sim-pill-toggle${circularFlow?' active-circular':''}`}>
                    <input type="checkbox" checked={circularFlow}
                      onChange={e=>{setCircularFlow(e.target.checked);drawBuild()}}
                      style={{accentColor:'#22C55E',cursor:'pointer'}}/>
                    순환형 (입구=출구)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 층 탭 */}
          <div className="floor-bar">
            {Array.from({length:floorCount},(_,i)=>(
              <button key={i} className={`floor-btn${viewFloor===i?' active':''}`} onClick={()=>setViewFloor(i)}>Area {i+1}</button>
            ))}
          </div>

          {/* 캔버스 */}
          <div className="cw" style={{overflow: canvasZoom>1?'auto':'hidden', padding: canvasZoom<1?'16px':0}}>
            <canvas ref={sCRef} style={{width:`${canvasZoom*100}%`}}/>
            <div className="canvas-zoom-ctrl">
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))}>+</button>
              <span className="canvas-zoom-val">{Math.round(canvasZoom*100)}%</span>
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.max(0.3,+(z-0.1).toFixed(1)))}>−</button>
            </div>
          </div>

          {/* 범례 */}
          <div className="legend">
            {SEGS.map(s=>(
              <span key={s.key} className="li">
                <span className="ld" style={{background:s.color}}/>{s.label}
              </span>
            ))}
            {slotCfg.docent.enabled && <span className="li"><span className="ld" style={{background:DOCENT_COLOR}}/>🎓 도슨트</span>}
            <span className="li"><span className="ld" style={{background:'#E24B4A'}}/>대기중</span>
            <span className="li"><span className="ld" style={{background:'#EF9F27'}}/>스킵</span>
            <span className="li"><span style={{width:8,height:8,borderRadius:'50%',border:'2px solid #1D9E75',display:'inline-block'}}/> 체험중</span>
          </div>

          {/* 슬롯 결과 패널 */}
          {slotResults.length>0 && (
            <div style={{borderRadius:14,overflow:'hidden',marginTop:8,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.05)',border:'1px solid rgba(0,0,0,0.06)'}}>
              <div style={{padding:'9px 14px',background:'#FAFAFA',borderBottom:'1px solid rgba(0,0,0,0.07)',fontSize:11,fontWeight:600,color:'#111',display:'flex',alignItems:'center',gap:6}}>
                {simStatus==='done'?'✅':'🔄'} 시뮬레이션 결과
                <span style={{fontSize:10,color:'#9CA3AF',fontWeight:400}}>
                  {SLOTS[simRange.start]}{simRange.start!==simRange.end?` ~ ${SLOTS[simRange.end]}`:''}
                </span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'#F7F7F7'}}>
                      {['시간대','관람객','스킵율','평균체류','몰입 강도','병목'].map(h=>(
                        <th key={h} style={{padding:'5px 10px',textAlign:'left',color:'#9CA3AF',fontWeight:600,fontSize:10,borderBottom:'1px solid rgba(0,0,0,0.07)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slotResults.map(r=>(
                      <tr key={r.slot} style={{borderBottom:'.5px solid rgba(0,0,0,0.06)'}}>
                        <td style={{padding:'5px 10px',fontWeight:500}}>{r.label}</td>
                        <td style={{padding:'5px 10px'}}>{r.visitors}명</td>
                        <td style={{padding:'5px 10px',color:r.skipRate>30?'#a32d2d':r.skipRate>15?'#633806':'#0f6e56',fontWeight:500}}>{r.skipRate}%</td>
                        <td style={{padding:'5px 10px'}}>{r.avgDwell>0?r.avgDwell+'초':'-'}</td>
                        <td style={{padding:'5px 10px',color:'#534AB7',fontWeight:500}}>{r.engIdx}</td>
                        <td style={{padding:'5px 10px',color:r.bottlenecks>0?'#a32d2d':'#9CA3AF'}}>{r.bottlenecks}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 스킵율 + 몰입 강도 테이블 */}
          <div className="skip-panel">
            <div className="skip-head">
              <span className="skip-title">스킵율 · 몰입 강도 인덱스</span>
              <span style={{fontSize:11,color:'#9CA3AF'}}>대기 {slotCfg.skipThresh}초 초과 시 스킵</span>
            </div>
            <div className="skip-row-head">
              <span>존 / 미디어</span><span>스킵</span><span>체험</span><span>스킵율</span><span>몰입 강도</span>
            </div>
            {skipTable.length===0 ? (
              <div style={{padding:'10px 14px',fontSize:12,color:'#9CA3AF'}}>시뮬레이션을 시작하면 집계돼요.</div>
            ) : skipTable.map(({zone,zs,rate,zEng,media})=>(
              <div key={zone.id}>
                <div className="skip-row" style={{background:rate>50?'rgba(226,75,74,0.05)':rate>20?'rgba(239,159,39,0.04)':'transparent'}}>
                  <span style={{fontWeight:500}}>{zone.name}</span>
                  <span style={{color:'#a32d2d'}}>{zs.skip}</span>
                  <span style={{color:'#0f6e56'}}>{zs.exp}</span>
                  <span><span className={`idx-badge idx-${rate>50?'bad':rate>20?'warn':'good'}`}>{rate}% {rate>50?'위험':rate>20?'주의':'양호'}</span></span>
                  <span className="eng-badge">{zEng!=='-'?`★ ${zEng}`:'-'}</span>
                </div>
                {media.map(({m,ms,mr,mEng})=>(
                  <div key={m.uid} className="skip-row" style={{background:'#F7F7F7'}}>
                    <span style={{fontSize:11,color:'#9CA3AF',paddingLeft:10,display:'flex',alignItems:'center',gap:5}}><MediaIcon id={m.type} size={13} color={ALL_MT.find(t=>t.id===m.type)?.color||'#9CA3AF'}/> {m.label} <span style={{fontSize:10}}>({m.dwell}초)</span></span>
                    <span style={{fontSize:11,color:'#a32d2d'}}>{ms.skip}</span>
                    <span style={{fontSize:11,color:'#0f6e56'}}>{ms.exp}</span>
                    <div>
                      <div className="bar-wrap"><div className="bar-fill" style={{width:`${mr}%`,background:mr>50?'#E24B4A':mr>20?'#EF9F27':'#1D9E75'}}/></div>
                      <span style={{fontSize:10,color:'#9CA3AF'}}>{mr}%</span>
                    </div>
                    <span style={{fontSize:11,color:'#534AB7',fontWeight:600}}>{mEng!=='-'?`★${mEng}`:'-'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Heatmap 탭 ──
  const HeatTab = () => (
    <div style={{display: tab==='heat' ? '' : 'none'}}>
      <div className="sim-layout">

        {/* 히트맵 사이드바 */}
        <div className="sim-sidebar">
          <div className="heat-legend-section">
            <div className="heat-legend-title">밀집도</div>
            <div className="heat-legend-bar"/>
            <div className="heat-legend-labels">
              <span>낮음</span><span>높음</span>
            </div>
          </div>

          <div className="heat-legend-section">
            <div className="heat-legend-title">스킵율</div>
            {[{c:'#059669',bg:'#ECFDF5',l:'양호 (0~20%)'},{c:'#D97706',bg:'#FFFBEB',l:'주의 (21~50%)'},{c:'#DC2626',bg:'#FEF2F2',l:'위험 (>50%)'}].map(({c,bg,l})=>(
              <div key={c} className="heat-legend-item">
                <span className="heat-legend-dot" style={{background:bg,border:`1.5px solid ${c}`}}/>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {heatTimeline.length>0 && (
            <div className="heat-legend-section">
              <div className="heat-legend-title">스냅샷</div>
              <div className="heat-snap-info">
                <div className="heat-snap-row">
                  <span>슬롯</span>
                  <strong>{heatTimeline[heatScrubIdx]?.slotLabel||'-'}</strong>
                </div>
                <div className="heat-snap-row">
                  <span>진행</span>
                  <strong>{heatScrubIdx===heatTimeline.length-1?'완료':`${heatTimeline[heatScrubIdx]?.pct||0}%`}</strong>
                </div>
                <div className="heat-snap-frame">{heatScrubIdx+1} / {heatTimeline.length} 프레임</div>
              </div>
            </div>
          )}
        </div>

        {/* 히트맵 메인 */}
        <div className="sim-main">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:11,color:'#9CA3AF'}}>
              {heatTimeline.length===0
                ? '시뮬레이션 후 누적 밀집도가 표시돼요.'
                : '타임라인을 드래그해 시뮬레이션 과정을 재생하세요.'}
            </span>
            {floorCount>1 && (
              <div className="floor-bar" style={{margin:0}}>
                {Array.from({length:floorCount},(_,i)=>(
                  <button key={i} className={`floor-btn${viewFloor===i?' active':''}`}
                    onClick={()=>setViewFloor(i)}>Area {i+1}</button>
                ))}
              </div>
            )}
          </div>

          {/* 타임라인 스크러버 */}
          {heatTimeline.length>1 && (()=>{
            const cur=heatTimeline[heatScrubIdx]
            const isFinal=heatScrubIdx===heatTimeline.length-1
            const total=heatTimeline.length-1
            const jump=idx=>{
              const s=heatTimeline[idx]
              heatScrubSnapRef.current=(s&&idx<total)?s:null
              setHeatScrubIdx(idx)
            }
            const ticks=[]
            heatTimeline.forEach((s,i)=>{
              if (i===0||heatTimeline[i-1].slotIdx!==s.slotIdx)
                ticks.push({i, label:s.slotLabel})
            })
            const fillPct=total>0?Math.round(heatScrubIdx/total*100):100
            const trackBg=`linear-gradient(to right,#00c896 0%,#00c896 ${fillPct}%,#e0eae6 ${fillPct}%,#e0eae6 100%)`
            return (
              <div className="heat-nav">
                <div className="heat-nav-info-bar">
                  {isFinal
                    ? <span className="heat-nav-badge final">✅ 최종 결과</span>
                    : <><span className="heat-nav-badge">{cur?.slotLabel}</span>
                      <span className="heat-nav-pct">{cur?.pct}% 진행</span></>
                  }
                  <span className="heat-nav-frame">{heatScrubIdx+1} / {heatTimeline.length}</span>
                </div>
                <div className="heat-nav-track-row">
                  <button className="heat-nav-arrow" disabled={heatScrubIdx===0}
                    onClick={()=>jump(Math.max(0,heatScrubIdx-1))}>◀</button>
                  <div className="heat-nav-slider-wrap">
                    <input type="range" className="heat-nav-slider"
                      min={0} max={total} value={heatScrubIdx}
                      style={{background:trackBg}}
                      onChange={e=>jump(+e.target.value)}/>
                    <div className="heat-nav-ticks">
                      {ticks.map(({i,label})=>(
                        <span key={i} className="heat-nav-tick-item"
                          style={{left:`${total>0?i/total*100:0}%`}}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="heat-nav-arrow" disabled={heatScrubIdx===total}
                    onClick={()=>jump(Math.min(total,heatScrubIdx+1))}>▶</button>
                </div>
              </div>
            )
          })()}

          {/* 캔버스 */}
          <div className="cw" style={{overflow:canvasZoom>1?'auto':'hidden',padding:canvasZoom<1?'16px':0}}>
            <canvas ref={hCRef} style={{width:`${canvasZoom*100}%`}}/>
            <div className="canvas-zoom-ctrl">
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))}>+</button>
              <span className="canvas-zoom-val">{Math.round(canvasZoom*100)}%</span>
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.max(0.3,+(z-0.1).toFixed(1)))}>−</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <SimTab/>
      <HeatTab/>
    </>
  )
}

