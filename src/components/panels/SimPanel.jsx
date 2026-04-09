import { useState, useEffect } from 'react'
import useSimStore from '../../store/simulationStore'
import { SLOTS, SEGS, DOCENT_COLOR, VISITOR_TYPES, ALL_MT } from '../../constants'
import { MediaIcon, SliderInput } from '../ui'

export default function SimPanel({
  tab, sCRef,
  startSim, pauseSim, stopSim,
  onZoomIn, onZoomOut, onResetView, panMode, onTogglePan,
  onAnalyzeLog,
}) {
  const {
    simStatus, slot, speed, flowType, circularFlow, slotCfgs,
    simRange, slotResults, skipTable, runningSlot, viewFloor, floorCount, floorSizes,
    simLogs, reportData, dispStats,
    setSlot, setSpeed, setFlowType, setCircularFlow,
    setSlotCfgs, setSimRange, setViewFloor, setTab, setSimLogs, setReportData,
    setConfirmModal,
  } = useSimStore()

  const slotCfg = slotCfgs[slot]
  const segTotal = Object.values(slotCfg.segs).reduce((s,v)=>s+v, 0)
  const vtTotal = Object.values(slotCfg.visitorTypes||{}).reduce((s,v)=>s+v, 0)

  const [showLegend, setShowLegend] = useState(false)
  useEffect(() => {
    if (!showLegend) return
    const handler = (e) => {
      if (!e.target.closest('[data-legend]')) setShowLegend(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLegend])

  return (
    <div style={{display: tab==='sim' ? 'block' : 'none', position:'absolute', inset:0}}>
      <div className="sim-layout">

        {/* ── 좌측 사이드바 (시뮬레이션 컨트롤) ── */}
        <div className="sim-sidebar">

          {/* Area 탭 — Build 탭과 동일 스타일 */}
          <div className="bs-area-row">
            {Array.from({length:floorCount},(_,i)=>(
              <div key={i} className={`bs-area-tab${viewFloor===i?' active':''}`}>
                <button className="bs-area-btn" onClick={()=>setViewFloor(i)}>A{i+1}</button>
              </div>
            ))}
          </div>

          <div className="bs-divider"/>

          {/* 실행 범위 */}
          <div style={{padding:'10px 0'}}>
            <span className="sim-ctrl-label">실행 범위</span>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8}}>
              <select className="sim-ctrl-select" value={simRange.start}
                disabled={simStatus==='running'||simStatus==='paused'}
                onChange={e=>setSimRange(p=>({...p,start:+e.target.value,end:Math.max(+e.target.value,p.end)}))}>
                {SLOTS.map((l,i)=><option key={i} value={i}>{l}</option>)}
              </select>
              <span style={{fontSize:10,color:'#ccc',flexShrink:0}}>—</span>
              <select className="sim-ctrl-select" value={simRange.end}
                disabled={simStatus==='running'||simStatus==='paused'}
                onChange={e=>setSimRange(p=>({...p,end:+e.target.value,start:Math.min(p.start,+e.target.value)}))}>
                {SLOTS.map((l,i)=><option key={i} value={i}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="bs-divider"/>

          {/* 속도 */}
          <div style={{padding:'10px 0'}}>
            <span className="sim-ctrl-label">재생 속도</span>
            <div className="flow-seg" style={{marginTop:8}}>
              {[1,3,5,10].map(v=>(
                <button key={v} className={`flow-btn${speed===v?' active':''}`}
                  style={{flex:1,textAlign:'center'}}
                  onClick={()=>setSpeed(v)}>{v}×</button>
              ))}
            </div>
          </div>

          <div className="bs-divider"/>

          {/* 실행 버튼 */}
          <div style={{padding:'10px 0',display:'flex',flexDirection:'column',gap:6}}>
            <button className="sim-ctrl-btn primary" onClick={startSim}
              disabled={simStatus==='running'||simStatus==='paused'}>
              {simStatus==='running'?'실행 중…':'▶  시작'}
            </button>
            <button className="sim-ctrl-btn" onClick={pauseSim}
              disabled={simStatus==='idle'||simStatus==='done'}>
              {simStatus==='paused'?'▶  계속':'⏸  일시정지'}
            </button>
            <button className="sim-ctrl-btn danger" onClick={()=>stopSim(false)}
              disabled={simStatus==='idle'&&slotResults.length===0}>
              {simStatus==='done'?'↺  초기화':'⏹  종료'}
            </button>
            {simStatus==='running' && (
              <div className="sim-ctrl-status">
                ▶ {SLOTS[runningSlot]} &nbsp;
                <span style={{fontSize:10,fontWeight:400,opacity:0.7}}>{runningSlot-simRange.start+1}/{simRange.end-simRange.start+1}</span>
              </div>
            )}
            {simStatus==='paused' && <div className="sim-ctrl-status paused">⏸ 일시정지</div>}

            {/* 완료 상태 표시 */}
            {simStatus==='done' && (
              <div style={{marginTop:6,padding:'5px 8px',borderRadius:7,background:'rgba(29,158,117,0.08)',border:'1px solid rgba(29,158,117,0.2)',fontSize:10,color:'#1D9E75',fontWeight:600,textAlign:'center'}}>
                ✅ 완료 — 아래 Run History에서 확인하세요
              </div>
            )}
          </div>

          {/* ── Run History ── */}
          {simLogs.length > 0 && (
            <div style={{marginTop:10}}>
              <div className="bs-divider"/>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0 6px'}}>
                <span style={{fontSize:11,fontWeight:600,color:'#6B7280',letterSpacing:'0.03em'}}>RUN HISTORY</span>
                <span style={{fontSize:10,color:'#9CA3AF'}}>{simLogs.length}개</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:260,overflowY:'auto',paddingRight:2}}>
                {simLogs.map((log, idx) => {
                  const runNo = simLogs.length - idx
                  const isActive = reportData && log.id === reportData._logId
                  return (
                    <div key={log.id} style={{
                      background: isActive ? 'linear-gradient(145deg,#0c2318,#163527)' : '#fff',
                      border: `1px solid ${isActive?'rgba(29,158,117,0.35)':'#e8ede8'}`,
                      borderRadius:10, overflow:'hidden',
                    }}>
                      {/* 카드 헤더 */}
                      <div style={{display:'flex',alignItems:'flex-start',gap:6,padding:'8px 10px 7px'}}>
                        <span style={{fontSize:9,fontWeight:800,color:isActive?'#4ade80':'#1D9E75',flexShrink:0,marginTop:1}}>#{runNo}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:10.5,fontWeight:700,color:isActive?'#fff':'#1a2e27',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {log.scenario||log.project||'시나리오'}
                          </div>
                          <div style={{fontSize:9,color:isActive?'rgba(255,255,255,0.45)':'#aaa',marginTop:1.5}}>
                            {log.rangeLabel} · {log.ts||'-'}
                          </div>
                        </div>
                        <button onClick={()=>{
                          setConfirmModal({
                            visible: true,
                            title: `Run #${runNo} 삭제`,
                            message: '이 실행 기록을 삭제하면 Analyze·Insights 데이터도 함께 초기화됩니다.',
                            onConfirm: () => {
                              if (reportData?._logId === log.id) setReportData(null)
                              setSimLogs(prev => {
                                const next = prev.filter(l => l.id !== log.id)
                                try { localStorage.setItem('exsim_logs', JSON.stringify(next)) } catch {}
                                return next
                              })
                            },
                          })
                        }} style={{background:'none',border:'none',color:isActive?'rgba(255,255,255,0.25)':'#ccc',cursor:'pointer',fontSize:11,padding:0,flexShrink:0,lineHeight:1,marginTop:1}}>✕</button>
                      </div>
                      {/* 액션 버튼 */}
                      <div style={{display:'flex',gap:6,padding:'0 8px 8px'}}>
                        <button onClick={()=>onAnalyzeLog?.(log)}
                          style={{flex:1,padding:'6px 0',border:'1px solid #A7E3CD',borderRadius:7,background:'#E6F7F1',fontSize:10,color:'#1D9E75',fontWeight:700,cursor:'pointer',letterSpacing:'0.02em'}}>
                          Analyze
                        </button>
                        <button onClick={()=>{
                          setReportData({
                            zones:log.zones||[],
                            range:log.range||{label:log.rangeLabel},
                            slotResults:log.results||[],
                            flowEff:log.flowEff,
                            engRate:log.engRate,
                            avgWait:log.avgWait,
                            _logId:log.id,
                          })
                          setTab('report')
                        }} style={{flex:1,padding:'6px 0',border:'1px solid #e0d4f7',borderRadius:7,background:'#f5f0ff',fontSize:10,color:'#7C3AED',fontWeight:700,cursor:'pointer',letterSpacing:'0.02em'}}>
                          Insights
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── 우측 메인 영역 ── */}
        <div className="sim-main">

          {/* 슬롯별 설정 */}
          <div className="sim-slot-panel">
            {/* 헤더 */}
            <div className="sim-slot-header">
              <select className="sim-ctrl-select" style={{fontWeight:600,fontSize:12,color:'#0e1c18'}}
                value={slot} onChange={e=>{setSlot(+e.target.value);if(simStatus!=='idle')stopSim()}}>
                {SLOTS.map((l,i)=><option key={i} value={i}>{l} 운영 설정</option>)}
              </select>
              <button className="flow-btn"
                onClick={()=>setSlotCfgs(prev=>prev.map(()=>({...slotCfg,docent:{...slotCfg.docent}})))}>
                전체 복사
              </button>
            </div>

            {/* 섹션 1: 도슨트 투어 */}
            <div style={{padding:'6px 0'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span className="sim-ctrl-label">도슨트 투어</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={slotCfg.docent.enabled}
                    onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,enabled:e.target.checked}}:c))}/>
                  <span className="toggle-track"><span className="toggle-thumb"/></span>
                </label>
              </div>
              {slotCfg.docent.enabled && <>
                <div className="slot-row">
                  <div className="slot-row-top">
                    <span className="slot-row-label">인원</span>
                    <span className="slot-row-val">{slotCfg.docent.size}명</span>
                  </div>
                  <div className="slot-row-slider">
                    <SliderInput min="5" max="50" step="5" value={slotCfg.docent.size}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,size:+e.target.value}}:c))}/>
                  </div>
                </div>
                <div className="slot-row">
                  <div className="slot-row-top">
                    <span className="slot-row-label">간격</span>
                    <span className="slot-row-val">{slotCfg.docent.interval}분</span>
                  </div>
                  <div className="slot-row-slider">
                    <SliderInput min="10" max="120" step="10" value={slotCfg.docent.interval}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,docent:{...c.docent,interval:+e.target.value}}:c))}/>
                  </div>
                </div>
              </>}
            </div>

            <div className="bs-divider"/>

            {/* 섹션 2: 운영 설정 */}
            <div style={{padding:'6px 0'}}>
              <span className="sim-ctrl-label" style={{display:'block',marginBottom:8}}>운영 설정</span>
              <div className="slot-row">
                <div className="slot-row-top">
                  <span className="slot-row-label">
                    입장 속도
                    <span className="info-tip" style={{marginLeft:3}}>
                      <i className="info-tip-icon">i</i>
                      <span className="info-tip-box">
                        분당 입장하는 관람객 수입니다.<br/>
                        낮을수록 입장이 분산되어 초반 혼잡이 줄고,<br/>
                        높을수록 한꺼번에 입장해 병목이 생길 수 있습니다.
                      </span>
                    </span>
                  </span>
                  <span className="slot-row-val">{slotCfg.arrivalRate??5}명/분</span>
                </div>
                <div className="slot-row-slider">
                  <SliderInput min="1" max="20" step="1" value={slotCfg.arrivalRate??5}
                    onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,arrivalRate:+e.target.value}:c))}/>
                </div>
              </div>
              <div className="slot-row">
                <div className="slot-row-top">
                  <span className="slot-row-label">
                    스킵 임계
                    <span className="info-tip" style={{marginLeft:3}}>
                      <i className="info-tip-icon">i</i>
                      <span className="info-tip-box">
                        관람객이 미디어 앞에서 대기할 수 있는 최대 시간입니다.<br/>
                        이 시간을 초과하면 해당 미디어를 포기(스킵)하고 다음으로 이동합니다.<br/>
                        <span style={{color:'#7ecfb3'}}>짧을수록 스킵이 잦고 · 길수록 병목 가능성이 높아집니다.</span>
                      </span>
                    </span>
                  </span>
                  <span className="slot-row-val">{slotCfg.skipThresh}초</span>
                </div>
                <div className="slot-row-slider">
                  <SliderInput min="5" max="60" step="5" value={slotCfg.skipThresh}
                    onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,skipThresh:+e.target.value}:c))}/>
                </div>
              </div>
            </div>

            {!slotCfg.docent.enabled && <div className="bs-divider"/>}

            {/* 섹션 3: 예상 관람객 구성 */}
            {!slotCfg.docent.enabled && <div style={{padding:'6px 0'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span className="sim-ctrl-label">예상 관람객 구성</span>
                <span className={`seg-total${segTotal!==100?' warn':''}`}>합계 {segTotal}%</span>
              </div>
              <div className="slot-row">
                <div className="slot-row-top">
                  <span className="slot-row-label">예상 관람객</span>
                  <span className="slot-row-val">{slotCfg.total}명</span>
                </div>
                <div className="slot-row-slider">
                  <SliderInput min="0" max="200" step="10" value={slotCfg.total}
                    onChange={e=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,total:+e.target.value}:c))}/>
                </div>
              </div>
              {SEGS.map(seg=>(
                <div key={seg.key} className="slot-row">
                  <div className="slot-row-top">
                    <span className="slot-row-label">
                      <span style={{width:6,height:6,borderRadius:'50%',background:seg.color,display:'inline-block',flexShrink:0,marginRight:4}}/>
                      {seg.short||seg.label}
                    </span>
                    <span className="slot-row-val">{slotCfg.segs[seg.key]}%</span>
                  </div>
                  <div className="slot-row-slider">
                    <SliderInput min="0" max="100" step="5" value={slotCfg.segs[seg.key]}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>{
                        if(i!==slot)return c
                        const others=Object.entries(c.segs).filter(([k])=>k!==seg.key).reduce((s,[,v])=>s+v,0)
                        return {...c,segs:{...c.segs,[seg.key]:Math.min(+e.target.value,100-others)}}
                      }))}/>
                  </div>
                </div>
              ))}
            </div>}

            {!slotCfg.docent.enabled && <div className="bs-divider"/>}

            {/* 섹션 4: 방문자 타입 */}
            {!slotCfg.docent.enabled && <div style={{padding:'6px 0'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <span className="sim-ctrl-label">방문자 타입</span>
                <span className={`seg-total${vtTotal!==100?' warn':''}`}>합계 {vtTotal}%</span>
              </div>
              {VISITOR_TYPES.map(vt=>(
                <div key={vt.key} className="slot-row">
                  <div className="slot-row-top">
                    <span className="slot-row-label">
                      <span style={{width:6,height:6,borderRadius:'50%',background:vt.color,display:'inline-block',flexShrink:0,marginRight:4}}/>
                      {vt.label}
                    </span>
                    <span className="slot-row-val">{(slotCfg.visitorTypes||{})[vt.key]??33}%</span>
                  </div>
                  <div className="slot-row-slider">
                    <SliderInput min="0" max="100" step="5"
                      value={(slotCfg.visitorTypes||{})[vt.key]??33}
                      onChange={e=>setSlotCfgs(p=>p.map((c,i)=>{
                        if(i!==slot)return c
                        const vts=c.visitorTypes||{}
                        const others=Object.entries(vts).filter(([k])=>k!==vt.key).reduce((s,[,v])=>s+v,0)
                        return {...c,visitorTypes:{...vts,[vt.key]:Math.min(+e.target.value,100-others)}}
                      }))}/>
                  </div>
                </div>
              ))}
            </div>}

          {/* 슬롯별 시뮬레이션 결과 요약 */}
          {slotResults.length>0 && (
            <div style={{borderRadius:12,overflow:'hidden',background:'#fff',border:'1px solid #E4E6EA'}}>
              <div style={{padding:'8px 12px',background:'#F9FAFB',borderBottom:'1px solid #E4E6EA',fontSize:11,fontWeight:600,color:'#111',display:'flex',alignItems:'center',gap:6}}>
                {simStatus==='done'?'✅':'🔄'} 결과 요약
                <span style={{fontSize:10,color:'#888',fontWeight:400,marginLeft:'auto'}}>
                  {SLOTS[simRange.start]}{simRange.start!==simRange.end?` ~ ${SLOTS[simRange.end]}`:''}
                </span>
              </div>
              {slotResults.map(r=>(
                <div key={r.slot} style={{padding:'8px 12px',borderBottom:'.5px solid #F3F4F6',fontSize:11}}>
                  <div style={{fontWeight:600,color:'#333',marginBottom:4}}>{r.label}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px 12px',color:'#555'}}>
                    <span>관람객 <strong>{r.visitors}명</strong></span>
                    <span>스킵율 <strong style={{color:r.skipRate>30?'#a32d2d':r.skipRate>15?'#633806':'#0f6e56'}}>{r.skipRate}%</strong></span>
                    <span>체류 <strong>{r.avgDwell>0?r.avgDwell+'초':'-'}</strong></span>
                    <span>몰입 <strong style={{color:'#534AB7'}}>{r.engIdx}</strong></span>
                    {r.bottlenecks>0 && <span>병목 <strong style={{color:'#a32d2d'}}>{r.bottlenecks}건</strong></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>

          {/* 캔버스 */}
          <div className="cw" style={{overflow:'hidden'}}>

            {/* ── 시뮬레이션 실행 중 상단 오버레이 ── */}
            {(simStatus==='running'||simStatus==='paused') && (
              <div style={{
                position:'absolute', bottom:52, left:'50%', transform:'translateX(-50%)',
                zIndex:20, display:'flex', alignItems:'center', gap:8,
                background:'rgba(15,30,24,0.82)', backdropFilter:'blur(6px)',
                borderRadius:12, padding:'6px 14px',
                boxShadow:'0 2px 12px rgba(0,0,0,0.25)',
                pointerEvents:'none', whiteSpace:'nowrap',
              }}>
                {/* 슬롯 + 진행 */}
                <span style={{fontSize:11,fontWeight:700,color:'#4ade9e'}}>
                  {SLOTS[runningSlot]}
                </span>
                {simRange.start!==simRange.end && (
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>
                    {runningSlot-simRange.start+1}/{simRange.end-simRange.start+1}
                  </span>
                )}
                <div style={{width:1,height:12,background:'rgba(255,255,255,0.15)'}}/>
                {/* 가상 경과 시간 */}
                <span style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.85)',fontVariantNumeric:'tabular-nums'}}>
                  ⏱ {dispStats?.simTimeDisplay ?? '00:00'}
                </span>
                <div style={{width:1,height:12,background:'rgba(255,255,255,0.15)'}}/>
                {/* 현재 슬롯 방문객 + 진행률 */}
                <span style={{fontSize:11,color:'rgba(255,255,255,0.85)'}}>
                  <span style={{fontWeight:700,color:'#fff'}}>{dispStats?.slotVisitors ?? 0}</span>
                  <span style={{color:'rgba(255,255,255,0.4)'}}>/{dispStats?.slotTotal ?? 0}명</span>
                </span>
                {/* 진행률 바 */}
                <div style={{width:48,height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:'#1D9E75',width:`${dispStats?.slotProgress ?? 0}%`,transition:'width 0.3s'}}/>
                </div>
                {/* 일시정지 표시 */}
                {simStatus==='paused' && (
                  <>
                    <div style={{width:1,height:12,background:'rgba(255,255,255,0.15)'}}/>
                    <span style={{fontSize:10,color:'#facc15',fontWeight:700}}>⏸ 일시정지</span>
                  </>
                )}
              </div>
            )}

            <div style={{position:'relative', display:'inline-block', lineHeight:0}}>
              <canvas ref={sCRef}/>
              {/* 범례 팝업 */}
              {showLegend && (
                <div data-legend style={{
                  position:'absolute', bottom:52, right:12,
                width:210, background:'rgba(255,255,255,0.97)',
                border:'1px solid rgba(0,0,0,0.1)',
                borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.14)',
                padding:'12px 14px', fontSize:11.5, zIndex:30, lineHeight:1.6,
                maxHeight:'calc(100% - 16px)', overflowY:'auto',
              }}>
                <div style={{fontWeight:700, marginBottom:8, fontSize:12}}>시뮬레이션 범례</div>

                {/* 방문객 유형 */}
                <div style={{fontWeight:600, color:'#555', marginBottom:4, fontSize:11}}>방문객 유형 (원 색상)</div>
                {SEGS.map(s=>(
                  <div key={s.key} style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                    <span style={{width:10, height:10, borderRadius:'50%', background:s.color, display:'inline-block', flexShrink:0}}/>
                    <span style={{color:'#333'}}>{s.label}</span>
                  </div>
                ))}
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
                  <span style={{width:10, height:10, borderRadius:'50%', background:DOCENT_COLOR, display:'inline-block', flexShrink:0}}/>
                  <span style={{color:'#333'}}>도슨트</span>
                </div>

                {/* 원 안 숫자·크기 */}
                <div style={{borderTop:'1px solid rgba(0,0,0,0.07)', paddingTop:8, marginBottom:6}}>
                  <div style={{fontWeight:600, color:'#555', marginBottom:4, fontSize:11}}>원 표시</div>
                  <div style={{color:'#444', marginBottom:3}}><strong>숫자</strong> — 그룹 인원 수</div>
                  <div style={{color:'#444', marginBottom:3}}><strong>원 크기</strong> — 그룹 규모 비례</div>
                </div>

                {/* 상태 색상 */}
                <div style={{borderTop:'1px solid rgba(0,0,0,0.07)', paddingTop:8, marginBottom:6}}>
                  <div style={{fontWeight:600, color:'#555', marginBottom:4, fontSize:11}}>방문객 상태</div>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                    <span style={{width:10, height:10, borderRadius:'50%', border:'2px solid #1D9E75', display:'inline-block', flexShrink:0, boxSizing:'border-box'}}/>
                    <span style={{color:'#333'}}>체험 중</span>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                    <span style={{width:10, height:10, borderRadius:'50%', background:'#E24B4A', display:'inline-block', flexShrink:0}}/>
                    <span style={{color:'#333'}}>대기 중</span>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                    <span style={{width:10, height:10, borderRadius:'50%', background:'#EF9F27', display:'inline-block', flexShrink:0}}/>
                    <span style={{color:'#333'}}>스킵 — 대기 포기 후 이동</span>
                  </div>
                </div>

                {/* 미디어 게이지 */}
                <div style={{borderTop:'1px solid rgba(0,0,0,0.07)', paddingTop:8}}>
                  <div style={{fontWeight:600, color:'#555', marginBottom:4, fontSize:11}}>미디어 아이콘</div>
                  <div style={{color:'#444', marginBottom:3}}><strong>하단 게이지</strong> — 현재 점유율 (정원 대비)</div>
                  <div style={{color:'#444'}}><strong>배회</strong> — 미디어 주변을 맴도는 방문객은 자리 날 때까지 대기 중</div>
                </div>
              </div>
            )}
            </div>{/* wrapper end */}
            {/* 줌 컨트롤 — .cw 기준 하단 중앙 고정 */}
            <div className="canvas-zoom-ctrl">
              <button className="canvas-zoom-btn" onClick={onZoomIn} title="확대">+</button>
              <button className="canvas-zoom-btn" onClick={onResetView} title="뷰 초기화" style={{fontSize:9,padding:'0 4px'}}>⟲</button>
              <button className="canvas-zoom-btn" onClick={onZoomOut} title="축소">−</button>
              <div style={{width:1,height:16,background:'rgba(0,0,0,0.1)',margin:'0 2px'}}/>
              <button className="canvas-zoom-btn" onClick={onTogglePan} title="이동"
                style={{background:panMode?'rgba(29,158,117,0.15)':undefined, color:panMode?'#1D9E75':undefined}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              </button>
              <div style={{width:1,height:16,background:'rgba(0,0,0,0.1)',margin:'0 2px'}}/>
              <button data-legend className="canvas-zoom-btn" title="시뮬레이션 범례"
                onClick={()=>setShowLegend(v=>!v)}
                style={{fontSize:13, lineHeight:1, width:22, height:22, background: showLegend?'rgba(29,100,220,0.12)':undefined, color: showLegend?'#1D64DC':undefined}}
              >ⓘ</button>
            </div>
          </div>{/* .cw end */}

        </div>
      </div>
    </div>
  )
}
