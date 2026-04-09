import useSimStore from '../../store/simulationStore'

const STATUS = {
  bottleneck: { icon:'🔴', label:'병목',  color:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
  crowded:    { icon:'🟡', label:'과밀',  color:'#D97706', bg:'#FFFBEB', border:'#FDE68A' },
  underused:  { icon:'⚪', label:'저활용', color:'#9CA3AF', bg:'#F9FAFB', border:'#E5E7EB' },
  efficient:  { icon:'🟢', label:'효율',  color:'#059669', bg:'#ECFDF5', border:'#A7F3D0' },
}
const gradeColor = sr => sr > 50 ? '#DC2626' : sr > 20 ? '#D97706' : '#059669'

const VIEWS = [
  { id:'all',    label:'종합' },
  { id:'heatmap',label:'히트맵' },
  { id:'zones',  label:'구역 분석' },
  { id:'media',  label:'미디어' },
]

export default function HeatmapPanel({
  tab, hCRef, heatScrubSnapRef, redrawHeat,
  onZoomIn, onZoomOut, onResetView, panMode, onTogglePan,
  onCanvasClick,
}) {
  const {
    heatTimeline, heatScrubIdx, viewFloor, floorCount, floorSizes, heatZoneStats,
    reportData, heatMainView, heatPopupZone,
    setHeatScrubIdx, setViewFloor, setTab, setHeatMainView, setHeatPopupZone,
  } = useSimStore()

  const zones    = reportData?.zones ?? []

  const jump = idx => {
    const s = heatTimeline[idx]
    heatScrubSnapRef.current = (s && idx < heatTimeline.length - 1) ? s : null
    setHeatScrubIdx(idx)
    redrawHeat?.((s && idx < heatTimeline.length - 1) ? s : null)
  }

  const popupZone = heatPopupZone
    ? (heatZoneStats.find(z => z.id === heatPopupZone.zoneId) || null)
    : null
  const popupRd = popupZone ? zones.find(z => z.id === popupZone.id) : null

  // scrubber vars
  const hasData     = reportData || heatTimeline.length > 0
  const cur         = heatTimeline.length > 0 ? heatTimeline[Math.min(heatScrubIdx, heatTimeline.length-1)] : null
  const isFinal     = heatScrubIdx >= heatTimeline.length - 1
  const total       = Math.max(1, heatTimeline.length - 1)
  const hasMultiple = heatTimeline.length > 1
  const fillPct     = hasMultiple ? Math.round(heatScrubIdx / total * 100) : 100
  const trackBg     = `linear-gradient(to right,#1D9E75 0%,#1D9E75 ${fillPct}%,#e0eae6 ${fillPct}%,#e0eae6 100%)`
  const ticks = []
  heatTimeline.forEach((s, i) => {
    if (i === 0 || heatTimeline[i-1]?.slotIdx !== s.slotIdx) ticks.push({ i, label: s.slotLabel })
  })

  return (
    <div style={{ display: tab==='heat' ? 'block' : 'none', position:'absolute', inset:0 }}>
      <div className="sim-layout">

        {/* ═══════════════ 사이드바 ═══════════════ */}
        <div className="sim-sidebar" style={{ overflowY:'auto', gap:0 }}>

          {/* Run 배너 */}
          {reportData && (
            <div style={{
              margin:'0 0 10px',
              background:'linear-gradient(145deg,#0c2318 0%,#163527 50%,#0c2318 100%)',
              borderRadius:11, border:'1px solid rgba(29,158,117,0.25)',
              padding:'10px 11px', position:'relative', overflow:'hidden',
            }}>
              {/* 배경 장식 */}
              <div style={{ position:'absolute', top:-12, right:-12, width:56, height:56, borderRadius:'50%', background:'rgba(29,158,117,0.08)' }}/>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', color:'rgba(74,222,128,0.7)', marginBottom:5, textTransform:'uppercase' }}>
                📊 분석 중
              </div>
              {reportData._runNo && (
                <div style={{ fontSize:10, fontWeight:800, color:'#4ade80', marginBottom:2, letterSpacing:'0.04em' }}>
                  RUN #{reportData._runNo}
                </div>
              )}
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {reportData._project}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom: reportData._ts ? 4 : 0 }}>
                {reportData._scenario} · {reportData._rangeLabel}
              </div>
              {reportData._ts && (
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>{reportData._ts}</div>
              )}
            </div>
          )}

          {/* 전체 분석 결과 */}
          {reportData ? (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase' }}>전체 결과</span>
                <button onClick={() => setTab('report')} style={{
                  fontSize:10, color:'#7C3AED', background:'#f5f0ff', border:'1px solid #e0d4f7',
                  borderRadius:7, cursor:'pointer', fontWeight:700, padding:'4px 10px', letterSpacing:'0.02em',
                }}>Insights →</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'도달률',  val: reportData.flowEff!=null?`${reportData.flowEff}%`:'-',
                    c: reportData.flowEff>=80?'#059669':reportData.flowEff>=60?'#D97706':'#DC2626',
                    bg: reportData.flowEff>=80?'#ECFDF5':reportData.flowEff>=60?'#FFFBEB':'#FEF2F2' },
                  { label:'체험전환율', val: reportData.engRate!=null?`${reportData.engRate}%`:'-',
                    c: reportData.engRate>=70?'#059669':reportData.engRate>=50?'#D97706':'#DC2626',
                    bg: reportData.engRate>=70?'#ECFDF5':reportData.engRate>=50?'#FFFBEB':'#FEF2F2' },
                  { label:'평균혼잡도', val: reportData.avgWait!=null?`${reportData.avgWait}초`:'-',
                    c: reportData.avgWait<=20?'#059669':reportData.avgWait<=40?'#D97706':'#DC2626',
                    bg: reportData.avgWait<=20?'#ECFDF5':reportData.avgWait<=40?'#FFFBEB':'#FEF2F2' },
                  { label:'병목구역',   val: `${(heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length}건`,
                    c: (heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length===0?'#059669':'#DC2626',
                    bg: (heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length===0?'#ECFDF5':'#FEF2F2' },
                ].map(k => (
                  <div key={k.label} style={{
                    background: k.bg, border:`1px solid ${k.c}30`,
                    borderRadius:10, padding:'8px 8px', textAlign:'center',
                    boxShadow:`0 1px 3px ${k.c}10`,
                  }}>
                    <div style={{ fontSize:10, color:k.c+'99', marginBottom:4, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>{k.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:k.c, lineHeight:1 }}>{k.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              marginBottom:12, padding:'16px 10px', borderRadius:11,
              background:'#F9FAFB', border:'1px solid #eee', textAlign:'center',
            }}>
              <div style={{ fontSize:20, marginBottom:6 }}>📭</div>
              <div style={{ fontSize:10, color:'#bbb', lineHeight:1.5 }}>시뮬레이션 실행 후<br/>분석 결과가 표시됩니다</div>
            </div>
          )}

          {/* 층 탭 */}
          {floorCount > 1 && (
            <>
              <div className="bs-area-row" style={{ marginBottom:8 }}>
                {Array.from({ length: floorCount }, (_, i) => (
                  <div key={i} className={`bs-area-tab${viewFloor===i?' active':''}`}>
                    <button className="bs-area-btn" onClick={() => setViewFloor(i)}>A{i+1}</button>
                  </div>
                ))}
              </div>
              <div className="bs-divider"/>
            </>
          )}

          {/* 구역 상태 */}
          <div style={{ marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', display:'block', marginBottom:8 }}>구역 상태</span>
            {heatZoneStats.length === 0 ? (
              <div style={{ fontSize:10, color:'#ccc', padding:'8px 0', textAlign:'center' }}>시뮬레이션 후 표시됩니다</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[...heatZoneStats]
                  .sort((a, b) => {
                    const order = { bottleneck:0, crowded:1, underused:2, efficient:3 }
                    return (order[a.statusKey]??4) - (order[b.statusKey]??4)
                  })
                  .map(z => {
                    const st = STATUS[z.statusKey]
                    const active = heatPopupZone?.zoneId === z.id
                    return (
                      <button key={z.id} onClick={() => setHeatPopupZone(
                        active ? null : { zoneId: z.id }
                      )} style={{
                        padding:'8px 12px', borderRadius:8, cursor:'pointer', textAlign:'left',
                        background: active ? (st?.bg ?? '#f5f5f5') : '#fff',
                        border: `1px solid ${active ? (st?.color ?? '#ccc') : '#eef0ee'}`,
                        transition:'all 0.12s',
                        boxShadow: active ? `0 0 0 2px ${st?.color ?? '#ccc'}20` : '0 1px 2px rgba(0,0,0,0.04)',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ fontSize:12, lineHeight:1 }}>{st?.icon ?? '○'}</span>
                          <span style={{ flex:1, fontSize:10.5, fontWeight:600, color:'#222', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{z.name}</span>
                          {st && <span style={{
                            fontSize:8, fontWeight:700, color:st.color,
                            background:`${st.color}15`, border:`1px solid ${st.color}25`,
                            borderRadius:5, padding:'2px 6px', flexShrink:0, letterSpacing:'0.03em',
                          }}>{st.label}</span>}
                        </div>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>

          {/* 밀집도 범례 */}
          <div className="bs-divider"/>
          <div style={{ paddingTop:4 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>밀집도</div>
            <div className="heat-legend-bar"/>
            <div className="heat-legend-labels"><span>낮음</span><span>높음</span></div>
          </div>
        </div>

        {/* ═══════════════ 메인 ═══════════════ */}
        <div className="sim-main" style={{
          left:240, top:68, right:0, bottom:0, padding:0,
          overflow:'hidden', boxSizing:'border-box',
          display:'flex', flexDirection:'column',
        }}>

          {/* ── 툴바: 뷰 탭 + 스크러버 ── */}
          <div style={{ padding:'8px 304px 0 4px', flexShrink:0 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'0 12px', height:48, flexShrink:0,
            background:'rgba(255,255,255,0.92)',
            backdropFilter:'blur(14px)',
            WebkitBackdropFilter:'blur(14px)',
            borderRadius:12,
            boxShadow:'0 2px 10px rgba(0,0,0,0.08)',
            border:'1px solid rgba(255,255,255,0.80)',
          }}>
            {/* 세그먼트 탭 */}
            <div style={{
              display:'flex', gap:0, flexShrink:0,
              background:'#F3F6F4', borderRadius:10, padding:3,
              border:'1px solid #E8EDE9',
            }}>
              {VIEWS.map(v => (
                <button key={v.id} onClick={() => setHeatMainView(v.id)} style={{
                  padding:'4px 10px', borderRadius:7, fontSize:10, fontWeight:heatMainView===v.id?700:500,
                  cursor:'pointer', border:'none', transition:'all 0.15s',
                  background: heatMainView===v.id ? '#1D9E75' : 'transparent',
                  color: heatMainView===v.id ? '#fff' : '#9CA3AF',
                  boxShadow: heatMainView===v.id ? '0 1px 4px rgba(29,158,117,0.3)' : 'none',
                  letterSpacing: heatMainView===v.id ? '-0.01em' : '0',
                }}>{v.label}</button>
              ))}
            </div>

            <div style={{ width:1, height:22, background:'#E8EDE9', flexShrink:0 }}/>

            {/* 스크러버 영역 */}
            {!hasData ? (
              <span style={{ fontSize:10, color:'#C0C8C2', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>시뮬레이션 후 활성화됩니다</span>
            ) : heatTimeline.length === 0 ? (
              <span style={{ fontSize:10, color:'#B45309', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>⚠ 타임라인 없음 — 재실행 필요</span>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                {/* 슬롯 배지 */}
                <span style={{
                  flexShrink:0, fontSize:9.5, fontWeight:700,
                  color: isFinal ? '#059669' : '#fff',
                  background: isFinal ? '#ECFDF5' : '#1D9E75',
                  border: isFinal ? '1px solid #A7F3D0' : '1px solid transparent',
                  padding:'3px 9px', borderRadius:20,
                  letterSpacing:'0.01em',
                }}>
                  {isFinal ? '✅ 완료' : cur?.slotLabel}
                </span>
                {!isFinal && (
                  <span style={{ flexShrink:0, fontSize:9.5, fontWeight:600, color:'#1D9E75' }}>
                    {cur?.pct}%
                  </span>
                )}

                {hasMultiple && (
                  <>
                    <button onClick={() => jump(Math.max(0, heatScrubIdx-1))} disabled={heatScrubIdx===0}
                      style={{
                        flexShrink:0, width:24, height:24, borderRadius:20,
                        border:'1px solid #E8EDE9', background:'#F3F6F4', cursor:'pointer',
                        fontSize:8, opacity:heatScrubIdx===0?0.3:1,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'#6B7280',
                      }}>◀</button>
                    <div style={{ flex:1, position:'relative', minWidth:60 }}>
                      <input type="range" min={0} max={total} value={heatScrubIdx}
                        style={{
                          width:'100%', height:4, borderRadius:2, outline:'none',
                          cursor:'pointer', background:trackBg,
                          appearance:'none', WebkitAppearance:'none',
                        }}
                        onChange={e => jump(+e.target.value)}/>
                    </div>
                    <button onClick={() => jump(Math.min(total, heatScrubIdx+1))} disabled={heatScrubIdx===total}
                      style={{
                        flexShrink:0, width:24, height:24, borderRadius:20,
                        border:'1px solid #E8EDE9', background:'#F3F6F4', cursor:'pointer',
                        fontSize:8, opacity:heatScrubIdx===total?0.3:1,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'#6B7280',
                      }}>▶</button>
                  </>
                )}
                <span style={{ flexShrink:0, fontSize:9, color:'#C0C8C2', fontVariantNumeric:'tabular-nums', background:'#F3F6F4', border:'1px solid #E8EDE9', borderRadius:20, padding:'2px 8px' }}>
                  {heatScrubIdx+1}<span style={{ color:'#D0D8D4', margin:'0 1px' }}>/</span>{heatTimeline.length}
                </span>
              </div>
            )}
          </div>
          </div>

          {/* ── 캔버스 ── */}
          <div style={{ position:'relative', flex:1, minHeight:0, overflow:'hidden' }}>
            <div className="cw" style={{ overflow:'hidden' }}
              onClick={e => onCanvasClick?.(e.nativeEvent)}
            >
              <div style={{ position:'relative', display:'inline-block', lineHeight:0 }}>
                <canvas ref={hCRef}/>
              </div>

              <div className="canvas-zoom-ctrl">
                <button className="canvas-zoom-btn" onClick={onZoomIn} title="확대">+</button>
                <button className="canvas-zoom-btn" onClick={onResetView} title="뷰 초기화" style={{ fontSize:9, padding:'0 4px' }}>⟲</button>
                <button className="canvas-zoom-btn" onClick={onZoomOut} title="축소">−</button>
                <div style={{ width:1, height:16, background:'rgba(0,0,0,0.08)', margin:'0 2px' }}/>
                <button className="canvas-zoom-btn" onClick={onTogglePan} title="이동"
                  style={{ background:panMode?'rgba(29,158,117,0.12)':undefined, color:panMode?'#1D9E75':undefined }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                </button>
              </div>
            </div>

            {/* 존 팝업 */}
            {popupZone && (() => {
              const st = STATUS[popupZone.statusKey]
              return (
                <div style={{
                  position:'absolute',
                  top:  heatPopupZone?.y != null ? Math.min(heatPopupZone.y, window.innerHeight - 380) : 60,
                  left: heatPopupZone?.x != null ? Math.min(heatPopupZone.x + 10, window.innerWidth - 300) : 'auto',
                  right: heatPopupZone?.x == null ? 14 : 'auto',
                  width:272, zIndex:50,
                  background:'#fff', borderRadius:14,
                  border:`1.5px solid ${st?.border ?? '#E8EDE8'}`,
                  boxShadow:'0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
                  overflow:'hidden',
                }}>
                  {/* 팝업 헤더 */}
                  <div style={{
                    padding:'12px 14px 10px',
                    background: st?.bg ?? '#F9FAFB',
                    borderBottom:`1px solid ${st?.border ?? '#eee'}`,
                    display:'flex', alignItems:'center', gap:8,
                  }}>
                    <span style={{ fontSize:14 }}>{st?.icon ?? '○'}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:700, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {popupZone.name}
                    </span>
                    {st && (
                      <span style={{
                        fontSize:9.5, fontWeight:600, color:st.color,
                        background:'#fff', border:`1px solid ${st.border}`,
                        borderRadius:5, padding:'2px 7px', flexShrink:0,
                      }}>{st.label}</span>
                    )}
                    <button onClick={() => setHeatPopupZone(null)} style={{
                      background:'none', border:'none', cursor:'pointer',
                      fontSize:14, color:'#C0C8C2', lineHeight:1, padding:0, flexShrink:0,
                    }}>✕</button>
                  </div>

                  {/* 스탯 */}
                  <div style={{ padding:'10px 12px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:8 }}>
                      {[
                        { label:'진입',   val:`${popupZone.entries}명`, c:'#374151' },
                        { label:'전환율', val:`${popupZone.convRate}%`,
                          c: popupZone.convRate>60?'#059669':popupZone.convRate>30?'#2563EB':'#D97706' },
                        { label:'대기',   val:`${popupZone.avgWait}초`,
                          c: popupZone.avgWait>20?'#DC2626':popupZone.avgWait>10?'#D97706':'#059669' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign:'center', background:'#F8FAF9', borderRadius:8, padding:'8px 6px' }}>
                          <div style={{ fontSize:8.5, color:'#B0BAB5', marginBottom:3, fontWeight:600 }}>{s.label}</div>
                          <div style={{ fontSize:13, fontWeight:800, color:s.c }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {popupRd && popupRd.entries > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom: popupRd.media?.filter(m=>m.exposure>0).length > 0 ? 8 : 0 }}>
                        {[
                          { label:'스킵율',   val:`${popupRd.skipRate??0}%`, c:gradeColor(popupRd.skipRate??0) },
                          { label:'몰입 강도', val:popupRd.engIdx!=null?`★${popupRd.engIdx}`:'-', c:'#7C3AED' },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign:'center', background:'#F8FAF9', borderRadius:8, padding:'8px 6px' }}>
                            <div style={{ fontSize:8.5, color:'#B0BAB5', marginBottom:3, fontWeight:600 }}>{s.label}</div>
                            <div style={{ fontSize:13, fontWeight:800, color:s.c }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {popupRd?.media?.filter(m=>m.exposure>0).length > 0 && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:5, letterSpacing:'0.06em', textTransform:'uppercase' }}>미디어 현황</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:136, overflowY:'auto' }}>
                          {popupRd.media.filter(m=>m.exposure>0).sort((a,b)=>(b.skipRate??0)-(a.skipRate??0)).map(m => {
                            const grade = m.skipRate>50?{g:'D',c:'#DC2626'}:m.skipRate>20?{g:'C',c:'#D97706'}:m.skipRate>10?{g:'B',c:'#2563EB'}:{g:'A',c:'#059669'}
                            return (
                              <div key={m.uid} style={{
                                display:'flex', alignItems:'center', gap:7,
                                padding:'6px 8px', background:'#F9FAFB',
                                borderRadius:7, border:'1px solid #F0F0F0',
                              }}>
                                <span style={{ width:8, height:8, borderRadius:2, background:m.bg||'#eee', border:`1.5px solid ${m.color||'#ccc'}`, flexShrink:0 }}/>
                                <span style={{ flex:1, fontSize:10, fontWeight:500, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                                <span style={{ fontSize:9, color:'#C0C8C2', flexShrink:0 }}>{m.exposure}회</span>
                                <span style={{ fontSize:11, fontWeight:800, color:grade.c, width:12, textAlign:'center', flexShrink:0 }}>{grade.g}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}
