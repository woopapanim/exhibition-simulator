import { useState, useEffect, useRef } from 'react'
import useSimStore from '../../store/simulationStore'
import { MT, FT, ALL_MT, CW } from '../../constants'
import { MediaIcon, PortalTip } from '../ui'
import { zCap, zDwell } from '../../utils'

export default function SetupPanel({
  tab, bCRef,
  onBMD, onBMM, onBMU, onBCC, onBDbl,
  addZone, removeZone, addFloor, removeFloor, moveZoneOrder,
  startPolyDraw, cancelPolyDraw, polyDrawing,
  startMediaPolyDraw, clearMediaPoly, createRectMediaPoly, createCircleMediaPoly, mediaPolyDrawing, cancelMediaPolyDraw,
  enterMediaPolyEdit, exitMediaPolyEdit, mediaPolyEditingUid,
  renameZone, drawBuild, drawSim, drawHeat, palDragRef, saveZoneName,
  updateZone, updateMedia, moveMedia, removeMedia,
  onZoomIn, onZoomOut, onResetView, panMode, onTogglePan,
  canUndo, canRedo, onUndo, onRedo,
}) {
  const {
    zones, selZoneId, viewFloor, floorCount, floorSizes, simStatus, palOpen,
    editZone, editingZoneName, tmpSize, circularFlow,
    setSelZoneId, setEditZone, setPalOpen, setTmpSize, setFloorSizes,
    setEditingZoneName, setViewFloor, setEditMediaUid, editMediaUid,
    activeMediaUid, setActiveMediaUid, setCircularFlow,
  } = useSimStore()

  const selZone = zones.find(z=>z.id===selZoneId)||null

  // 활성 미디어 아이템 스크롤
  const mediaItemRefs = useRef({})
  useEffect(() => {
    if (!activeMediaUid) return
    const el = mediaItemRefs.current[activeMediaUid]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeMediaUid])

  // 존 치수 직접 입력
  const [dimEdit, setDimEdit] = useState(null) // {w: string, h: string}
  useEffect(() => { setDimEdit(null) }, [selZoneId])

  function commitDim() {
    if (!selZone || !dimEdit) return
    const sz = floorSizes[selZone.floor||0]||{w:20,h:14}
    const scale = sz.w*2/CW
    const newWm = parseFloat(dimEdit.w)
    const newHm = parseFloat(dimEdit.h)
    setDimEdit(null)
    if (isNaN(newWm) || isNaN(newHm) || newWm<=0 || newHm<=0) return
    const newW = Math.max(50, newWm / scale)
    const newH = Math.max(50, newHm / scale)
    // w, h 동시 업데이트 (updateZone을 연속 호출하면 두 번 drawBuild됨 — 괜찮음)
    updateZone(selZone.id, 'w', newW)
    updateZone(selZone.id, 'h', newH)
  }

  const floorZones = zones.filter(z=>(z.floor||0)===viewFloor).sort((a,b)=>(a.order??0)-(b.order??0))
  const floorMediaCount = floorZones.reduce((s,z)=>s+z.media.length, 0)
  const floorCap = floorZones.reduce((s,z)=>s+(z.media.length ? zCap(z) : 0), 0)

  // 면적 대비 수용인원 (2.5m²/인 기준)
  const DENSITY = 2.5
  const floorScale = (floorSizes[viewFloor]||{w:20}).w / CW

  // 선택 존 통계
  const selZoneMediaCap = selZone ? zCap(selZone) : 0
  const selZoneAreaCap = selZone ? (()=>{
    const sz = floorSizes[selZone.floor||0]||{w:20,h:14}
    const sc = sz.w / CW
    const wm = selZone.w*sc, hm = selZone.h*sc
    let area = wm*hm
    if (selZone.shape==='ellipse') area = Math.PI*(wm/2)*(hm/2)
    else if (selZone.shape==='L') {
      const cw = Math.min(selZone.cutW??selZone.w*0.4, selZone.w-20)*sc
      const ch = Math.min(selZone.cutH??selZone.h*0.4, selZone.h-20)*sc
      area = wm*hm - cw*ch
    }
    return Math.floor(area/DENSITY)
  })() : 0
  const floorAreaCap = Math.floor(floorZones.reduce((s,z) => {
    const wm = z.w * floorScale, hm = z.h * floorScale
    let area = wm * hm
    if (z.shape === 'ellipse') area = Math.PI * (wm/2) * (hm/2)
    else if (z.shape === 'L') {
      const cw = Math.min(z.cutW ?? z.w*0.4, z.w-20) * floorScale
      const ch = Math.min(z.cutH ?? z.h*0.4, z.h-20) * floorScale
      area = wm * hm - cw * ch
    }
    return s + area
  }, 0) / DENSITY)

  return (
    <div style={{display: tab==='build' ? 'block' : 'none', position:'absolute', inset:0}}>
      <div className="build-layout">

        {/* ── 좌측 사이드바 ── */}
        <div className="build-sidebar">
          {/* Area 선택 */}
          <div className="bs-area-row">
            {Array.from({length:floorCount},(_,i)=>(
              <div key={i} className={`bs-area-tab${viewFloor===i?' active':''}`}>
                <button className="bs-area-btn" onClick={()=>setViewFloor(i)}>A{i+1}</button>
                {simStatus==='idle'&&floorCount>1&&viewFloor===i&&(
                  <button className="bs-area-del" onClick={()=>removeFloor(i)} title={`Area ${i+1} 삭제`}>×</button>
                )}
              </div>
            ))}
            {simStatus==='idle'&&(
              <button className="bs-area-add" onClick={addFloor} title="Area 추가">+</button>
            )}
          </div>

          <div className="bs-divider"/>

          {/* 통계 */}
          <div className="bs-label">Overview</div>
          <div className="bs-stats">
            <div className="bs-stat"><span>Zones</span><strong>{floorZones.length}</strong></div>
            <div className="bs-stat"><span>Media</span><strong>{floorMediaCount}</strong></div>
            <div className="bs-stat">
              <PortalTip label="면적 수용">
                전체 존 면적 기준 최대 수용 인원입니다.<br/>
                국제 전시 밀도 기준 <strong style={{color:'#1D9E75'}}>2.5m²/인</strong>으로 산정합니다.<br/>
                안전·쾌적 관람을 위한 권장 동시 입장 인원의 상한선입니다.
              </PortalTip>
              <strong>{floorAreaCap}명</strong>
            </div>
            {floorMediaCount > 0 && (
              <div className="bs-stat">
                <PortalTip label="미디어 수용">
                  미디어 아이템의 동시 체험 가능 인원 합계입니다.<br/>
                  각 미디어의 cap 값을 모두 더한 값으로,<br/>
                  <span style={{color:'#1D9E75'}}>면적 수용보다 낮으면 병목이 발생할 수 있습니다.</span>
                </PortalTip>
                <strong>{floorCap}명</strong>
              </div>
            )}
          </div>

          <div className="bs-divider"/>

          {/* 면적 설정 */}
          {(()=>{
            const sz=floorSizes[viewFloor]||{w:20,h:14}
            const changed=tmpSize.w!==sz.w||tmpSize.h!==sz.h
            return (
              <div className="bs-size-box">
                <div className="bs-label" style={{marginBottom:6}}>Area Size</div>
                <div className="bs-size-grid">
                  <span className="bs-size-label">W</span>
                  <input className="bs-size-input" type="number" min="1" max="500" step="1"
                    value={tmpSize.w}
                    onChange={e=>{
                      const nw=Math.max(1,+e.target.value||20)
                      setTmpSize(p=>({...p,w:nw}))
                      setFloorSizes(p=>p.map((s,i)=>i===viewFloor?{...s,w:nw,h:tmpSize.h}:s))
                    }}
                    onKeyDown={e=>{ if(e.key==='Enter') setTimeout(drawBuild,0) }}/>
                  <span className="bs-size-unit">m</span>
                  <span className="bs-size-label">H</span>
                  <input className="bs-size-input" type="number" min="1" max="500" step="1"
                    value={tmpSize.h}
                    onChange={e=>{
                      const nh=Math.max(1,+e.target.value||14)
                      setTmpSize(p=>({...p,h:nh}))
                      setFloorSizes(p=>p.map((s,i)=>i===viewFloor?{...s,w:tmpSize.w,h:nh}:s))
                    }}
                    onKeyDown={e=>{ if(e.key==='Enter') setTimeout(drawBuild,0) }}/>
                  <span className="bs-size-unit">m</span>
                </div>
                <div className="bs-size-area" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{tmpSize.w*tmpSize.h} m² <span style={{color:'#9CA3AF'}}>({(tmpSize.w*tmpSize.h*0.3025).toFixed(1)}평)</span></span>
                </div>
              </div>
            )
          })()}

          <div className="bs-divider"/>

          {/* 순환형 관람 */}
          <div style={{padding:'4px 4px 4px'}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
              <input type="checkbox" checked={circularFlow}
                onChange={e=>{ setCircularFlow(e.target.checked); setTimeout(drawBuild,0) }}
                disabled={simStatus!=='idle'}
                style={{accentColor:'#1D9E75',cursor:'pointer',width:14,height:14,flexShrink:0}}/>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:12,fontWeight:600,color:'#111827'}}>순환형 관람</span>
                <span style={{fontSize:10,color:'#9CA3AF'}}>입구 = 출구</span>
              </div>
            </label>
          </div>

          <div className="bs-divider"/>

          {/* 존 목록 */}
          <div className="bs-label">Zone List</div>
          <div className="bs-zone-list">
            {floorZones.map((z,idx)=>(
              <div key={z.id}
                className={`bs-zone-item${selZoneId===z.id?' active':''}`}
                onClick={()=>{ setSelZoneId(z.id); setEditingZoneName(false); drawBuild() }}>
                <span className="bs-zone-num">{idx+1}</span>
                <span className="bs-zone-name">{z.name}</span>
                {z.media.length>0&&<span className="bs-zone-badge">{z.media.length}</span>}
              </div>
            ))}
          </div>

          {/* 선택된 존 요약 */}
          {selZone && (
            <div style={{margin:'4px 0 12px',padding:'10px 12px',background:'#ECFDF5',borderRadius:10,border:'1px solid #A7F3D0'}}>
              <div style={{fontSize:11,fontWeight:600,color:'#059669',marginBottom:8,display:'flex',alignItems:'center',gap:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {selZone.name}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {[
                  {label:'미디어', value:selZone.media.length+'개'},
                  selZone.media.length > 0 && {label:'평균 체험', value:zDwell(selZone)+'초'},
                  {label:'면적 수용', value:selZoneAreaCap+'명'},
                  selZone.media.length > 0 && {label:'미디어 수용', value:selZoneMediaCap+'명'},
                ].filter(Boolean).map(({label,value})=>(
                  <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    background:'#fff',borderRadius:7,padding:'8px 10px',border:'1px solid #D1FAE5'}}>
                    <span style={{fontSize:11,color:'#6B7280',fontWeight:500}}>{label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:'#111827'}}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:10,marginTop:12,flexWrap:'wrap'}}>
            {simStatus==='idle'&&!polyDrawing&&(
              <button className="bs-add-btn" onClick={addZone}>+ Zone</button>
            )}
            {polyDrawing&&(
              <button className="bs-add-btn" onClick={cancelPolyDraw}
                style={{background:'rgba(220,38,38,0.08)',color:'#DC2626',borderColor:'rgba(220,38,38,0.2)'}}>
                ✕
              </button>
            )}
            <button className="bs-add-btn" onClick={()=>setPalOpen(true)}>+ Media</button>
          </div>
          {polyDrawing&&(
            <div style={{marginTop:6,padding:'6px 10px',background:'rgba(90,143,168,0.08)',borderRadius:7,fontSize:10,color:'#5A8FA8',lineHeight:1.5}}>
              캔버스를 클릭해 꼭짓점을 추가하세요.<br/>
              첫 번째 점을 다시 클릭하면 완성됩니다.<br/>
              <span style={{color:'#999'}}>ESC = 취소</span>
            </div>
          )}
        </div>

        {/* ── 메인 (캔버스) ── */}
        <div className="build-main">

          {/* 캔버스 */}
          <div className="cw" style={{overflow:'hidden'}}>
            <div style={{position:'relative', display:'inline-block', lineHeight:0}}>
              <canvas ref={bCRef}
                onMouseDown={onBMD} onMouseMove={onBMM} onMouseUp={onBMU}
                onMouseLeave={onBMU} onClick={onBCC} onDoubleClick={onBDbl}
              />
              {editZone && (
                <input className="zone-overlay-input" autoFocus
                  style={{left:editZone.ox,top:editZone.oy,width:120}}
                  value={editZone.name}
                  onChange={e=>setEditZone(p=>({...p,name:e.target.value}))}
                  onBlur={saveZoneName}
                  onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditZone(null)}}
                />
              )}
            </div>
            {/* 줌 컨트롤 — .cw 기준 하단 중앙 고정 */}
            <div className="canvas-zoom-ctrl">
              <button className="canvas-zoom-btn" onClick={onUndo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)"
                style={{ opacity: canUndo ? 1 : 0.3, fontSize: 13 }}>↩</button>
              <button className="canvas-zoom-btn" onClick={onRedo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)"
                style={{ opacity: canRedo ? 1 : 0.3, fontSize: 13 }}>↪</button>
              <div style={{width:1,height:16,background:'rgba(0,0,0,0.1)',margin:'0 2px'}}/>
              <button className="canvas-zoom-btn" onClick={onZoomIn} title="확대">+</button>
              <button className="canvas-zoom-btn" onClick={onResetView} title="뷰 초기화" style={{fontSize:9,padding:'0 4px'}}>⟲</button>
              <button className="canvas-zoom-btn" onClick={onZoomOut} title="축소">−</button>
              <div style={{width:1,height:16,background:'rgba(0,0,0,0.1)',margin:'0 2px'}}/>
              <button className="canvas-zoom-btn" onClick={onTogglePan} title="이동"
                style={{background:panMode?'rgba(29,158,117,0.15)':undefined, color:panMode?'#1D9E75':undefined}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
              </button>
            </div>
          </div>

          {/* ── 팔레트 패널 (좌측 플로팅) ── */}
          {palOpen && (
            <div style={{
              position:'absolute', left:256, top:16, width:272, zIndex:22,
              height:'fit-content', maxHeight:'calc(100% - 32px)',
              display:'flex', flexDirection:'column',
              background:'rgba(255,255,255,0.95)',
              backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
              borderRadius:14, boxShadow:'0 4px 24px rgba(0,0,0,0.10)',
              border:'1px solid rgba(255,255,255,0.75)',
              overflow:'hidden',
            }}>
              <div className="dh" style={{justifyContent:'space-between',flexShrink:0}}>
                <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>Add Media</span>
                <button className="rb" onClick={()=>setPalOpen(false)} title="닫기">✕</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
                {[['Media', MT],['Facility', FT]].map(([title, items], gi)=>(
                  <div key={title}>
                    {gi > 0 && <div style={{height:1,background:'#f0f0f0',margin:'6px 0'}}/>}
                    <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.08em',padding:'10px 16px 5px',textTransform:'uppercase'}}>{title}</div>
                    {items.map(m=>(
                      <div key={m.id} className="pal-row" draggable
                        onDragStart={e=>{ palDragRef.current=m; e.dataTransfer.setDragImage(new Image(),0,0) }}
                        onDragEnd={()=>{ palDragRef.current=null }}>
                        <span className="mc-ic" style={{background:m.bg,color:m.color,flexShrink:0}}>
                          <MediaIcon id={m.id} size={14} color={m.color}/>
                        </span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:500,color:'#111827'}}>{m.label}</div>
                          <div style={{fontSize:10,color:'#9CA3AF'}}>{m.desc}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M5 9l2-2 2 2M5 15l2 2 2-2M15 5l2 2 2-2M15 19l2-2 2 2M3 12h4M17 12h4M12 3v4M12 17v4"/></svg>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 존 디테일 패널 (우측 플로팅) ── */}
          {selZone && (
          <div className="detail setup-panel">
          {selZone ? (
            /* ── 존 디테일 모드 ── */
            <div style={{display:'flex',flexDirection:'column'}}>
              <div className="dh">
                <div style={{display:'flex',flexDirection:'column',gap:5,flex:1,minWidth:0}}>
                  {/* 이름 행 */}
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {editingZoneName ? (
                      <input className="dh-input" autoFocus style={{flex:1,minWidth:0}}
                        value={selZone.name}
                        onChange={e=>renameZone(selZone.id, e.target.value)}
                        onBlur={()=>setEditingZoneName(false)}
                        onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setEditingZoneName(false)}}
                      />
                    ) : (
                      <span className="mi-name" style={{fontSize:13,fontWeight:600,flex:1,minWidth:0,cursor:'pointer'}}
                        onDoubleClick={()=>setEditingZoneName(true)} title="더블클릭으로 이름 편집">
                        {selZone.name}
                      </span>
                    )}
                    {/* ▲ ▼ × 버튼 그룹 */}
                    {(()=>{
                      const fl=selZone.floor||0
                      const peers=zones.filter(z=>(z.floor||0)===fl).sort((a,b)=>(a.order??0)-(b.order??0))
                      const idx=peers.findIndex(p=>p.id===selZone.id)
                      return (
                        <div className="mc-acts">
                          <button className="rb order-btn" disabled={simStatus!=='idle'||idx===0}
                            onClick={()=>moveZoneOrder(selZone.id,-1)} title="순서 앞으로">▲</button>
                          <button className="rb order-btn" disabled={simStatus!=='idle'||idx===peers.length-1}
                            onClick={()=>moveZoneOrder(selZone.id,1)} title="순서 뒤로">▼</button>
                          <button className="rb del"
                            onClick={()=>removeZone(selZone.id)} title="존 삭제"
                            disabled={simStatus!=='idle'}>×</button>
                        </div>
                      )
                    })()}
                  </div>
                  {/* 순서·사이즈 행 */}
                  {(()=>{
                    const fl=selZone.floor||0
                    const peers=zones.filter(z=>(z.floor||0)===fl).sort((a,b)=>(a.order??0)-(b.order??0))
                    const idx=peers.findIndex(p=>p.id===selZone.id)
                    const sz=floorSizes[selZone.floor||0]||{w:20,h:14}
                    const scale=sz.w*2/CW
                    const zWm=(selZone.w*scale).toFixed(1)
                    const zHm=(selZone.h*scale).toFixed(1)
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:11,fontWeight:500,color:'#5a7570',background:'#eef3f0',borderRadius:5,padding:'2px 7px'}}>
                          {idx+1} / {peers.length}
                        </span>
                        <span
                          title="클릭하여 크기 수정"
                          style={{fontSize:11,fontWeight:500,color:'#5a7570',background:'#eef3f0',borderRadius:5,padding:'2px 7px',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                          onClick={()=>{ if(simStatus==='idle') setDimEdit({w:zWm,h:zHm}) }}
                        >
                          {dimEdit ? (
                            <span
                              style={{display:'inline-flex',alignItems:'center',gap:3}}
                              onBlur={e=>{ if (!e.currentTarget.contains(e.relatedTarget)) commitDim() }}
                            >
                              <input
                                type="number" min="0.1" step="0.1"
                                value={dimEdit.w}
                                onChange={e=>setDimEdit(d=>({...d,w:e.target.value}))}
                                onKeyDown={e=>{ if(e.key==='Enter') commitDim(); if(e.key==='Escape') setDimEdit(null); e.stopPropagation() }}
                                autoFocus
                                style={{width:40,fontSize:11,border:'none',background:'transparent',outline:'none',color:'#5a7570',fontWeight:600,padding:0,textAlign:'right'}}
                              />
                              <span>m ×</span>
                              <input
                                type="number" min="0.1" step="0.1"
                                value={dimEdit.h}
                                onChange={e=>setDimEdit(d=>({...d,h:e.target.value}))}
                                onKeyDown={e=>{ if(e.key==='Enter') commitDim(); if(e.key==='Escape') setDimEdit(null); e.stopPropagation() }}
                                style={{width:40,fontSize:11,border:'none',background:'transparent',outline:'none',color:'#5a7570',fontWeight:600,padding:0,textAlign:'right'}}
                              />
                              <span>m</span>
                            </span>
                          ) : (
                            <>{zWm}m × {zHm}m</>
                          )}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>
              {/* 존 형태 */}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderBottom:'1px solid rgba(0,0,0,0.06)',background:'rgba(0,0,0,0.015)'}}>
                <span style={{fontSize:10,color:'#aaa',flexShrink:0}}>형태</span>
                <div className="flow-seg">
                  {[['rect','□ 사각'],['ellipse','○ 원형'],['L','ㄱ형']].map(([sh,label])=>(
                    <button key={sh}
                      className={`flow-btn${(selZone.shape||'rect')===sh?' active':''}`}
                      disabled={simStatus!=='idle'}
                      onClick={()=>{ updateZone(selZone.id,'shape',sh); setTimeout(drawBuild,0) }}
                    >{label}</button>
                  ))}
                  <button
                    className={`flow-btn${selZone.shape==='polygon'?' active':''}`}
                    disabled={simStatus!=='idle'}
                    onClick={()=>{
                      if (selZone.shape === 'polygon') return
                      // Convert bounding box to 4-corner polygon
                      updateZone(selZone.id,'shape','polygon')
                      updateZone(selZone.id,'vertices',[
                        {x:selZone.x, y:selZone.y},
                        {x:selZone.x+selZone.w, y:selZone.y},
                        {x:selZone.x+selZone.w, y:selZone.y+selZone.h},
                        {x:selZone.x, y:selZone.y+selZone.h},
                      ])
                      setTimeout(drawBuild,0)
                    }}
                  >⬠ 다각형</button>
                </div>
              </div>
              {(selZone.shape||'rect')==='L' && (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderBottom:'1px solid rgba(0,0,0,0.06)',background:'rgba(0,0,0,0.01)'}}>
                  <span style={{fontSize:10,color:'#aaa',flexShrink:0}}>잘린 모서리</span>
                  <div className="flow-seg">
                    {[['NE','↗ 우상'],['NW','↖ 좌상'],['SE','↘ 우하'],['SW','↙ 좌하']].map(([c,label])=>(
                      <button key={c}
                        className={`flow-btn${(selZone.cutCorner||'NE')===c?' active':''}`}
                        disabled={simStatus!=='idle'}
                        onClick={()=>{ updateZone(selZone.id,'cutCorner',c); setTimeout(drawBuild,0) }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* 존별 동선 타입 */}
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderBottom:'1px solid rgba(0,0,0,0.06)',background:'rgba(0,0,0,0.015)'}}>
                <span style={{fontSize:10,color:'#aaa',flexShrink:0}}>동선</span>
                <div className="flow-seg">
                  {[['guided','유도'],['free','자유']].map(([ft,label])=>(
                    <button key={ft}
                      className={`flow-btn${(selZone.flowType||'guided')===ft?' active':''}`}
                      disabled={simStatus!=='idle'}
                      onClick={()=>updateZone(selZone.id,'flowType',ft)}
                    >{label}</button>
                  ))}
                </div>
                <span style={{fontSize:10,color:'#bbb'}}>
                  {(selZone.flowType||'guided')==='guided'?'배치 순서대로':'랜덤 순서로'}
                </span>
              </div>
              {/* 미디어 다각형 그리기 안내 */}
              {mediaPolyDrawing && (
                <div style={{padding:'7px 16px',background:'rgba(83,74,183,0.07)',borderBottom:'1px solid rgba(83,74,183,0.12)',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,color:'#534AB7',flex:1,lineHeight:1.5}}>
                    캔버스에 형태 그리기 · 꼭짓점 클릭으로 추가<br/>첫 점 재클릭으로 완성
                  </span>
                  <button style={{fontSize:10,padding:'2px 7px',background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:5,color:'#DC2626',cursor:'pointer',flexShrink:0}}
                    onClick={cancelMediaPolyDraw}>✕</button>
                </div>
              )}
              {/* 다각형 수정 안내 */}
              {mediaPolyEditingUid && (
                <div style={{padding:'7px 16px',background:'rgba(83,74,183,0.07)',borderBottom:'1px solid rgba(83,74,183,0.12)',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,color:'#534AB7',flex:1,lineHeight:1.5}}>
                    꼭짓점 드래그로 형태 수정
                  </span>
                  <button style={{fontSize:10,padding:'2px 10px',background:'#534AB7',border:'none',borderRadius:5,color:'#fff',cursor:'pointer',flexShrink:0,fontWeight:600}}
                    onClick={exitMediaPolyEdit}>완료</button>
                </div>
              )}
              {/* 미디어 목록 */}
              <div style={{overflowY:'auto'}}>
                {!selZone.media.length ? (
                  <div style={{padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:12,color:'#aaa',marginBottom:12}}>배치된 미디어가 없어요</div>
                    <button className="bs-add-btn" onClick={()=>setPalOpen(true)}>+ Media</button>
                  </div>
                ) : (
                  <>
                    {(()=>{
                      const idSeq={}, idCount={}
                      selZone.media.forEach(m=>{idCount[m.id]=(idCount[m.id]||0)+1})
                      return selZone.media.map(m=>{
                        idSeq[m.id]=(idSeq[m.id]||0)+1
                        const dup=idCount[m.id]>1?<span className="dup-badge">#{idSeq[m.id]}</span>:null
                        const mi=selZone.media.indexOf(m)
                        const mcolor = ALL_MT.find(t=>t.id===m.id)?.color||'#666'
                        const mbg    = ALL_MT.find(t=>t.id===m.id)?.bg||'#f0f4f0'
                        const sz=floorSizes[selZone.floor||0]||{w:20,h:14}
                        const maxWcm=Math.floor(selZone.w*sz.w*2/CW*100)
                        const maxHcm=Math.floor(selZone.h*sz.w*2/CW*100)
                        const overW=(m.widthCm||100)>maxWcm
                        const overH=(m.heightCm||100)>maxHcm
                        const isActive = activeMediaUid === m.uid
                        return (
                          <div key={m.uid} className={`mc${isActive?' mc--active':''}`}
                            ref={el => { if (el) mediaItemRefs.current[m.uid]=el; else delete mediaItemRefs.current[m.uid] }}
                            onClick={() => setActiveMediaUid(m.uid)}
                          >
                            {/* 헤더: 아이콘 + 이름 + 순서/삭제 */}
                            <div className="mc-hd">
                              <span className="mc-ic" style={{background:mbg, color:mcolor}}>
                                <MediaIcon id={m.id} size={14} color={mcolor}/>
                              </span>
                              <div className="mc-title">
                                {editMediaUid===m.uid ? (
                                  <input className="mi" autoFocus
                                    value={m.label}
                                    onChange={e=>updateMedia(selZone.id,m.uid,'label',e.target.value)}
                                    onBlur={()=>setEditMediaUid(null)}
                                    onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setEditMediaUid(null)}}
                                  />
                                ) : (
                                  <span className="mi-name" onDoubleClick={()=>setEditMediaUid(m.uid)} title="더블클릭으로 이름 편집">
                                    {m.label}{dup}
                                  </span>
                                )}
                                <span style={{fontSize:10,color:'#aaa'}}>{m.desc}</span>
                              </div>
                              <div className="mc-acts">
                                <button className="rb order-btn" disabled={mi===0} onClick={()=>moveMedia(selZone.id,m.uid,-1)}>▲</button>
                                <button className="rb order-btn" disabled={mi===selZone.media.length-1} onClick={()=>moveMedia(selZone.id,m.uid,1)}>▼</button>
                                <button className="rb del" onClick={()=>removeMedia(selZone.id,m.uid)}>×</button>
                              </div>
                            </div>
                            {/* 필드 행: 수용 · 체험 · 몰입 */}
                            <div className="mc-fields">
                              <div className="mf">
                                <div className="ml">수용(명)</div>
                                <input className="mi" type="number" min="1" value={m.cap}
                                  onChange={e=>updateMedia(selZone.id,m.uid,'cap',e.target.value)}/>
                              </div>
                              <div className="mf">
                                <div className="ml">체험(초)</div>
                                <input className="mi" type="number" min="1" value={m.dwell}
                                  onChange={e=>updateMedia(selZone.id,m.uid,'dwell',e.target.value)}/>
                              </div>
                              <div className="mf">
                                <div className="ml">몰입강도</div>
                                <select className="mi" value={m.engagementLevel||3}
                                  onChange={e=>updateMedia(selZone.id,m.uid,'engagementLevel',e.target.value)}>
                                  {[1,2,3,4,5].map(v=><option key={v} value={v}>E{v}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* 형태 만들기 */}
                            <div style={{padding:'8px 16px',borderTop:'.5px solid rgba(0,0,0,0.06)'}}>
                              {m.polyVerts?.length>=3 ? (
                                <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',background:'rgba(83,74,183,0.05)',borderRadius:7,border:'1px solid rgba(83,74,183,0.15)'}}>
                                  {m.rectShape
                                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>
                                    : m.circleShape
                                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>
                                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 19 7 16 15 8 15 5 7"/></svg>
                                  }
                                  <span style={{fontSize:10,color:'#534AB7',flex:1,fontWeight:500}}>{m.rectShape?'직사각형':m.circleShape?'원형':m.polyVerts.length+'꼭짓점 다각형'}</span>
                                  <button title={mediaPolyEditingUid===m.uid?'완료':'형태 수정'}
                                    onClick={()=>mediaPolyEditingUid===m.uid?exitMediaPolyEdit():enterMediaPolyEdit(m.uid)}
                                    style={{display:'flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:5,border:'1px solid',cursor:'pointer',flexShrink:0,padding:0,transition:'all .15s',
                                      background: mediaPolyEditingUid===m.uid?'#534AB7':'transparent',
                                      borderColor: mediaPolyEditingUid===m.uid?'#534AB7':'rgba(83,74,183,0.35)'}}>
                                    {mediaPolyEditingUid===m.uid
                                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    }
                                  </button>
                                  <button title="형태 삭제"
                                    onClick={()=>clearMediaPoly(selZone.id,m.uid)}
                                    style={{display:'flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:5,border:'1px solid rgba(220,38,38,0.25)',cursor:'pointer',flexShrink:0,padding:0,background:'transparent'}}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                  </button>
                                </div>
                              ) : (
                                <div style={{display:'flex',gap:5}}>
                                  {[
                                    {label:'사각형', title:'사각형으로 바로 만들기', onClick:()=>createRectMediaPoly(selZone.id,m.uid),
                                      icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>},
                                    {label:'원형', title:'원형으로 바로 만들기', onClick:()=>createCircleMediaPoly(selZone.id,m.uid),
                                      icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg>},
                                    {label:'다각형', title:'직접 다각형 그리기', onClick:()=>startMediaPolyDraw(m.uid),
                                      icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 19 8 16 16 8 16 5 8"/></svg>},
                                  ].map(({label,title,onClick,icon})=>(
                                    <button key={label} disabled={mediaPolyDrawing} onClick={onClick} title={title}
                                      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4,
                                        padding:'6px 0',borderRadius:7,cursor:'pointer',
                                        border:'1.5px solid rgba(83,74,183,0.4)',
                                        background:'rgba(83,74,183,0.04)',
                                        color:mediaPolyDrawing?'#bbb':'#534AB7',
                                        fontSize:10,fontWeight:500,transition:'all .15s'}}>
                                      {icon}{label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* 층 연결 (계단/엘리베이터) */}
                            {m.isTransit && (
                              <div className="mc-transit">
                                <div className="ml" style={{flexShrink:0}}>연결 존</div>
                                <select className="mi" style={{flex:1}}
                                  value={m.linkedZoneId??''}
                                  onChange={e=>updateMedia(selZone.id,m.uid,'linkedZoneId',e.target.value===''?null:Number(e.target.value))}>
                                  <option value="">- 선택 안 함 -</option>
                                  {zones.filter(z=>z.id!==selZone.id).map(z=>(
                                    <option key={z.id} value={z.id}>Area {(z.floor||0)+1} — {z.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </>
                )}
              </div>
              {/* Add Media 버튼 — 존 디테일 하단 */}
              {selZone.media.length > 0 && (
                <div style={{padding:'16px',borderTop:'1px solid #f0f4f0',flexShrink:0,display:'flex',justifyContent:'center'}}>
                  <button className="bs-add-btn" onClick={()=>setPalOpen(true)}>+ Media</button>
                </div>
              )}
            </div>
          ) : null}

          </div>
          )}{/* /zone-detail-panel */}
        </div>{/* /main-area */}
      </div>{/* /build-layout */}
    </div>
  )
}
