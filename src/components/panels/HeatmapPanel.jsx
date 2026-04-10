import useSimStore from '../../store/simulationStore'

const STATUS = {
  bottleneck: { icon:'🔴', label:'병목',  color:'#ef4444', bg:'#fef2f2', border:'#fecaca' },
  crowded:    { icon:'🟡', label:'과밀',  color:'#d97706', bg:'#fffbeb', border:'#fed7aa' },
  underused:  { icon:'⚪', label:'저활용', color:'#a1a1aa', bg:'#fafafa', border:'#e4e4e7' },
  efficient:  { icon:'🟢', label:'효율',  color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
}
const gradeColor = sr => sr > 50 ? '#ef4444' : sr > 20 ? '#d97706' : '#16a34a'

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
  const trackBg     = `linear-gradient(to right,#18181b 0%,#18181b ${fillPct}%,#d4d4d8 ${fillPct}%,#d4d4d8 100%)`
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
            <div className="card-base card-sm" style={{marginBottom:10}}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  분석 중
                </span>
                {reportData._runNo && (
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)' }}>
                    RUN #{reportData._runNo}
                  </span>
                )}
              </div>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--color-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>
                {reportData._scenario || reportData._project || '—'}
              </div>
              <div style={{ fontSize:10, color:'var(--color-text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {reportData._rangeLabel}{reportData._ts ? ` · ${reportData._ts}` : ''}
              </div>
            </div>
          )}

          {/* 전체 분석 결과 */}
          {reportData ? (
            <div style={{ marginBottom:12 }}>
              <div className="sec-header" style={{marginBottom:8}}>
                <span className="sec-title">전체 결과</span>
                <button onClick={() => setTab('report')} style={{
                  fontSize:10, color:'#fff', background:'var(--color-purple)', border:'none',
                  borderRadius:4, cursor:'pointer', fontWeight:600, padding:'4px 10px',letterSpacing:'0.06em',
                }}>Insights →</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'도달률',  val: reportData.flowEff!=null?`${reportData.flowEff}%`:'-',
                    c: reportData.flowEff>=80?'var(--color-success)':reportData.flowEff>=60?'var(--color-warning)':'var(--color-error)',
                    bg: reportData.flowEff>=80?'var(--color-success-bg)':reportData.flowEff>=60?'var(--color-warning-bg)':'var(--color-error-bg)' },
                  { label:'체험전환율', val: reportData.engRate!=null?`${reportData.engRate}%`:'-',
                    c: reportData.engRate>=70?'var(--color-success)':reportData.engRate>=50?'var(--color-warning)':'var(--color-error)',
                    bg: reportData.engRate>=70?'var(--color-success-bg)':reportData.engRate>=50?'var(--color-warning-bg)':'var(--color-error-bg)' },
                  { label:'평균혼잡도', val: reportData.avgWait!=null?`${reportData.avgWait}초`:'-',
                    c: reportData.avgWait<=20?'var(--color-success)':reportData.avgWait<=40?'var(--color-warning)':'var(--color-error)',
                    bg: reportData.avgWait<=20?'var(--color-success-bg)':reportData.avgWait<=40?'var(--color-warning-bg)':'var(--color-error-bg)' },
                  { label:'병목구역',   val: `${(heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length}건`,
                    c: (heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length===0?'var(--color-success)':'var(--color-error)',
                    bg: (heatZoneStats||[]).filter(z=>z.statusKey==='bottleneck'||z.statusKey==='crowded').length===0?'var(--color-success-bg)':'var(--color-error-bg)' },
                ].map(k => (
                  <div key={k.label} style={{
                    background: k.bg, border:`1px solid ${k.c}`,
                    borderRadius:10, padding:'8px 8px', textAlign:'center',
                  }}>
                    <div style={{ fontSize:10, color:k.c, marginBottom:4, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', opacity:0.75 }}>{k.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:k.c, lineHeight:1 }}>{k.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card-base" style={{marginBottom:12, textAlign:'center'}}>
              <div style={{ fontSize:20, marginBottom:6 }}>📭</div>
              <div style={{ fontSize:10, color:'var(--color-text-muted)', lineHeight:1.5 }}>시뮬레이션 실행 후<br/>분석 결과가 표시됩니다</div>
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
            <span className="sec-title" style={{ display:'block', marginBottom:8 }}>구역 상태</span>
            {heatZoneStats.length === 0 ? (
              <div style={{ fontSize:10, color:'var(--color-text-muted)', padding:'8px 0', textAlign:'center' }}>시뮬레이션 후 표시됩니다</div>
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
                        border: `1px solid ${active ? (st?.color ?? '#ccc') : '#f4f4f5'}`,
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
            <div className="sec-title" style={{ marginBottom:8 }}>밀집도</div>
            <div className="heat-legend-bar"/>
            <div className="heat-legend-labels"><span>낮음</span><span>높음</span></div>
          </div>
        </div>

        {/* ═══════════════ 메인 ═══════════════ */}
        <div className="sim-main" style={{
          padding:0,
          overflow:'hidden',
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
              background:'#f4f4f5', borderRadius:10, padding:3,
              border:'1px solid #e4e4e7',
            }}>
              {VIEWS.map(v => (
                <button key={v.id} onClick={() => setHeatMainView(v.id)} style={{
                  padding:'4px 10px', borderRadius:7, fontSize:10, fontWeight:heatMainView===v.id?700:500,
                  cursor:'pointer', border:'none', transition:'all 0.15s',
                  background: heatMainView===v.id ? '#18181b' : 'transparent',
                  color: heatMainView===v.id ? '#fff' : '#a1a1aa',
                  boxShadow: heatMainView===v.id ? '0 1px 4px rgba(9,9,11,0.1)' : 'none',
                  letterSpacing: heatMainView===v.id ? '-0.01em' : '0',
                }}>{v.label}</button>
              ))}
            </div>

            <div style={{ width:1, height:22, background:'#e4e4e7', flexShrink:0 }}/>

            {/* 스크러버 영역 */}
            {!hasData ? (
              <span style={{ fontSize:10, color:'var(--color-text-muted)', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>시뮬레이션 후 활성화됩니다</span>
            ) : heatTimeline.length === 0 ? (
              <span style={{ fontSize:10, color:'var(--color-warning)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>⚠ 타임라인 없음 — 재실행 필요</span>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                {/* 슬롯 배지 */}
                <span style={{
                  flexShrink:0, fontSize:9.5, fontWeight:700,
                  color: isFinal ? 'var(--color-success)' : '#fff',
                  background: isFinal ? 'var(--color-success-bg)' : '#18181b',
                  border: isFinal ? '1px solid var(--color-success-border)' : '1px solid transparent',
                  padding:'3px 9px', borderRadius:20,
                  letterSpacing:'0.01em',
                }}>
                  {isFinal ? '✅ 완료' : cur?.slotLabel}
                </span>
                {!isFinal && (
                  <span style={{ flexShrink:0, fontSize:9.5, fontWeight:600, color:'var(--color-text)' }}>
                    {cur?.pct}%
                  </span>
                )}

                {hasMultiple && (
                  <>
                    <button onClick={() => jump(Math.max(0, heatScrubIdx-1))} disabled={heatScrubIdx===0}
                      style={{
                        flexShrink:0, width:24, height:24, borderRadius:20,
                        border:'1px solid var(--color-border)', background:'var(--color-bg-section)', cursor:'pointer',
                        fontSize:8, opacity:heatScrubIdx===0?0.3:1,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-secondary)',
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
                        border:'1px solid var(--color-border)', background:'var(--color-bg-section)', cursor:'pointer',
                        fontSize:8, opacity:heatScrubIdx===total?0.3:1,
                        display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-secondary)',
                      }}>▶</button>
                  </>
                )}
                <span className="slot-chip" style={{ fontSize:9, fontVariantNumeric:'tabular-nums' }}>
                  {heatScrubIdx+1}<span style={{ color:'var(--color-text-muted)', margin:'0 1px' }}>/</span>{heatTimeline.length}
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
                  style={{ background:panMode?'rgba(9,9,11,0.06)':undefined, color:panMode?'#18181b':undefined }}>
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
                  border:`1.5px solid ${st?.border ?? '#e4e4e7'}`,
                  boxShadow:'0 12px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
                  overflow:'hidden',
                }}>
                  {/* 팝업 헤더 */}
                  <div style={{
                    padding:'12px 14px 10px',
                    background: st?.bg ?? '#fafafa',
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
                      fontSize:14, color:'#a1a1aa', lineHeight:1, padding:0, flexShrink:0,
                    }}>✕</button>
                  </div>

                  {/* 스탯 */}
                  <div style={{ padding:'10px 12px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginBottom:8 }}>
                      {[
                        { label:'진입',   val:`${popupZone.entries}명`, c:'#09090b' },
                        { label:'전환율', val:`${popupZone.convRate}%`,
                          c: popupZone.convRate>60?'#16a34a':popupZone.convRate>30?'#18181b':'#d97706' },
                        { label:'대기',   val:`${popupZone.avgWait}초`,
                          c: popupZone.avgWait>20?'#ef4444':popupZone.avgWait>10?'#d97706':'#16a34a' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign:'center', background:'#f4f4f5', borderRadius:8, padding:'8px 6px' }}>
                          <div style={{ fontSize:8.5, color:'#a1a1aa', marginBottom:3, fontWeight:600 }}>{s.label}</div>
                          <div style={{ fontSize:13, fontWeight:800, color:s.c }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {popupRd && popupRd.entries > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom: popupRd.media?.filter(m=>m.exposure>0).length > 0 ? 8 : 0 }}>
                        {[
                          { label:'스킵율',   val:`${popupRd.skipRate??0}%`, c:gradeColor(popupRd.skipRate??0) },
                          { label:'몰입 강도', val:popupRd.engIdx!=null?`★${popupRd.engIdx}`:'-', c:'#7c3aed' },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign:'center', background:'#f4f4f5', borderRadius:8, padding:'8px 6px' }}>
                            <div style={{ fontSize:8.5, color:'#a1a1aa', marginBottom:3, fontWeight:600 }}>{s.label}</div>
                            <div style={{ fontSize:13, fontWeight:800, color:s.c }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {popupRd?.media?.filter(m=>m.exposure>0).length > 0 && (
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:'#71717a', marginBottom:5, letterSpacing:'0.06em', textTransform:'uppercase' }}>미디어 현황</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:136, overflowY:'auto' }}>
                          {popupRd.media.filter(m=>m.exposure>0).sort((a,b)=>(b.skipRate??0)-(a.skipRate??0)).map(m => {
                            const grade = m.skipRate>50?{g:'D',c:'#ef4444'}:m.skipRate>20?{g:'C',c:'#d97706'}:m.skipRate>10?{g:'B',c:'#18181b'}:{g:'A',c:'#16a34a'}
                            return (
                              <div key={m.uid} style={{
                                display:'flex', alignItems:'center', gap:7,
                                padding:'6px 8px', background:'#fafafa',
                                borderRadius:7, border:'1px solid rgba(0,0,0,0.06)',
                              }}>
                                <span style={{ width:8, height:8, borderRadius:2, background:m.bg||'#eee', border:`1.5px solid ${m.color||'#ccc'}`, flexShrink:0 }}/>
                                <span style={{ flex:1, fontSize:10, fontWeight:500, color:'#09090b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                                <span style={{ fontSize:9, color:'#a1a1aa', flexShrink:0 }}>{m.exposure}회</span>
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
