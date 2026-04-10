import { useState, useEffect, useRef, useCallback } from 'react'

// 클릭하면 입력 가능한 값 표시 컴포넌트
function EditableVal({ value, unit, min, max, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function startEdit() { setDraft(String(value)); setEditing(true) }
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  function commit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setEditing(false)
  }

  if (editing) return (
    <span style={{display:'inline-flex',alignItems:'center',gap:2}}>
      <input ref={inputRef} type="number" value={draft}
        onChange={e=>setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') setEditing(false) }}
        style={{
          width:46, padding:'1px 4px', fontSize:12, fontWeight:700,
          border:'1.5px solid #1D9E75', borderRadius:5, outline:'none',
          textAlign:'right', color:'#111827',
        }}/>
      <span style={{fontSize:11,color:'#6B7280'}}>{unit}</span>
    </span>
  )
  return (
    <span className="slot-row-val" onClick={startEdit}
      style={{cursor:'text', borderBottom:'1px dashed #D1D5DB'}}
      title="클릭하여 직접 입력">
      {value}{unit}
    </span>
  )
}
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
  const [activePanel, setActivePanel] = useState('slot') // 'slot' | 'stats' | 'history' | null
  const togglePanel = (name) => setActivePanel(prev => prev === name ? null : name)
  const showSlotPanel = activePanel === 'slot'
  const showStats     = activePanel === 'stats'
  const showHistory   = activePanel === 'history'
  const sidebarRef = useRef(null)
  const [sidebarH, setSidebarH] = useState(0)
  useEffect(() => {
    if (!sidebarRef.current) return
    const ro = new ResizeObserver(() => setSidebarH(sidebarRef.current?.offsetHeight || 0))
    ro.observe(sidebarRef.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!showLegend) return
    const handler = (e) => {
      if (!e.target.closest('[data-legend]')) setShowLegend(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLegend])

  useEffect(() => {
    if (simStatus === 'done') setActivePanel('history')
  }, [simStatus])

  return (
    <div style={{display: tab==='sim' ? 'block' : 'none', position:'absolute', inset:0}}>
      <div className="sim-layout">

        {/* ── 좌측 사이드바 (시뮬레이션 컨트롤) ── */}
        <div className="sim-sidebar" ref={sidebarRef}>

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
            <button className="sim-ctrl-btn primary" onClick={()=>{ startSim(); setActivePanel('stats') }}
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
              <div style={{marginTop:6,padding:'6px 8px',borderRadius:7,background:'#ECFDF5',border:'1px solid #A7F3D0',fontSize:11,color:'#059669',fontWeight:600,textAlign:'center',letterSpacing:'0.02em'}}>
                완료
              </div>
            )}

            {/* ── 실행 중 진행 상태 ── */}
            {(simStatus==='running'||simStatus==='paused') && (
              <div style={{
                marginTop:8, padding:'10px 12px', borderRadius:10,
                background:'#F9FAFB', border:'1px solid var(--color-border)',
              }}>
                {/* 슬롯 + 시간 */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#111827'}}>
                    {SLOTS[runningSlot]}
                    {simRange.start!==simRange.end && (
                      <span style={{fontSize:10,fontWeight:400,color:'#9CA3AF',marginLeft:5}}>
                        {runningSlot-simRange.start+1}/{simRange.end-simRange.start+1}
                      </span>
                    )}
                  </span>
                  <span style={{fontSize:11,fontWeight:600,color:'#6B7280',fontVariantNumeric:'tabular-nums'}}>
                    {dispStats?.simTimeDisplay ?? '00:00'}
                  </span>
                </div>
                {/* 방문객 + 진행률 바 */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontSize:11,color:'#374151',flexShrink:0}}>
                    <span style={{fontWeight:700}}>{dispStats?.slotVisitors ?? 0}</span>
                    <span style={{color:'#9CA3AF'}}>/{dispStats?.slotTotal ?? 0}명</span>
                  </span>
                  <div style={{flex:1,height:4,background:'#E5E7EB',borderRadius:2,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:2,background:'#1D9E75',width:`${dispStats?.slotProgress ?? 0}%`,transition:'width 0.3s'}}/>
                  </div>
                  <span style={{fontSize:10,color:'#1D9E75',fontWeight:700,flexShrink:0}}>{dispStats?.slotProgress ?? 0}%</span>
                </div>
                {simStatus==='paused' && (
                  <div style={{fontSize:10,color:'#D97706',fontWeight:600,textAlign:'center'}}>⏸ 일시정지</div>
                )}
              </div>
            )}
          </div>


        </div>

        {/* ── 우측 메인 영역 ── */}
        <div className="sim-main">

          {/* ── 우측 아이콘 스트립 ── */}
          <div style={{
            position:'absolute', right:16, top:16, zIndex:22,
            display:'flex', flexDirection:'column', gap:6,
          }}>
            {/* 운영설정 아이콘 */}
            <button onClick={() => togglePanel('slot')} title="운영 설정" style={{
              width:36, height:36, borderRadius:10, border:'1px solid var(--color-border)',
              background: showSlotPanel ? '#1D9E75' : '#fff',
              color: showSlotPanel ? '#fff' : '#6B7280',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              fontSize:16, transition:'all 0.15s',
            }}>⚙</button>
            {/* 실시간 통계 아이콘 */}
            <button onClick={() => togglePanel('stats')} title="실시간 통계" style={{
              width:36, height:36, borderRadius:10, border:'1px solid var(--color-border)',
              background: showStats ? '#1D9E75' : '#fff',
              color: showStats ? '#fff' : '#6B7280',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              transition:'all 0.15s',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/>
              </svg>
            </button>
            {/* 런 히스토리 아이콘 */}
            <button onClick={() => togglePanel('history')} title="Run History" style={{
              width:36, height:36, borderRadius:10, border:'1px solid var(--color-border)',
              background: showHistory ? '#1D9E75' : '#fff',
              color: showHistory ? '#fff' : simLogs.length > 0 ? '#6B7280' : '#D1D5DB',
              cursor: simLogs.length > 0 ? 'pointer' : 'default',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              fontSize:15, transition:'all 0.15s', position:'relative',
            }}>
              ☰
              {simLogs.length > 0 && (
                <span style={{
                  position:'absolute', top:-4, right:-4,
                  background: showHistory ? '#fff' : '#1D9E75',
                  color: showHistory ? '#1D9E75' : '#fff',
                  borderRadius:99, fontSize:8, fontWeight:700,
                  minWidth:14, height:14, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'0 3px', lineHeight:1,
                }}>{simLogs.length}</span>
              )}
            </button>
          </div>

          {/* 슬롯별 설정 */}
          {showSlotPanel && <div className="sim-slot-panel" style={{right:60}}>
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
                  <EditableVal value={slotCfg.arrivalRate??5} unit="명/분" min={1} max={100}
                    onChange={v=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,arrivalRate:v}:c))}/>
                </div>
                <div className="slot-row-slider">
                  <SliderInput min="1" max="20" step="1" value={Math.min(slotCfg.arrivalRate??5,20)}
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
                  <EditableVal value={slotCfg.total} unit="명" min={0} max={2000}
                    onChange={v=>setSlotCfgs(p=>p.map((c,i)=>i===slot?{...c,total:v}:c))}/>
                </div>
                <div className="slot-row-slider">
                  <SliderInput min="0" max="200" step="10" value={Math.min(slotCfg.total,200)}
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
          </div>}

          {/* ── Run History 플로팅 패널 ── */}
          {showHistory && simLogs.length > 0 && (
            <div style={{
              position:'absolute', right:60, top:16, zIndex:21,
              width:272,
              maxHeight:'calc(100% - 80px)',
              background:'#fff',
              border:'1px solid var(--color-border)',
              borderRadius:'var(--r-lg)',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              display:'flex', flexDirection:'column',
              overflow:'hidden',
            }}>
              {/* 헤더 */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px 10px',
                background:'var(--color-bg-section)',
                borderBottom:'1px solid var(--color-border)',
                flexShrink:0,
              }}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--color-text)'}}>Run History</span>
                <span style={{fontSize:10,color:'#9CA3AF'}}>{simLogs.length}개</span>
              </div>
              {/* 목록 */}
              <div style={{overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:5}}>
                {simLogs.map((log, idx) => {
                  const runNo = simLogs.length - idx
                  const isActive = reportData && log.id === reportData._logId
                  return (
                    <div key={log.id} style={{
                      background: isActive ? '#ECFDF5' : '#fff',
                      border: `1px solid ${isActive?'#6EE7B7':'#E5E7EB'}`,
                      borderRadius:10, overflow:'hidden',
                    }}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:6,padding:'8px 10px 7px'}}>
                        <span style={{fontSize:9,fontWeight:800,color:'#1D9E75',flexShrink:0,marginTop:1}}>#{runNo}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:10.5,fontWeight:700,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {log.scenario||log.project||'시나리오'}
                          </div>
                          <div style={{fontSize:9,color:'#9CA3AF',marginTop:1.5}}>
                            {log.rangeLabel} · {log.ts||'-'}
                          </div>
                        </div>
                        <button onClick={()=>{
                          setConfirmModal({
                            visible:true,
                            title:`Run #${runNo} 삭제`,
                            message:'이 실행 기록을 삭제하면 Analyze·Insights 데이터도 함께 초기화됩니다.',
                            onConfirm:()=>{
                              if(reportData?._logId===log.id) setReportData(null)
                              setSimLogs(prev=>{
                                const next=prev.filter(l=>l.id!==log.id)
                                try{localStorage.setItem('exsim_logs',JSON.stringify(next))}catch{}
                                return next
                              })
                            },
                          })
                        }} style={{background:'none',border:'none',color:'#D1D5DB',cursor:'pointer',fontSize:11,padding:0,flexShrink:0,lineHeight:1,marginTop:1}}>✕</button>
                      </div>
                      <div style={{display:'flex',gap:6,padding:'0 8px 8px'}}>
                        <button onClick={()=>onAnalyzeLog?.(log)}
                          style={{flex:1,padding:'6px 0',border:'1px solid #1D9E75',borderRadius:7,background:'#1D9E75',fontSize:10,color:'#fff',fontWeight:600,cursor:'pointer'}}>
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
                        }} style={{flex:1,padding:'6px 0',border:'1px solid #7C3AED',borderRadius:7,background:'#7C3AED',fontSize:10,color:'#fff',fontWeight:600,cursor:'pointer'}}>
                          Insights
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 실시간 통계 플로팅 패널 ── */}
          {showStats && (
            <div style={{
              position:'absolute', right:60, top:16, zIndex:21,
              width:272,
              background:'#fff',
              border:'1px solid var(--color-border)',
              borderRadius:'var(--r-lg)',
              boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              overflow:'hidden',
            }}>
              {/* 헤더 */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px 10px',
                background:'var(--color-bg-section)',
                borderBottom:'1px solid var(--color-border)',
              }}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--color-text)'}}>실시간 통계</span>
                {(simStatus==='running'||simStatus==='paused') && (
                  <span style={{fontSize:9,fontWeight:700,color:'#1D9E75',letterSpacing:'0.05em',textTransform:'uppercase'}}>
                    {simStatus==='paused'?'⏸ 일시정지':'● LIVE'}
                  </span>
                )}
              </div>
              {/* 통계 그리드 */}
              <div style={{padding:'10px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
                {[
                  { label:'현재 관람객', val: dispStats?.curVisitors ?? '-' },
                  { label:'밀집도',     val: dispStats?.density ?? '-' },
                  { label:'체험 중',    val: dispStats?.experiencingCount != null ? dispStats.experiencingCount+'명' : '-', ok: dispStats?.experiencingCount > 0 },
                  { label:'대기 중',    val: dispStats?.waitingCount != null ? dispStats.waitingCount+'명' : '-', warn: dispStats?.waitingCount > 5 },
                  { label:'혼잡도',     val: dispStats?.congestion ?? '-', warn: dispStats?.congestionSec > 20 },
                  { label:'병목',       val: dispStats?.bottlenecks ?? '-', warn: dispStats?.bottlenecksNum > 0 },
                  { label:'스킵율',     val: dispStats?.skipRate ?? '-', warn: dispStats?.skipRateNum > 30, ok: dispStats?.skipRateNum < 10 && dispStats?.skipRateNum > 0 },
                ].map(s => (
                  <div key={s.label} style={{
                    padding:'10px 12px', borderRadius:10, aspectRatio:'1/1',
                    display:'flex', flexDirection:'column', justifyContent:'space-between',
                    background: s.warn ? '#FEF2F2' : s.ok ? '#ECFDF5' : '#F9FAFB',
                    border: `1px solid ${s.warn ? '#FECACA' : s.ok ? '#A7F3D0' : '#F0F0F0'}`,
                  }}>
                    <div style={{fontSize:9,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.04em',textTransform:'uppercase'}}>{s.label}</div>
                    <div style={{
                      fontSize:20, fontWeight:700, lineHeight:1,
                      color: s.warn ? '#DC2626' : s.ok ? '#059669' : '#111827',
                      textAlign:'right', whiteSpace:'nowrap',
                    }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 캔버스 */}
          <div className="cw" style={{overflow:'hidden'}}>

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
