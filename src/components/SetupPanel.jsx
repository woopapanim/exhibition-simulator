import { MT, FT, ALL_MT } from '../constants'
import { zCap, zDwell } from '../utils'
import { MediaIcon } from './ui'

/**
 * SetupPanel — Build 탭 UI
 */
export default function SetupPanel({
  // state
  zones,
  selZoneId,
  selZone,
  viewFloor,
  floorCount,
  floorSizes,
  tmpSize,
  simStatus,
  canvasZoom,
  palOpen,
  editZone,
  editMediaUid,
  editingZoneName,
  // setters
  setSelZoneId,
  setViewFloor,
  setFloorSizes,
  setTmpSize,
  setCanvasZoom,
  setPalOpen,
  setEditingZoneName,
  setEditMediaUid,
  setEditZone,
  // refs
  bCRef,
  // actions
  addZone,
  removeZone,
  addFloor,
  removeFloor,
  moveZoneOrder,
  updateMedia,
  removeMedia,
  moveMedia,
  renameZone,
  saveZoneName,
  drawBuild,
  // canvas events
  onBMD,
  onBMM,
  onBMU,
  onBCC,
  onBDbl,
  // palette drag
  palDrag,
}) {
  const floorZones = zones.filter(z=>(z.floor||0)===viewFloor).sort((a,b)=>(a.order??0)-(b.order??0))
  const floorMediaCount = floorZones.reduce((s,z)=>s+z.media.length, 0)
  const floorCap = floorZones.reduce((s,z)=>s+zCap(z), 0)

  return (
    <div style={{display:''}}>
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
                    onChange={e=>setTmpSize(p=>({...p,w:Math.max(1,+e.target.value||20)}))}
                    onKeyDown={e=>{
                      if(e.key==='Enter'){
                        const nw=Math.max(1,+e.target.value||20)
                        const nh=tmpSize.h
                        setFloorSizes(p=>p.map((s,i)=>i===viewFloor?{...s,w:nw,h:nh}:s))
                        setTimeout(drawBuild,0)
                      }
                    }}/>
                  <span className="bs-size-unit">m</span>
                  <span className="bs-size-label">H</span>
                  <input className="bs-size-input" type="number" min="1" max="500" step="1"
                    value={tmpSize.h}
                    onChange={e=>setTmpSize(p=>({...p,h:Math.max(1,+e.target.value||14)}))}
                    onKeyDown={e=>{
                      if(e.key==='Enter'){
                        const nw=tmpSize.w
                        const nh=Math.max(1,+e.target.value||14)
                        setFloorSizes(p=>p.map((s,i)=>i===viewFloor?{...s,w:nw,h:nh}:s))
                        setTimeout(drawBuild,0)
                      }
                    }}/>
                  <span className="bs-size-unit">m</span>
                </div>
                <div className="bs-size-area" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{tmpSize.w*tmpSize.h} m² <span style={{color:'#a0b0aa'}}>({(tmpSize.w*tmpSize.h*0.3025).toFixed(1)}평)</span></span>
                  {changed&&(
                    <button
                      style={{fontSize:11,padding:'3px 10px',borderRadius:8,border:'none',background:'#00c896',color:'#fff',cursor:'pointer',fontWeight:600}}
                      onClick={()=>{
                        setFloorSizes(p=>p.map((s,i)=>i===viewFloor?{...s,w:tmpSize.w,h:tmpSize.h}:s))
                        setTimeout(drawBuild,0)
                      }}>적용</button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="bs-divider"/>

          {/* 통계 */}
          <div className="bs-stats">
            <div className="bs-stat"><span>Zones</span><strong>{floorZones.length}</strong></div>
            <div className="bs-stat"><span>Media</span><strong>{floorMediaCount}</strong></div>
            <div className="bs-stat"><span>Capacity</span><strong>{floorCap}명</strong></div>
          </div>

          <div className="bs-divider"/>

          {/* 존 목록 */}
          <div className="bs-label">Zone List</div>
          <div className="bs-zone-list">
            {floorZones.map(z=>(
              <div key={z.id}
                className={`bs-zone-item${selZoneId===z.id?' active':''}`}
                onClick={()=>{setSelZoneId(z.id);setEditingZoneName(false);drawBuild()}}>
                <span className="bs-zone-num">{(z.order??0)+1}</span>
                <span className="bs-zone-name">{z.name}</span>
                {z.media.length>0&&<span className="bs-zone-badge">{z.media.length}</span>}
              </div>
            ))}
          </div>

          {simStatus==='idle'&&(
            <button className="bs-add-btn" onClick={addZone}>+ Zone</button>
          )}
        </div>

        {/* ── 메인 (캔버스 + 디테일) ── */}
        <div className="build-main">
          {/* 툴바 */}
          <div className="build-toolbar">
            <button className={`btn-s${palOpen?' active-pal':''}`} onClick={()=>setPalOpen(p=>!p)}>
              {palOpen ? '✕ Close' : '＋ Add Media'}
            </button>
          </div>

          {/* 팔레트 */}
          {palOpen&&(
            <div className="inline-palette">
              <div className="inline-palette-section">
                <span className="pal-title">Media</span>
                <div className="inline-palette-chips">
                  {MT.map(m=>(
                    <div key={m.id} className="media-chip" draggable
                      onDragStart={e=>{ palDrag.current=m; e.dataTransfer.setDragImage(new Image(),0,0) }}
                      onDragEnd={()=>{ palDrag.current=null }}>
                      <span className="chip-ic" style={{background:m.bg,color:m.color}}><MediaIcon id={m.id} size={14} color={m.color}/></span>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="inline-palette-divider"/>
              <div className="inline-palette-section">
                <span className="pal-title">Facility</span>
                <div className="inline-palette-chips">
                  {FT.map(m=>(
                    <div key={m.id} className="media-chip" draggable
                      onDragStart={e=>{ palDrag.current=m; e.dataTransfer.setDragImage(new Image(),0,0) }}
                      onDragEnd={()=>{ palDrag.current=null }}>
                      <span className="chip-ic" style={{background:m.bg,color:m.color}}><MediaIcon id={m.id} size={14} color={m.color}/></span>
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 캔버스 */}
          <div className="cw" style={{overflow: canvasZoom>1?'auto':'hidden', padding: canvasZoom<1?'16px':0}}>
            <canvas ref={bCRef}
              style={{width:`${canvasZoom*100}%`}}
              onMouseDown={onBMD} onMouseMove={onBMM} onMouseUp={onBMU}
              onMouseLeave={onBMU} onClick={onBCC} onDoubleClick={onBDbl}
            />
            <div className="canvas-zoom-ctrl">
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))} title="확대">+</button>
              <span className="canvas-zoom-val">{Math.round(canvasZoom*100)}%</span>
              <button className="canvas-zoom-btn" onClick={()=>setCanvasZoom(z=>Math.max(0.3,+(z-0.1).toFixed(1)))} title="축소">−</button>
            </div>
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
          <div style={{marginTop:5,fontSize:10,color:'#aaa'}}>
            Click to select · <strong style={{color:'#888'}}>Double-click</strong> to rename · Drag media to place
          </div>
          <div className="fp-legend">
            {(()=>{ const s=floorSizes[viewFloor]||{w:20,h:14}; const sqm=s.w*s.h; const py=(sqm*0.3025).toFixed(1)
              return <><span className="fp-swatch"/> Footprint scale: Area {viewFloor+1} = {s.w}m × {s.h}m ({sqm}m² · {py}평)</> })()}
          </div>

          {/* 디테일 패널 */}
          <div className="detail">
            <div className="dh">
              {selZone ? (
                <>
                  {editingZoneName ? (
                    <input className="dh-input" autoFocus
                      value={selZone.name}
                      onChange={e=>renameZone(selZone.id, e.target.value)}
                      onBlur={()=>setEditingZoneName(false)}
                      onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setEditingZoneName(false)}}
                    />
                  ) : (
                    <span className="mi-name" style={{fontSize:13,fontWeight:500}} onDoubleClick={()=>setEditingZoneName(true)} title="더블클릭으로 이름 편집">{selZone.name}</span>
                  )}
                  {(()=>{
                    const fl=selZone.floor||0
                    const peers=zones.filter(z=>(z.floor||0)===fl).sort((a,b)=>(a.order??0)-(b.order??0))
                    const idx=peers.findIndex(p=>p.id===selZone.id)
                    const isEntry=idx===0&&fl===0
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:4,marginLeft:8}}>
                        {isEntry&&<span style={{fontSize:9,fontWeight:700,color:'#15803D',background:'#DCFCE7',padding:'1px 6px',borderRadius:10}}>ENTRY</span>}
                        <span style={{fontSize:10,color:'#888'}}>순서 {idx+1}/{peers.length}</span>
                        <button className="rb order-btn" disabled={simStatus!=='idle'||idx===0} onClick={()=>moveZoneOrder(selZone.id,-1)} title="순서 앞으로">▲</button>
                        <button className="rb order-btn" disabled={simStatus!=='idle'||idx===peers.length-1} onClick={()=>moveZoneOrder(selZone.id,1)} title="순서 뒤로">▼</button>
                      </div>
                    )
                  })()}
                  <button className="rb" style={{marginLeft:'auto',color:'#EF4444',borderColor:'#FCA5A5'}}
                    onClick={()=>removeZone(selZone.id)} title="존 삭제"
                    disabled={simStatus!=='idle'}>×</button>
                </>
              ) : '존을 클릭해 미디어를 배치해보세요'}
            </div>
            <div>
              {!selZone ? (
                <div style={{padding:'12px 14px',fontSize:12,color:'#888'}}>팔레트에서 미디어를 드래그해 존 위에 올려보세요.</div>
              ) : !selZone.media.length ? (
                <div style={{padding:'10px 14px',fontSize:12,color:'#888',fontStyle:'italic'}}>배치된 미디어가 없어요.</div>
              ) : (
                <>
                  {(()=>{
                    const idSeq={}, idCount={}
                    selZone.media.forEach(m=>{idCount[m.id]=(idCount[m.id]||0)+1})
                    return selZone.media.map(m=>{
                      idSeq[m.id]=(idSeq[m.id]||0)+1
                      const dup=idCount[m.id]>1?<span className="dup-badge">#{idSeq[m.id]}</span>:null
                      const mi=selZone.media.indexOf(m)
                      return (
                        <div key={m.uid}>
                          {/* 메인 행 */}
                          <div className="mrow">
                            <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><MediaIcon id={m.type} size={16} color={ALL_MT.find(t=>t.id===m.type)?.color||'#666'}/></div>
                            <div>
                              {editMediaUid===m.uid ? (
                                <input className="mi" autoFocus style={{width:130}}
                                  value={m.label}
                                  onChange={e=>updateMedia(selZone.id,m.uid,'label',e.target.value)}
                                  onBlur={()=>setEditMediaUid(null)}
                                  onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')setEditMediaUid(null)}}
                                />
                              ) : (
                                <div className="mi-name" onDoubleClick={()=>setEditMediaUid(m.uid)} title="더블클릭으로 이름 편집">
                                  {m.label}{dup}
                                </div>
                              )}
                              <div style={{fontSize:10,color:'#888'}}>{m.desc}</div>
                            </div>
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
                              <div className="ml">몰입 강도 1~5</div>
                              <select className="mi" value={m.engagementLevel||3}
                                onChange={e=>updateMedia(selZone.id,m.uid,'engagementLevel',e.target.value)}>
                                {[1,2,3,4,5].map(v=><option key={v} value={v}>E{v}</option>)}
                              </select>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:1}}>
                              <button className="rb order-btn" disabled={mi===0} onClick={()=>moveMedia(selZone.id,m.uid,-1)}>▲</button>
                              <button className="rb order-btn" disabled={mi===selZone.media.length-1} onClick={()=>moveMedia(selZone.id,m.uid,1)}>▼</button>
                            </div>
                            <button className="rb" onClick={()=>removeMedia(selZone.id,m.uid)}>×</button>
                          </div>
                          {/* 층 연결 (계단/엘리베이터) */}
                          {m.isTransit && (
                            <div className="mrow" style={{paddingTop:2,paddingBottom:4}}>
                              <div style={{fontSize:11,color:'#888',minWidth:48}}>연결 존</div>
                              <select className="mi" style={{flex:1,minWidth:130}}
                                value={m.linkedZoneId??''}
                                onChange={e=>updateMedia(selZone.id,m.uid,'linkedZoneId',e.target.value===''?null:Number(e.target.value))}>
                                <option value="">- 선택 안 함 -</option>
                                {zones.filter(z=>z.id!==selZone.id).map(z=>(
                                  <option key={z.id} value={z.id}>Area {(z.floor||0)+1} — {z.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* 실제 사이즈 행 */}
                          <div className="mrow-size">
                            <div className="mf" style={{minWidth:68}}>
                              <div className="ml">가로(cm)</div>
                              <input className="mi" type="number" min="1" value={m.widthCm||100}
                                onChange={e=>updateMedia(selZone.id,m.uid,'widthCm',e.target.value)}/>
                            </div>
                            <div className="mf" style={{minWidth:68}}>
                              <div className="ml">세로(cm)</div>
                              <input className="mi" type="number" min="1" value={m.heightCm||100}
                                onChange={e=>updateMedia(selZone.id,m.uid,'heightCm',e.target.value)}/>
                            </div>
                            <span className="mrow-size-label">
                              → footprint {((m.widthCm||100)/100).toFixed(1)}m × {((m.heightCm||100)/100).toFixed(1)}m
                            </span>
                          </div>
                        </div>
                      )
                    })
                  })()}
                  <div style={{padding:'6px 12px 7px',borderTop:'.5px solid rgba(0,0,0,0.08)',display:'flex',gap:12,fontSize:11,color:'#888'}}>
                    <span>수용 <strong style={{color:'#111'}}>{zCap(selZone)}명</strong></span>
                    <span>평균 체험 <strong style={{color:'#111'}}>{zDwell(selZone)}초</strong></span>
                    <span>미디어 <strong style={{color:'#111'}}>{selZone.media.length}개</strong></span>
                  </div>
                </>
              )}
            </div>
          </div>{/* /detail */}
        </div>{/* /build-main */}
      </div>{/* /build-layout */}
    </div>
  )
}
