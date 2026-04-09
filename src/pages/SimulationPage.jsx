import { useRef, useEffect, useCallback, useState } from 'react'
import * as XLSX from 'xlsx'

import useSimStore from '../store/simulationStore'
import {
  MT, FT, ALL_MT, INIT_ZONES,
  CW, CH, MS,
  SLOTS, SLOT_DEF_TOTALS, makeSlotCfg,
  SEGS, DOCENT_COLOR, VISITOR_TYPES,
} from '../constants'
import {
  clone, uid, zCap, zDwell,
  zoneAt, mediaAt, layoutAll,
  pickNearest, sc2, ptInPoly,
  busyCount, rr, drawMIcon,
} from '../utils'

import Header      from '../components/layout/Header'
import StatBar     from '../components/layout/StatBar'
import SetupPanel  from '../components/panels/SetupPanel'
import SimPanel    from '../components/panels/SimPanel'
import HeatmapPanel from '../components/panels/HeatmapPanel'
import ResultPanel  from '../components/panels/ResultPanel'

export default function SimulationPage() {
  // ── Get all state from store ──
  const {
    projectName, projectInput, tab, scenarioName, zones, selZoneId, editZone, editMediaUid,
    editingZoneName, simStatus, slot, speed, canvasZoom, flowType, circularFlow,
    palOpen, slotCfgs, simRange, slotResults, simLogs, reportData,
    heatTimeline, heatScrubIdx, runningSlot, viewFloor, floorCount, floorSizes, tmpSize,
    dispStats, skipTable, confirmModal, heatMainView,
    setProjectName, setProjectInput, setTab, setScenarioName, setZones, setSelZoneId, setEditZone,
    setEditMediaUid, setActiveMediaUid, setEditingZoneName, setSimStatus, setSlot, setSpeed,
    setCanvasZoom, setFlowType, setCircularFlow, setPalOpen, setSlotCfgs,
    setSimRange, setSlotResults, setSimLogs, setReportData, setHeatTimeline,
    setHeatScrubIdx, setRunningSlot, setViewFloor, setFloorCount, setFloorSizes,
    setTmpSize, setDispStats, setSkipTable, setHeatZoneStats, setConfirmModal, setHeatPopupZone,
  } = useSimStore()

  // ── 캔버스 ref ──
  const bCRef = useRef(null)
  const sCRef = useRef(null)
  const hCRef = useRef(null)
  const rCRef = useRef(null)

  // ── 뮤터블 시뮬레이션 ref (리렌더 방지) ──
  const zonesRef     = useRef(clone(INIT_ZONES))
  const viewFloorRef = useRef(0)
  const selRef       = useRef(null)
  const agentsRef   = useRef([])
  const simTimeRef  = useRef(0)
  const spawnTimer  = useRef(0)
  const tourTimer      = useRef(0)
  const docentCfgRef   = useRef({enabled:false, interval:30, size:20})
  const slotCfgsRef    = useRef(SLOT_DEF_TOTALS.map(makeSlotCfg))
  const simRangeRef    = useRef({start:0, end:0})
  const runningSlotRef   = useRef(0)
  const totalSpawnedRef     = useRef(0)
  const cumulativeVisitorsRef = useRef(0)  // 완료된 슬롯 누적 관람객
  const heatAcc     = useRef({})
  const skipStats   = useRef({})
  const engAcc      = useRef({})
  const bnRef       = useRef(0)
  const dwellTotal  = useRef(0)
  const exitedCnt   = useRef(0)
  const runRef      = useRef(false)
  const pausedRef   = useRef(false)
  const lastTRef    = useRef(null)
  const rafRef      = useRef(null)
  const flashRef    = useRef([])
  const rptChart    = useRef(null)
  const loadFileRef    = useRef(null)
  const floorSizesRef  = useRef([{w:20,h:14}])
  const floorCountRef  = useRef(1)
  const dynCHRef       = useRef(CH)
  const zoneDragRef = useRef(null)

  // ── 언두/리두 ──
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const polyDrawRef   = useRef({active:false, pts:[]})
  const vertexDragRef = useRef(null)
  const [polyDrawing, setPolyDrawing] = useState(false)
  const mediaPolyDrawRef  = useRef({active:false, uid:null, pts:[]})
  const mediaPolyEditRef  = useRef(null)       // 편집 중인 미디어 uid
  const mediaPolyVtxDragRef = useRef(null)     // {uid, idx, sx, sy, ox, oy}
  const [mediaPolyDrawing, setMediaPolyDrawing] = useState(false)
  const [mediaPolyEditingUid, setMediaPolyEditingUid] = useState(null)

  // canvas를 컨테이너에 aspect-ratio 맞춰 fit하는 cssW 계산
  function fitCanvasWidth(canvas, dynCH) {
    // inline-block 래퍼 때문에 부모가 작을 수 있으므로 .cw 까지 올라감
    const p = canvas.closest('.cw') || canvas.parentElement
    if (!p) return CW
    const cW = p.clientWidth || CW
    const cH = p.clientHeight || dynCH
    const aspect = dynCH / CW
    return cH / cW < aspect ? Math.floor(cH / aspect) : cW
  }
  const heatSnapshotsRef = useRef([])
  const lastSnapIdxRef   = useRef(-1)
  const heatScrubSnapRef = useRef(null)
  const zoneEntriesRef = useRef({})   // 존별 진입 수 { zoneId: count }
  const zoneEngagedRef = useRef({})   // 존별 체험 전환 수 { zoneId: count }
  const zoneWaitAccRef = useRef({})   // 존별 대기시간 누적 { zoneId: ms }

  // ── 설정 ref (루프 내 안정 접근) ──
  const speedRef    = useRef(1)
  const tabRef      = useRef('build')
  const slotRef     = useRef(0)
  const flowRef          = useRef('guided')
  const circularFlowRef  = useRef(false)
  const cfgRef      = useRef(makeSlotCfg(80))
  const canvasZoomRef = useRef(1.0)
  const reportDataRef = useRef(null)

  // ── 뷰 변환 ref (pan/zoom) ──
  const vtRef = useRef({scale:1, x:0, y:0})
  const panModeRef = useRef(false)
  const [panMode, setPanMode] = useState(false)
  const panDragRef = useRef(null)

  // ── 드래그 ref ──
  const palDragRef = useRef(null)
  const cvDrag  = useRef(null)
  const cvOff   = useRef({x:0,y:0})
  const didDrag = useRef(false)
  const isRestoredRef = useRef(false)
  const mxRef   = useRef(0)
  const myRef   = useRef(0)
  const shiftRef = useRef(false)

  // ── 입구/출구 아이콘 ref ──
  const doorDragRef  = useRef(null) // {type:'entry'|'exit', zoneId, sx,sy, ox,oy}

  // ── 설정 동기화 ──
  useEffect(()=>{ speedRef.current=speed }, [speed])
  useEffect(()=>{ tabRef.current=tab }, [tab])
  useEffect(()=>{ localStorage.setItem('exsim_scenarioName', scenarioName) }, [scenarioName])
  useEffect(()=>{ canvasZoomRef.current=canvasZoom; setTimeout(()=>{ drawBuild(); drawSim(); drawHeat() },0) }, [canvasZoom])
  useEffect(()=>{ slotRef.current=slot }, [slot])
  useEffect(()=>{ flowRef.current=flowType }, [flowType])
  useEffect(()=>{
    circularFlowRef.current=circularFlow
    if (circularFlow) {
      // 순환형 ON 시 첫 번째 존에 returnPos 자동 초기화
      const flZ=zonesRef.current.filter(z=>(z.floor||0)===0).sort((a,b)=>(a.order??0)-(b.order??0))
      const firstZ=flZ[0]
      if (firstZ && !firstZ.returnPos) {
        const pad=8
        firstZ.returnPos={ x:firstZ.x+pad, y:firstZ.y+firstZ.h-pad }
        setZones(clone(zonesRef.current))
      }
    }
    drawBuild()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circularFlow])
  useEffect(()=>{ floorSizesRef.current=floorSizes }, [floorSizes])
  useEffect(()=>{ floorCountRef.current=floorCount }, [floorCount])
  const heatMainViewRef = useRef('heatmap')
  useEffect(()=>{ heatMainViewRef.current=heatMainView; drawHeat() }, [heatMainView])
  useEffect(()=>{ const sz=floorSizes[viewFloor]||{w:20,h:14}; setTmpSize({w:sz.w,h:sz.h}) }, [viewFloor, floorSizes.length])

  // ── 언두/리두 헬퍼 ──
  function snapshotUndo() {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-49),
      {
        zones: clone(zonesRef.current),
        floorCount: floorCountRef.current,
        floorSizes: floorSizesRef.current.map(s=>({...s})),
      }
    ]
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }
  function performUndo() {
    if (undoStackRef.current.length === 0) return
    const snap = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current.slice(-49), {
      zones: clone(zonesRef.current),
      floorCount: floorCountRef.current,
      floorSizes: floorSizesRef.current.map(s=>({...s})),
    }]
    zonesRef.current = clone(snap.zones)
    setZones(clone(snap.zones))
    setFloorCount(snap.floorCount)
    setFloorSizes([...snap.floorSizes])
    selRef.current = null; setSelZoneId(null)
    layoutAll(zonesRef.current)
    drawBuild()
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
  }
  function performRedo() {
    if (redoStackRef.current.length === 0) return
    const snap = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current.slice(-49), {
      zones: clone(zonesRef.current),
      floorCount: floorCountRef.current,
      floorSizes: floorSizesRef.current.map(s=>({...s})),
    }]
    zonesRef.current = clone(snap.zones)
    setZones(clone(snap.zones))
    setFloorCount(snap.floorCount)
    setFloorSizes([...snap.floorSizes])
    selRef.current = null; setSelZoneId(null)
    layoutAll(zonesRef.current)
    drawBuild()
    setCanRedo(redoStackRef.current.length > 0)
    setCanUndo(true)
  }
  const performUndoRef  = useRef(null); performUndoRef.current  = performUndo
  const performRedoRef  = useRef(null); performRedoRef.current  = performRedo
  const snapshotUndoRef = useRef(null); snapshotUndoRef.current = snapshotUndo

  // 자동저장 (복원 완료 후에만)
  useEffect(()=>{
    if (!projectName || !isRestoredRef.current) return
    const data={ version:1, zones:zonesRef.current, slotCfgs:slotCfgsRef.current, floorCount, floorSizes }
    localStorage.setItem('exsim_projectName', projectName)
    localStorage.setItem('exsim_data', JSON.stringify(data))
  }, [zones, slotCfgs, floorCount, floorSizes, projectName])
  useEffect(()=>{ cfgRef.current=slotCfgs[slot]; docentCfgRef.current=slotCfgs[slot].docent }, [slotCfgs, slot])
  useEffect(()=>{ slotCfgsRef.current=slotCfgs }, [slotCfgs])
  useEffect(()=>{ simRangeRef.current=simRange }, [simRange])
  useEffect(()=>{ selRef.current=selZoneId }, [selZoneId])
  useEffect(()=>{ reportDataRef.current=reportData }, [reportData])

  // ── zones 상태 → 통계 업데이트 ──
  useEffect(()=>{
    const tc=zones.reduce((s,z)=>s+zCap(z),0)
    setDispStats(p=>({...p, mediaCount:zones.flatMap(z=>z.media).length, totalCap:tc+'명'}))
  }, [zones])

  // entry/exit 포지션을 존 경계 안으로 클램프
  function clampDoors(zoneList) {
    const pad=8
    zoneList.forEach(z=>{
      const clampPos = (pos) => {
        if (!pos) return pos
        let p = {
          x: Math.max(z.x+pad, Math.min(z.x+z.w-pad, pos.x)),
          y: Math.max(z.y+pad, Math.min(z.y+z.h-pad, pos.y)),
        }
        if (z.shape === 'L' && !ptInPoly(getLPoly(z), p.x, p.y)) {
          // push to center of zone
          p = { x: z.x+z.w/2, y: z.y+z.h/2 }
        }
        return p
      }
      if (z.entryPos)  z.entryPos  = clampPos(z.entryPos)
      if (z.returnPos) z.returnPos = clampPos(z.returnPos)
      if (z.exitPos)   z.exitPos   = clampPos(z.exitPos)
    })
  }

  // ── 입구/출구 아이콘 그리기 (캔버스용) ──
  function drawDoorIcon(ctx, pos, type, isSelected) {
    const isEntry=type==='entry'
    const color=isEntry?'#4A8A72':'#8A6060'
    const label=isEntry?'ENTRY':'EXIT'
    ctx.font='bold 3.8px sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    const tw=ctx.measureText(label).width+5, th=6.5
    ctx.fillStyle=isEntry?'rgba(74,138,114,0.12)':'rgba(138,96,96,0.12)'
    ctx.fillRect(pos.x-tw/2,pos.y-th/2,tw,th)
    ctx.fillStyle=color
    ctx.fillText(label,pos.x,pos.y+0.3)
    if (isSelected) {
      ctx.beginPath();ctx.arc(pos.x,pos.y-th/2-1.5,1,0,Math.PI*2)
      ctx.fillStyle=color;ctx.fill()
    }
    ctx.textBaseline='alphabetic';ctx.textAlign='left'
  }

  // 순환형 전용: ENTRY+EXIT 통합 아이콘
  function drawCircularDoorIcon(ctx, pos, isSelected) {
    ctx.font='bold 3.8px sans-serif'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    const label='ENTRY/EXIT'
    const tw=ctx.measureText(label).width+6, th=6.5
    const bx=pos.x-tw/2, by=pos.y-th/2
    ctx.fillStyle='rgba(90,143,168,0.12)'
    ctx.fillRect(bx, by, tw, th)
    ctx.strokeStyle='rgba(90,143,168,0.3)'; ctx.lineWidth=0.4
    ctx.strokeRect(bx, by, tw, th)
    ctx.fillStyle='#5A8FA8'
    ctx.fillText(label, pos.x, pos.y+0.3)
    ctx.restore()
    if (isSelected) {
      ctx.beginPath(); ctx.arc(pos.x, by-1.5, 1, 0, Math.PI*2)
      ctx.fillStyle='#5A8FA8'; ctx.fill()
    }
    ctx.textBaseline='alphabetic'; ctx.textAlign='left'
  }

  // ── 뷰 변환 헬퍼 ──
  const applyVT = useCallback((canvas) => {
    if (!canvas) return
    const {scale, x, y} = vtRef.current
    canvas.style.transformOrigin = '0 0'
    canvas.style.transform = `translate(${x}px,${y}px) scale(${scale})`
  }, [])

  const doZoom = useCallback((factor, cx, cy) => {
    const vt = vtRef.current
    const newScale = Math.max(0.2, Math.min(6, vt.scale * factor))
    const r = newScale / vt.scale

    // 캔버스의 자연(pre-transform) 위치 계산
    // 캔버스는 .cw(position:absolute;inset:0) 안에서 justify-content:center 로 수평 중앙 정렬됨
    const activeCanvas = [bCRef, sCRef, hCRef].find(ref => ref.current?.offsetParent)?.current
    const parent = activeCanvas?.parentElement
    const pRect = parent?.getBoundingClientRect()
    const cW = activeCanvas?.clientWidth ?? 0   // CSS width (transform 무관)
    const cH = activeCanvas?.clientHeight ?? 0
    const pW = pRect?.width ?? window.innerWidth
    const natLeft  = (pW - cW) / 2              // 캔버스 좌단 ← parent 좌단
    const natViewLeft = (pRect?.left ?? 0) + natLeft
    const natViewTop  = pRect?.top ?? 52

    // anchor를 element-local 좌표로 변환 (수식: vt = adj + (vt - adj)*r 이 adj를 screen에서 고정)
    const adjX = cx !== undefined ? cx - natViewLeft : (cW > 0 ? cW / 2 : window.innerWidth / 2)
    const adjY = cy !== undefined ? cy - natViewTop  : (cH > 0 ? cH / 2 : (window.innerHeight - 52) / 2)

    vt.x = adjX + (vt.x - adjX) * r
    vt.y = adjY + (vt.y - adjY) * r
    vt.scale = newScale
    ;[bCRef, sCRef, hCRef].forEach(ref => applyVT(ref.current))
  }, [applyVT])

  const resetVT = useCallback(() => {
    vtRef.current = {scale:1, x:0, y:0}
    ;[bCRef, sCRef, hCRef].forEach(ref => applyVT(ref.current))
  }, [applyVT])

  const togglePanMode = useCallback(() => {
    setPanMode(p => {
      const next = !p
      panModeRef.current = next
      ;[bCRef, sCRef, hCRef].forEach(r => {
        if (r.current) r.current.style.cursor = next ? 'grab' : ''
      })
      return next
    })
  }, [])

  // ═══════════════════════════════════════════════
  // Zone shape helpers
  // ═══════════════════════════════════════════════

  // Returns the 6 vertices of the L-shaped polygon
  function getLPoly(z) {
    const {x,y,w,h} = z
    const cw = Math.min(z.cutW ?? w*0.4, w-20)
    const ch = Math.min(z.cutH ?? h*0.4, h-20)
    switch(z.cutCorner ?? 'NE') {
      case 'NE': return [{x,y},{x:x+w-cw,y},{x:x+w-cw,y:y+ch},{x:x+w,y:y+ch},{x:x+w,y:y+h},{x,y:y+h}]
      case 'NW': return [{x:x+cw,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y:y+ch},{x:x+cw,y:y+ch}]
      case 'SE': return [{x,y},{x:x+w,y},{x:x+w,y:y+h-ch},{x:x+w-cw,y:y+h-ch},{x:x+w-cw,y:y+h},{x,y:y+h}]
      case 'SW': return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x:x+cw,y:y+h},{x:x+cw,y:y+h-ch},{x,y:y+h-ch}]
      default:   return [{x,y},{x:x+w-cw,y},{x:x+w-cw,y:y+ch},{x:x+w,y:y+ch},{x:x+w,y:y+h},{x,y:y+h}]
    }
  }

  // Point-in-polygon ray casting
  function ptInPoly(pts, px, py) {
    let inside = false
    for (let i=0,j=pts.length-1; i<pts.length; j=i++) {
      const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y
      if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside
    }
    return inside
  }

  // Returns the inner corner handle position for the L cutout (the vertex where the two inner edges meet)
  function getLCutHandle(z) {
    const {x,y,w,h} = z
    const cw = Math.min(z.cutW ?? w*0.4, w-20)
    const ch = Math.min(z.cutH ?? h*0.4, h-20)
    switch(z.cutCorner ?? 'NE') {
      case 'NE': return {x: x+w-cw, y: y+ch}
      case 'NW': return {x: x+cw,   y: y+ch}
      case 'SE': return {x: x+w-cw, y: y+h-ch}
      case 'SW': return {x: x+cw,   y: y+h-ch}
      default:   return {x: x+w-cw, y: y+ch}
    }
  }

  // Shift 스냅: 직전 점 기준 수평/수직 정렬
  function shiftSnap(pts, rawX, rawY) {
    if (!pts.length) return {x:rawX, y:rawY}
    const last=pts[pts.length-1]
    return Math.abs(rawX-last.x)>=Math.abs(rawY-last.y)
      ? {x:rawX, y:last.y}   // 수평
      : {x:last.x, y:rawY}   // 수직
  }

  function getPolyBounds(verts) {
    const xs=verts.map(v=>v.x), ys=verts.map(v=>v.y)
    const x=Math.min(...xs), y=Math.min(...ys)
    return {x, y, w:Math.max(...xs)-x, h:Math.max(...ys)-y}
  }

  // 점 → 선분 위의 최근접점 및 거리
  function closestPtOnSeg(px,py,ax,ay,bx,by) {
    const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy
    if (len2===0) return {x:ax,y:ay,t:0,dist:Math.hypot(px-ax,py-ay)}
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2))
    const cx=ax+t*dx,cy=ay+t*dy
    return {x:cx,y:cy,t,dist:Math.hypot(px-cx,py-cy)}
  }

  // 존 기준 클램핑: polygon 존이면 polygon 경계 안으로, 아니면 AABB
  function clampToZonePoly(z, px, py) {
    if (z.shape==='polygon' && z.vertices?.length>=3) {
      if (ptInPoly(z.vertices,px,py)) return {x:px,y:py}
      let best={x:px,y:py,dist:Infinity}
      const vts=z.vertices
      for (let i=0;i<vts.length;i++) {
        const a=vts[i],b=vts[(i+1)%vts.length]
        const r=closestPtOnSeg(px,py,a.x,a.y,b.x,b.y)
        if (r.dist<best.dist) best={x:r.x,y:r.y,dist:r.dist}
      }
      return {x:best.x,y:best.y}
    }
    return {x:Math.max(z.x,Math.min(z.x+z.w,px)), y:Math.max(z.y,Math.min(z.y+z.h,py))}
  }

  // 두 선분 교차 여부
  function segsIntersect(ax,ay,bx,by,cx,cy,dx,dy) {
    const d1x=bx-ax,d1y=by-ay,d2x=dx-cx,d2y=dy-cy
    const denom=d1x*d2y-d1y*d2x
    if (Math.abs(denom)<1e-10) return false
    const t=((cx-ax)*d2y-(cy-ay)*d2x)/denom
    const u=((cx-ax)*d1y-(cy-ay)*d1x)/denom
    return t>=0&&t<=1&&u>=0&&u<=1
  }

  // 두 다각형 겹침 여부 (꼭짓점 포함 + 엣지 교차)
  function polysOverlap(a, b) {
    // 1. AABB 빠른 거부
    const ax1=Math.min(...a.map(v=>v.x)),ax2=Math.max(...a.map(v=>v.x))
    const ay1=Math.min(...a.map(v=>v.y)),ay2=Math.max(...a.map(v=>v.y))
    const bx1=Math.min(...b.map(v=>v.x)),bx2=Math.max(...b.map(v=>v.x))
    const by1=Math.min(...b.map(v=>v.y)),by2=Math.max(...b.map(v=>v.y))
    if (ax2<=bx1||ax1>=bx2||ay2<=by1||ay1>=by2) return false
    // 2. 꼭짓점 포함 여부
    if (a.some(v=>ptInPoly(b,v.x,v.y))) return true
    if (b.some(v=>ptInPoly(a,v.x,v.y))) return true
    // 3. 엣지 교차 여부
    for (let i=0;i<a.length;i++) {
      const a1=a[i],a2=a[(i+1)%a.length]
      for (let j=0;j<b.length;j++) {
        const b1=b[j],b2=b[(j+1)%b.length]
        if (segsIntersect(a1.x,a1.y,a2.x,a2.y,b1.x,b1.y,b2.x,b2.y)) return true
      }
    }
    return false
  }

  // 다각형 vs 사각형 겹침
  function polyRectOverlap(poly, rx,ry,rw,rh) {
    const rect=[{x:rx,y:ry},{x:rx+rw,y:ry},{x:rx+rw,y:ry+rh},{x:rx,y:ry+rh}]
    return polysOverlap(poly, rect)
  }

  function drawZoneShape(ctx, z, fillStyle, strokeStyle, lineWidth, alpha=1) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    if (z.shape === 'ellipse') {
      ctx.ellipse(z.x + z.w/2, z.y + z.h/2, z.w/2, z.h/2, 0, 0, Math.PI*2)
    } else if (z.shape === 'L') {
      const pts = getLPoly(z)
      pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y))
      ctx.closePath()
    } else if (z.shape === 'polygon' && z.vertices?.length >= 3) {
      z.vertices.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y))
      ctx.closePath()
    } else {
      ctx.rect(z.x, z.y, z.w, z.h)
    }
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill() }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.stroke() }
    ctx.restore()
  }

  function ptInZone(z, px, py) {
    if (z.shape === 'ellipse') {
      const dx = (px - (z.x + z.w/2)) / (z.w/2)
      const dy = (py - (z.y + z.h/2)) / (z.h/2)
      return dx*dx + dy*dy <= 1
    }
    if (z.shape === 'L') return ptInPoly(getLPoly(z), px, py)
    if (z.shape === 'polygon') return z.vertices?.length>=3 ? ptInPoly(z.vertices,px,py) : false
    return px >= z.x && px <= z.x+z.w && py >= z.y && py <= z.y+z.h
  }

  // ═══════════════════════════════════════════════
  // Build 캔버스 그리기
  // ═══════════════════════════════════════════════

  const drawBuild = useCallback(()=>{
    const canvas=bCRef.current; if (!canvas) return
    const DPR=window.devicePixelRatio||1
    const sz=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const dynCH=Math.max(160,Math.min(600,Math.round(CW*sz.h/sz.w)))
    dynCHRef.current=dynCH
    const cssW=fitCanvasWidth(canvas,dynCH)
    const cssH=Math.round(cssW*sz.h/sz.w)
    canvas.width=Math.round(cssW*DPR); canvas.height=Math.round(cssH*DPR)
    canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'
    const ctx=canvas.getContext('2d')
    const scale=cssW/CW*DPR
    ctx.scale(scale,scale)
    ctx.clearRect(0,0,CW,dynCH)
    // CSS border-radius(10px)에 맞춰 캔버스 콘텐츠를 클리핑
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad,pad,CW-pad*2,dynCH-pad*2,clipR); ctx.clip()

    // ── 1m 그리드 ──
    ;(()=>{
      const mPx=CW/sz.w  // 1m = mPx 논리픽셀
      ctx.save()
      ctx.strokeStyle='rgba(0,0,0,0.07)'
      ctx.lineWidth=0.3
      for (let i=0;i<=sz.w;i++) {
        const x=Math.round(i*mPx*10)/10
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,dynCH); ctx.stroke()
      }
      for (let j=0;j<=sz.h;j++) {
        const y=Math.round(j*mPx*10)/10
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke()
      }
      // 5m 마다 조금 더 진하게
      ctx.strokeStyle='rgba(0,0,0,0.13)'
      ctx.lineWidth=0.4
      for (let i=0;i<=sz.w;i+=5) {
        const x=Math.round(i*mPx*10)/10
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,dynCH); ctx.stroke()
      }
      for (let j=0;j<=sz.h;j+=5) {
        const y=Math.round(j*mPx*10)/10
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke()
      }
      // 눈금 라벨 (좌측·상단)
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.font='3.5px sans-serif'
      ctx.textAlign='left'; ctx.textBaseline='top'
      for (let i=1;i<sz.w;i++) {
        if (i%5===0) continue
        ctx.fillText(`${i}`, i*mPx+1, pad+1)
      }
      for (let i=5;i<sz.w;i+=5) ctx.fillText(`${i}m`, i*mPx+1, pad+1)
      ctx.textAlign='left'; ctx.textBaseline='top'
      for (let j=1;j<sz.h;j++) {
        if (j%5===0) continue
        ctx.fillText(`${j}`, pad+1, j*mPx+1)
      }
      for (let j=5;j<sz.h;j+=5) ctx.fillText(`${j}m`, pad+1, j*mPx+1)
      ctx.restore()
    })()

    const zs=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const selId=selRef.current

    const scaleX=CW/(sz.w*100)*0.5, scaleY=dynCH/(sz.h*100)*0.5

    const sortedZs=zs.slice().sort((a,b)=>(a.order??0)-(b.order??0))
    const entryZId=sortedZs[0]?.id
    // 드래그 중 겹침 감지
    const dragZ=zoneDragRef.current?.zone
    const dragOverlap=dragZ?zs.some(z=>z.id!==dragZ.id&&
      !(dragZ.x+dragZ.w<=z.x||dragZ.x>=z.x+z.w||dragZ.y+dragZ.h<=z.y||dragZ.y>=z.y+z.h)):false
    sortedZs.forEach((z,zi)=>{
      const isSel=selId===z.id, hasMed=z.media.length>0
      const isEntry=false // 하드코딩 ENTRY 배지 제거 — 이제 per-zone entryPos 사용
      const isDragging=dragZ&&z.id===dragZ.id
      const isConflict=isDragging&&dragOverlap
      drawZoneShape(ctx, z, '#F7F9F8', isConflict?'#DC2626':isSel?'#5A8FA8':'rgba(0,0,0,0.15)', isConflict?0.8:isSel?0.7:0.4)
      const orderNum=zi+1
      ctx.fillStyle=isSel?'#0C447C':'rgba(0,0,0,0.5)'
      ctx.font='500 5px sans-serif'; ctx.textAlign='center'
      ctx.fillText(`${orderNum}. ${z.name}`,z.x+z.w/2,z.y+10)
      if (isEntry) {
        ctx.font='bold 4px sans-serif'
        const label=circularFlowRef.current?'ENTRY/EXIT':'ENTRY'
        const bw=label==='ENTRY/EXIT'?26:16, bh=6, bx=z.x+4, by=z.y+4
        ctx.fillStyle='rgba(34,197,94,0.15)'; ctx.fillRect(bx,by,bw,bh)
        ctx.fillStyle='#15803D'; ctx.fillText(label,bx+bw/2,by+4.5)
      }
      if (!hasMed) {
        ctx.font='5px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.2)'
        ctx.fillText('Drag to add',z.x+z.w/2,z.y+z.h/2+2)
      } else {
        ctx.font='5px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.28)'
        ctx.fillText(`${zCap(z)}인·${zDwell(z)}초`,z.x+z.w/2,z.y+z.h-8)
      }
      ctx.textAlign='left'
    })

    // ── 존별 ENTRY/EXIT 레이블 그리기 ──
    const isCircular=circularFlowRef.current
    const sortedForDoor=zs.slice().sort((a,b)=>(a.order??0)-(b.order??0))
    const firstZoneId=sortedForDoor[0]?.id
    zs.forEach(z=>{
      const selDoor=doorDragRef.current
      const isFirst=isCircular&&z.id===firstZoneId
      if (isFirst) {
        // 순환형 첫 번째 존: entryPos → ENTRY/EXIT, returnPos → ENTRY, exitPos → EXIT
        if (z.entryPos) {
          const isSel=selDoor&&selDoor.zoneId===z.id&&selDoor.type==='entry'
          drawCircularDoorIcon(ctx,z.entryPos,isSel)
        }
        if (z.returnPos) {
          const isSel=selDoor&&selDoor.zoneId===z.id&&selDoor.type==='return'
          drawDoorIcon(ctx,z.returnPos,'entry',isSel)
        }
        if (z.exitPos) {
          const isSel=selDoor&&selDoor.zoneId===z.id&&selDoor.type==='exit'
          drawDoorIcon(ctx,z.exitPos,'exit',isSel)
        }
      } else {
        // 일반 존: entryPos → ENTRY, exitPos → EXIT
        if (z.entryPos) {
          const isSel=selDoor&&selDoor.zoneId===z.id&&selDoor.type==='entry'
          drawDoorIcon(ctx,z.entryPos,'entry',isSel)
        }
        if (z.exitPos) {
          const isSel=selDoor&&selDoor.zoneId===z.id&&selDoor.type==='exit'
          drawDoorIcon(ctx,z.exitPos,'exit',isSel)
        }
      }
    })

    if (selId!==null) {
      const sz=zs.find(z=>z.id===selId)
      if (sz) {
        if (sz.shape === 'polygon' && sz.vertices) {
          sz.vertices.forEach(v=>{
            ctx.beginPath(); ctx.arc(v.x,v.y,1.5,0,Math.PI*2)
            ctx.fillStyle='#fff'; ctx.fill()
            ctx.strokeStyle='#E07040'; ctx.lineWidth=0.5; ctx.stroke()
          })
        } else {
          const hpts=[{x:sz.x,y:sz.y},{x:sz.x+sz.w,y:sz.y},{x:sz.x+sz.w,y:sz.y+sz.h},{x:sz.x,y:sz.y+sz.h}]
          hpts.forEach(h=>{
            ctx.beginPath(); ctx.arc(h.x,h.y,1.5,0,Math.PI*2)
            ctx.fillStyle='#fff'; ctx.fill()
            ctx.strokeStyle='#5A8FA8'; ctx.lineWidth=0.5; ctx.stroke()
          })
          if (sz.shape === 'L') {
            const ch = getLCutHandle(sz)
            ctx.beginPath(); ctx.arc(ch.x, ch.y, 1.5, 0, Math.PI*2)
            ctx.fillStyle='#fff'; ctx.fill()
            ctx.strokeStyle='#E07040'; ctx.lineWidth=0.5; ctx.stroke()
          }
        }
      }
    }

    zs.forEach(z=>z.media.forEach(m=>{
      if (cvDrag.current&&cvDrag.current.m.uid===m.uid) return
      const lvl=m.engagementLevel||3
      // ── 다각형 형태 미디어 ──
      if (m.polyVerts?.length>=3) {
        const isEditing = mediaPolyEditRef.current===m.uid
        const cx2=m.polyVerts.reduce((s,v)=>s+v.x,0)/m.polyVerts.length
        const cy2=m.polyVerts.reduce((s,v)=>s+v.y,0)/m.polyVerts.length
        ctx.save()
        if (m.circleShape) {
          // 원형: arc로 부드럽게
          const r2=Math.hypot(m.polyVerts[0].x-cx2, m.polyVerts[0].y-cy2)
          ctx.beginPath(); ctx.arc(cx2,cy2,r2,0,Math.PI*2)
          ctx.fillStyle=m.bg+'55'; ctx.fill()
          ctx.strokeStyle=isEditing?m.color:m.color+'99'; ctx.lineWidth=isEditing?1:0.8; ctx.stroke()
          if (isEditing) {
            // 4방향 핸들만 (E=0, S=6, W=12, N=18 for N=24)
            const N=m.polyVerts.length, step=N/4
            for (let i=0;i<4;i++) {
              const v=m.polyVerts[i*step]
              ctx.beginPath(); ctx.arc(v.x,v.y,1.5,0,Math.PI*2)
              ctx.fillStyle='#fff'; ctx.fill()
              ctx.strokeStyle=m.color; ctx.lineWidth=0.5; ctx.stroke()
            }
          }
        } else {
          ctx.beginPath()
          ctx.moveTo(m.polyVerts[0].x, m.polyVerts[0].y)
          m.polyVerts.forEach((v,i)=>{ if(i>0) ctx.lineTo(v.x, v.y) })
          ctx.closePath()
          ctx.fillStyle=m.bg+'55'; ctx.fill()
          ctx.strokeStyle=isEditing?m.color:m.color+'99'; ctx.lineWidth=isEditing?1:0.8; ctx.stroke()
          if (isEditing) {
            m.polyVerts.forEach(v=>{
              ctx.beginPath(); ctx.arc(v.x,v.y,1.5,0,Math.PI*2)
              ctx.fillStyle='#fff'; ctx.fill()
              ctx.strokeStyle=m.color; ctx.lineWidth=0.5; ctx.stroke()
            })
          }
        }
        drawMIcon(ctx,m,cx2-MS/2,cy2-MS/2,drawBuild,MS,MS)
        const maxY=Math.max(...m.polyVerts.map(v=>v.y))
        ctx.font='bold 3.5px sans-serif'; ctx.textAlign='center'
        ctx.fillStyle='#534AB7'
        ctx.fillText('E'+lvl, cx2, maxY+5)
        ctx.textAlign='left'
        ctx.restore()
        return
      }
      if (m.px==null) return
      const fpW=Math.max(MS,(m.widthCm||100)*scaleX)
      const fpH=Math.max(MS,(m.heightCm||100)*scaleY)
      // 존 경계 클램프 (물리적으로 벽을 넘을 수 없음)
      const clampedW=Math.min(fpW, z.x+z.w-m.px)
      const clampedH=Math.min(fpH, z.y+z.h-m.py)
      drawMIcon(ctx,m,m.px,m.py,drawBuild,clampedW,clampedH)
      ctx.font='bold 3.5px sans-serif'; ctx.textAlign='center'
      ctx.fillStyle='#534AB7'
      ctx.fillText('E'+lvl, m.px+MS/2, m.py+MS+4)
      ctx.textAlign='left'
    }))

    if (cvDrag.current) {
      const tz=zoneAt(zs,mxRef.current,myRef.current)
      if (tz&&tz.id!==cvDrag.current.z.id) {
        ctx.save()
        ctx.beginPath()
        if (tz.shape === 'ellipse') {
          ctx.ellipse(tz.x+tz.w/2, tz.y+tz.h/2, tz.w/2, tz.h/2, 0, 0, Math.PI*2)
        } else {
          ctx.rect(tz.x,tz.y,tz.w,tz.h)
        }
        ctx.strokeStyle='#378ADD'; ctx.lineWidth=0.8
        ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([])
        ctx.restore()
      }
      ctx.globalAlpha=0.55
      const dm=cvDrag.current.m
      if (dm.polyVerts?.length>=3) {
        // 다각형 미디어 드래그 프리뷰
        const cx2=dm.polyVerts.reduce((s,v)=>s+v.x,0)/dm.polyVerts.length
        const cy2=dm.polyVerts.reduce((s,v)=>s+v.y,0)/dm.polyVerts.length
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(dm.polyVerts[0].x, dm.polyVerts[0].y)
        dm.polyVerts.forEach((v,i)=>{ if(i>0) ctx.lineTo(v.x, v.y) })
        ctx.closePath()
        ctx.fillStyle=dm.bg+'55'; ctx.fill()
        ctx.strokeStyle=dm.color+'cc'; ctx.lineWidth=0.8; ctx.stroke()
        drawMIcon(ctx,dm,cx2-MS/2,cy2-MS/2,drawBuild,MS,MS)
        ctx.restore()
      } else if (dm.px!=null) {
        const dfpW=Math.max(MS,(dm.widthCm||100)*scaleX)
        const dfpH=Math.max(MS,(dm.heightCm||100)*scaleY)
        drawMIcon(ctx,dm,dm.px,dm.py,drawBuild,dfpW,dfpH)
      }
      ctx.globalAlpha=1
    }
    // ── 폴리곤 그리기 미리보기 ──
    if (polyDrawRef.current.active) {
      const pts=polyDrawRef.current.pts
      const rawMx=mxRef.current, rawMy=myRef.current
      const {x:mx,y:my}=shiftRef.current?shiftSnap(pts,rawMx,rawMy):{x:rawMx,y:rawMy}
      ctx.save()
      if (pts.length > 0) {
        ctx.strokeStyle='#5A8FA8'; ctx.lineWidth=0.9
        ctx.setLineDash([4,3])
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p,i)=>{ if(i>0) ctx.lineTo(p.x,p.y) })
        ctx.lineTo(mx, my)
        ctx.stroke()
        ctx.setLineDash([])
        pts.forEach((p,i)=>{
          ctx.beginPath(); ctx.arc(p.x,p.y,i===0?2.5:2,0,Math.PI*2)
          ctx.fillStyle=i===0?'#00c896':'#5A8FA8'; ctx.fill()
          if (i===0 && pts.length>=3) {
            ctx.strokeStyle='rgba(0,200,150,0.5)'; ctx.lineWidth=0.5
            ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.stroke()
          }
        })
      } else {
        // 시작 안내: crosshair
        ctx.strokeStyle='rgba(90,143,168,0.5)'; ctx.lineWidth=0.7
        ctx.beginPath(); ctx.moveTo(mx-8,my); ctx.lineTo(mx+8,my); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(mx,my-8); ctx.lineTo(mx,my+8); ctx.stroke()
      }
      ctx.restore()
    }
    // ── 미디어 다각형 그리기 미리보기 ──
    if (mediaPolyDrawRef.current.active) {
      const pts=mediaPolyDrawRef.current.pts
      const rawMx=mxRef.current, rawMy=myRef.current
      const {x:mx,y:my}=shiftRef.current?shiftSnap(pts,rawMx,rawMy):{x:rawMx,y:rawMy}
      ctx.save()
      ctx.strokeStyle='#534AB7'; ctx.lineWidth=0.9
      ctx.setLineDash([3,2])
      ctx.beginPath()
      if (pts.length>0) {
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p,i)=>{ if(i>0) ctx.lineTo(p.x, p.y) })
      }
      ctx.lineTo(mx, my)
      ctx.stroke(); ctx.setLineDash([])
      if (pts.length>=3) {
        ctx.fillStyle='rgba(83,74,183,0.06)'
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p,i)=>{ if(i>0) ctx.lineTo(p.x, p.y) })
        ctx.closePath(); ctx.fill()
      }
      pts.forEach((p,i)=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,i===0?2.5:2,0,Math.PI*2)
        ctx.fillStyle=i===0?'#534AB7':'rgba(83,74,183,0.6)'; ctx.fill()
        if (i===0&&pts.length>=3) {
          ctx.strokeStyle='rgba(83,74,183,0.4)'; ctx.lineWidth=0.5
          ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.stroke()
        }
      })
      ctx.restore()
    }
    // ── Footprint scale 레이블 (좌하단) ──
    ;(()=>{
      const sqm=sz.w*sz.h; const py=(sqm*0.3025).toFixed(1)
      const lbl=`□  Footprint scale: Area ${viewFloorRef.current+1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font='4px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.28)'
      ctx.textAlign='left'; ctx.textBaseline='bottom'
      ctx.fillText(lbl, 4, dynCH-4)
      ctx.restore()
    })()
    applyVT(canvas)
  }, [applyVT])

  // ═══════════════════════════════════════════════
  // Build 캔버스 이벤트
  // ═══════════════════════════════════════════════

  const onBMD = useCallback(e=>{
    if (e.button!==0) return
    const {x,y}=sc2(bCRef.current,e)
    if (panModeRef.current) {
      panDragRef.current={sx:e.clientX,sy:e.clientY,ox:vtRef.current.x,oy:vtRef.current.y}
      document.body.style.cursor='grabbing'
      ;[bCRef, sCRef, hCRef].forEach(r=>{ if(r.current) r.current.style.cursor='grabbing' })
      e.preventDefault(); return
    }
    // ── 폴리곤 그리기 모드 ──
    if (polyDrawRef.current.active) {
      const pts=polyDrawRef.current.pts
      const {x:sx,y:sy}=e.shiftKey?shiftSnap(pts,x,y):{x,y}
      if (pts.length>=3 && Math.abs(sx-pts[0].x)<=8 && Math.abs(sy-pts[0].y)<=8) {
        commitPolygon(pts)
      } else {
        pts.push({x:sx,y:sy})
        drawBuild()
      }
      e.preventDefault(); return
    }
    // ── 미디어 다각형 그리기 모드 ──
    if (mediaPolyDrawRef.current.active) {
      const pts=mediaPolyDrawRef.current.pts
      // Shift 스냅 먼저 적용
      const {x:rx,y:ry}=e.shiftKey?shiftSnap(pts,x,y):{x,y}
      // 속한 존 찾아서 클램핑
      const muid=mediaPolyDrawRef.current.uid
      const flZonesDraw=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
      let drawZone=null
      for (const z of flZonesDraw) { if (z.media.some(m=>m.uid===muid)) { drawZone=z; break } }
      const {x:cx2,y:cy2}=drawZone?clampToZonePoly(drawZone,rx,ry):{x:rx,y:ry}
      if (pts.length>=3&&Math.abs(cx2-pts[0].x)<=8&&Math.abs(cy2-pts[0].y)<=8) {
        commitMediaPoly(pts)
      } else {
        pts.push({x:cx2, y:cy2})
        drawBuild()
      }
      e.preventDefault(); return
    }
    // 존별 ENTRY/EXIT 히트 감지
    const DOOR_R=7
    const flZones2=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const sortedForDoorDrag=flZones2.slice().sort((a,b)=>(a.order??0)-(b.order??0))
    const firstZoneIdDrag=sortedForDoorDrag[0]?.id
    for (const z of flZones2) {
      if (z.entryPos && Math.abs(x-z.entryPos.x)<=DOOR_R && Math.abs(y-z.entryPos.y)<=DOOR_R) {
        snapshotUndoRef.current()
        doorDragRef.current={type:'entry',zoneId:z.id,sx:x,sy:y,ox:z.entryPos.x,oy:z.entryPos.y}
        bCRef.current.style.cursor='grabbing'
        didDrag.current=false; e.preventDefault(); return
      }
      if (circularFlowRef.current && z.id===firstZoneIdDrag && z.returnPos && Math.abs(x-z.returnPos.x)<=DOOR_R && Math.abs(y-z.returnPos.y)<=DOOR_R) {
        snapshotUndoRef.current()
        doorDragRef.current={type:'return',zoneId:z.id,sx:x,sy:y,ox:z.returnPos.x,oy:z.returnPos.y}
        bCRef.current.style.cursor='grabbing'
        didDrag.current=false; e.preventDefault(); return
      }
      if (z.exitPos && Math.abs(x-z.exitPos.x)<=DOOR_R && Math.abs(y-z.exitPos.y)<=DOOR_R) {
        snapshotUndoRef.current()
        doorDragRef.current={type:'exit',zoneId:z.id,sx:x,sy:y,ox:z.exitPos.x,oy:z.exitPos.y}
        bCRef.current.style.cursor='grabbing'
        didDrag.current=false; e.preventDefault(); return
      }
    }
    const flZones=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const _sz1=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const _dynCH1=Math.max(160,Math.min(600,Math.round(CW*_sz1.h/_sz1.w)))
    const _sX1=CW/(_sz1.w*100)*0.5, _sY1=_dynCH1/(_sz1.h*100)*0.5
    const h=mediaAt(flZones,x,y,_sX1,_sY1)
    if (h) {
      snapshotUndoRef.current()
      // mousedown 시점에 즉시 존 선택 + 미디어 활성화 → 패널이 바로 반응
      selRef.current=h.z.id; setSelZoneId(h.z.id); setEditingZoneName(false)
      setActiveMediaUid(h.m.uid)
      if (h.m.polyVerts?.length>=3) {
        cvDrag.current={z:h.z,m:h.m,polyOrigVerts:h.m.polyVerts.map(v=>({...v})),dragStartX:x,dragStartY:y}
      } else {
        cvDrag.current={z:h.z,m:h.m}
        cvOff.current={x:x-h.m.px,y:y-h.m.py}
      }
      bCRef.current.style.cursor='grabbing'
      didDrag.current=false; e.preventDefault(); drawBuild(); return
    }
    const selZ=selRef.current!=null?zonesRef.current.find(z=>z.id===selRef.current):null
    if (selZ) {
      if (selZ.shape !== 'polygon') {
        const corners=[{k:'nw',cx:selZ.x,cy:selZ.y},{k:'ne',cx:selZ.x+selZ.w,cy:selZ.y},{k:'se',cx:selZ.x+selZ.w,cy:selZ.y+selZ.h},{k:'sw',cx:selZ.x,cy:selZ.y+selZ.h}]
        const hit=corners.find(c=>Math.abs(x-c.cx)<=8&&Math.abs(y-c.cy)<=8)
        if (hit) {
          snapshotUndoRef.current()
          zoneDragRef.current={type:'resize',key:hit.k,zone:selZ,sx:x,sy:y,ox:selZ.x,oy:selZ.y,ow:selZ.w,oh:selZ.h}
          didDrag.current=false; e.preventDefault(); return
        }
      }
      if (selZ.shape === 'L') {
        const ch = getLCutHandle(selZ)
        if (Math.abs(x-ch.x)<=8 && Math.abs(y-ch.y)<=8) {
          snapshotUndoRef.current()
          zoneDragRef.current={
            type:'L-cut', zone:selZ, sx:x, sy:y,
            ocutW: selZ.cutW ?? selZ.w*0.4,
            ocutH: selZ.cutH ?? selZ.h*0.4,
          }
          didDrag.current=false; e.preventDefault(); return
        }
      }
      if (selZ.shape === 'polygon' && selZ.vertices) {
        // 1순위: 기존 꼭짓점 드래그
        for (let vi=0; vi<selZ.vertices.length; vi++) {
          const v=selZ.vertices[vi]
          if (Math.abs(x-v.x)<=7 && Math.abs(y-v.y)<=7) {
            snapshotUndoRef.current()
            vertexDragRef.current={zoneId:selZ.id, idx:vi, sx:x, sy:y, ox:v.x, oy:v.y}
            didDrag.current=false; e.preventDefault(); return
          }
        }
        // 2순위: 변 위 클릭 → 꼭짓점 삽입
        const vts=selZ.vertices
        let bestEdge={dist:Infinity,idx:-1,pt:null}
        for (let vi=0;vi<vts.length;vi++) {
          const a=vts[vi], b=vts[(vi+1)%vts.length]
          const res=closestPtOnSeg(x,y,a.x,a.y,b.x,b.y)
          if (res.dist<bestEdge.dist) bestEdge={dist:res.dist,idx:vi,pt:res}
        }
        if (bestEdge.dist<=6) {
          snapshotUndoRef.current()
          selZ.vertices.splice(bestEdge.idx+1,0,{x:bestEdge.pt.x,y:bestEdge.pt.y})
          const b=getPolyBounds(selZ.vertices)
          selZ.x=b.x;selZ.y=b.y;selZ.w=b.w;selZ.h=b.h
          // 삽입된 꼭짓점 즉시 드래그 시작
          vertexDragRef.current={zoneId:selZ.id,idx:bestEdge.idx+1,sx:x,sy:y,ox:bestEdge.pt.x,oy:bestEdge.pt.y}
          didDrag.current=false
          setZones(clone(zonesRef.current)); drawBuild()
          e.preventDefault(); return
        }
      }
    }
    // ── 다각형 미디어 꼭짓점 드래그 감지 (편집 모드일 때만) ──
    if (!polyDrawRef.current.active && !mediaPolyDrawRef.current.active && mediaPolyEditRef.current) {
      const editUid=mediaPolyEditRef.current
      for (const zone of zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)) {
        const m=zone.media.find(m=>m.uid===editUid)
        if (m&&m.polyVerts) {
          // 원형은 4방향 핸들만 감지
          const idxList=m.circleShape
            ? [0, m.polyVerts.length/4, m.polyVerts.length/2, m.polyVerts.length*3/4].map(Math.round)
            : m.polyVerts.map((_,i)=>i)
          for (const vi of idxList) {
            const v=m.polyVerts[vi]
            if (Math.abs(x-v.x)<=7&&Math.abs(y-v.y)<=7) {
              snapshotUndoRef.current()
              mediaPolyVtxDragRef.current={uid:m.uid,idx:vi,sx:x,sy:y,ox:v.x,oy:v.y,zone}
              didDrag.current=false; e.preventDefault(); return
            }
          }
          break
        }
      }
    }
    const clickedZone=zoneAt(flZones,x,y)
    if (clickedZone) {
      snapshotUndoRef.current()
      selRef.current=clickedZone.id; setSelZoneId(clickedZone.id); setEditingZoneName(false)
      zoneDragRef.current={
        type:'move',zone:clickedZone,sx:x,sy:y,ox:clickedZone.x,oy:clickedZone.y,
        mediaOffsets:clickedZone.media.filter(m=>m.px!=null||m.polyVerts).map(m=>({uid:m.uid,px:m.px,py:m.py,polyVerts:m.polyVerts?m.polyVerts.map(v=>({...v})):null})),
        entryOrig:clickedZone.entryPos?{...clickedZone.entryPos}:null,
        returnOrig:clickedZone.returnPos?{...clickedZone.returnPos}:null,
        exitOrig:clickedZone.exitPos?{...clickedZone.exitPos}:null,
        origVertices:clickedZone.shape==='polygon'&&clickedZone.vertices?clickedZone.vertices.map(v=>({...v})):null,
      }
      bCRef.current.style.cursor='grabbing'
      didDrag.current=false; e.preventDefault(); drawBuild(); return
    }
    selRef.current=null; setSelZoneId(null); setEditingZoneName(false); drawBuild()
  },[drawBuild])

  const onBMM = useCallback(e=>{
    const {x,y}=sc2(bCRef.current,e)
    mxRef.current=x; myRef.current=y
    shiftRef.current=e.shiftKey
    if (panDragRef.current) {
      vtRef.current.x=panDragRef.current.ox+(e.clientX-panDragRef.current.sx)
      vtRef.current.y=panDragRef.current.oy+(e.clientY-panDragRef.current.sy)
      ;[bCRef, sCRef, hCRef].forEach(r=>applyVT(r.current)); return
    }
    if (panModeRef.current) { bCRef.current.style.cursor='grab'; return }
    if (polyDrawRef.current.active) { bCRef.current.style.cursor='crosshair'; drawBuild(); return }
    if (mediaPolyDrawRef.current.active) { bCRef.current.style.cursor='crosshair'; drawBuild(); return }
    if (mediaPolyVtxDragRef.current) {
      didDrag.current=true
      const d=mediaPolyVtxDragRef.current
      const zone=d.zone||zonesRef.current.find(z=>z.media.some(m=>m.uid===d.uid))
      if (zone) {
        const m=zone.media.find(m=>m.uid===d.uid)
        if (m&&m.polyVerts) {
          const {x:nx,y:ny}=clampToZonePoly(zone, d.ox+(x-d.sx), d.oy+(y-d.sy))
          let newVerts=m.polyVerts.map((v,i)=>i===d.idx?{x:nx,y:ny}:v)
          // ── 원형 모드: 드래그 핸들 → 반지름 재계산, 전체 꼭짓점 갱신 ──
          if (m.circleShape) {
            const N=m.polyVerts.length
            const ocx=m.polyVerts.reduce((s,v)=>s+v.x,0)/N
            const ocy=m.polyVerts.reduce((s,v)=>s+v.y,0)/N
            const nr=Math.max(6, Math.hypot(nx-ocx, ny-ocy))
            newVerts=Array.from({length:N},(_,i)=>({
              x:ocx+nr*Math.cos(2*Math.PI*i/N),
              y:ocy+nr*Math.sin(2*Math.PI*i/N)
            }))
          }
          // ── 사각형 모드: 드래그한 모서리의 대각선 고정, 나머지 두 꼭짓점 직각 유지 ──
          // 꼭짓점 순서: TL(0) TR(1) BR(2) BL(3)
          if (m.rectShape && newVerts.length===4) {
            const i=d.idx
            const MIN=8 // 최소 크기
            if (i===0) {       // TL ↔ fix BR(2)
              const fix=newVerts[2]
              const cx=Math.min(nx, fix.x-MIN), cy=Math.min(ny, fix.y-MIN)
              newVerts[0]={x:cx,y:cy}; newVerts[1]={x:fix.x,y:cy}; newVerts[3]={x:cx,y:fix.y}
            } else if (i===1) { // TR ↔ fix BL(3)
              const fix=newVerts[3]
              const cx=Math.max(nx, fix.x+MIN), cy=Math.min(ny, fix.y-MIN)
              newVerts[1]={x:cx,y:cy}; newVerts[0]={x:fix.x,y:cy}; newVerts[2]={x:cx,y:fix.y}
            } else if (i===2) { // BR ↔ fix TL(0)
              const fix=newVerts[0]
              const cx=Math.max(nx, fix.x+MIN), cy=Math.max(ny, fix.y+MIN)
              newVerts[2]={x:cx,y:cy}; newVerts[1]={x:cx,y:fix.y}; newVerts[3]={x:fix.x,y:cy}
            } else if (i===3) { // BL ↔ fix TR(1)
              const fix=newVerts[1]
              const cx=Math.min(nx, fix.x-MIN), cy=Math.max(ny, fix.y+MIN)
              newVerts[3]={x:cx,y:cy}; newVerts[0]={x:cx,y:fix.y}; newVerts[2]={x:fix.x,y:cy}
            }
          }
          const _szV=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
          const _dynV=Math.max(160,Math.min(600,Math.round(CW*_szV.h/_szV.w)))
          const _sXV=CW/(_szV.w*100)*0.5, _sYV=_dynV/(_szV.h*100)*0.5
          const overlaps=zone.media.some(om=>{
            if (om.uid===m.uid) return false
            if (om.polyVerts?.length>=3) return polysOverlap(newVerts, om.polyVerts)
            if (om.px==null) return false
            return polyRectOverlap(newVerts, om.px, om.py, Math.max(MS,(om.widthCm||100)*_sXV), Math.max(MS,(om.heightCm||100)*_sYV))
          })
          if (!overlaps) m.polyVerts=newVerts
        }
      }
      bCRef.current.style.cursor='grabbing'
      drawBuild(); return
    }
    if (vertexDragRef.current) {
      didDrag.current=true
      const d=vertexDragRef.current
      const zone=zonesRef.current.find(z=>z.id===d.zoneId)
      if (zone?.vertices) {
        zone.vertices[d.idx]={x:d.ox+(x-d.sx), y:d.oy+(y-d.sy)}
        const b=getPolyBounds(zone.vertices)
        zone.x=b.x; zone.y=b.y; zone.w=b.w; zone.h=b.h
      }
      bCRef.current.style.cursor='grabbing'
      drawBuild(); return
    }
    if (doorDragRef.current) {
      didDrag.current=true
      const d=doorDragRef.current
      const zone=zonesRef.current.find(z=>z.id===d.zoneId)
      if (zone) {
        const pad=8
        const nx=Math.max(zone.x+pad,Math.min(zone.x+zone.w-pad,d.ox+(x-d.sx)))
        const ny=Math.max(zone.y+pad,Math.min(zone.y+zone.h-pad,d.oy+(y-d.sy)))
        if (d.type==='entry') zone.entryPos={x:nx,y:ny}
        else if (d.type==='return') zone.returnPos={x:nx,y:ny}
        else zone.exitPos={x:nx,y:ny}
      }
      bCRef.current.style.cursor='grabbing'
      drawBuild(); return
    }
    if (cvDrag.current) {
      didDrag.current=true
      const cz=cvDrag.current.z
      const dm=cvDrag.current.m
      // ── 다각형 미디어 드래그 (존 경계 + 겹침 방지) ──
      if (dm.polyVerts && cvDrag.current.polyOrigVerts) {
        const rawDx=x-cvDrag.current.dragStartX, rawDy=y-cvDrag.current.dragStartY
        const ov=cvDrag.current.polyOrigVerts
        const minX=Math.min(...ov.map(v=>v.x)), maxX=Math.max(...ov.map(v=>v.x))
        const minY=Math.min(...ov.map(v=>v.y)), maxY=Math.max(...ov.map(v=>v.y))
        const clampedDx=Math.max(cz.x-minX, Math.min(cz.x+cz.w-maxX, rawDx))
        const clampedDy=Math.max(cz.y-minY, Math.min(cz.y+cz.h-maxY, rawDy))
        const newVerts=ov.map(v=>({x:v.x+clampedDx, y:v.y+clampedDy}))
        // polygon 존이면 모든 꼭짓점이 존 안에 있는지 추가 확인
        if (cz.shape==='polygon'&&cz.vertices?.length>=3) {
          if (!newVerts.every(v=>ptInPoly(cz.vertices,v.x,v.y))) {
            bCRef.current.style.cursor='grabbing'; drawBuild(); return
          }
        }
        const _szD2=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
        const _dynCHD2=Math.max(160,Math.min(600,Math.round(CW*_szD2.h/_szD2.w)))
        const _sXD2=CW/(_szD2.w*100)*0.5, _sYD2=_dynCHD2/(_szD2.h*100)*0.5
        const overlaps=cz.media.some(om=>{
          if (om.uid===dm.uid) return false
          if (om.polyVerts?.length>=3) return polysOverlap(newVerts, om.polyVerts)
          if (om.px==null) return false
          return polyRectOverlap(newVerts, om.px, om.py, Math.max(MS,(om.widthCm||100)*_sXD2), Math.max(MS,(om.heightCm||100)*_sYD2))
        })
        if (!overlaps) dm.polyVerts=newVerts
        bCRef.current.style.cursor='grabbing'
        drawBuild(); return
      }
      // ── 사각형 미디어 드래그 ──
      const _szD=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
      const _dynCHD=Math.max(160,Math.min(600,Math.round(CW*_szD.h/_szD.w)))
      const _sXD=CW/(_szD.w*100)*0.5, _sYD=_dynCHD/(_szD.h*100)*0.5
      const fpWD=Math.max(MS,(dm.widthCm||100)*_sXD)
      const fpHD=Math.max(MS,(dm.heightCm||100)*_sYD)
      const newPx=Math.max(cz.x, Math.min(cz.x+cz.w-fpWD, x-cvOff.current.x))
      const newPy=Math.max(cz.y, Math.min(cz.y+cz.h-fpHD, y-cvOff.current.y))
      // 다른 미디어와 겹침 방지
      const overlaps=cz.media.some(om=>{
        if (om.uid===dm.uid||om.px==null) return false
        const ofpW=Math.max(MS,(om.widthCm||100)*_sXD)
        const ofpH=Math.max(MS,(om.heightCm||100)*_sYD)
        return !(newPx+fpWD<=om.px||newPx>=om.px+ofpW||newPy+fpHD<=om.py||newPy>=om.py+ofpH)
      })
      if (!overlaps) { dm.px=newPx; dm.py=newPy }
      bCRef.current.style.cursor='grabbing'
      drawBuild(); return
    }
    if (zoneDragRef.current) {
      didDrag.current=true
      const d=zoneDragRef.current
      if (d.type === 'L-cut') {
        const dx = x - d.sx, dy = y - d.sy
        const corner = d.zone.cutCorner ?? 'NE'
        const MIN_CUT = 20
        let newCutW = d.ocutW, newCutH = d.ocutH
        switch(corner) {
          case 'NE': newCutW = Math.max(MIN_CUT, Math.min(d.zone.w-MIN_CUT, d.ocutW - dx)); newCutH = Math.max(MIN_CUT, Math.min(d.zone.h-MIN_CUT, d.ocutH + dy)); break
          case 'NW': newCutW = Math.max(MIN_CUT, Math.min(d.zone.w-MIN_CUT, d.ocutW + dx)); newCutH = Math.max(MIN_CUT, Math.min(d.zone.h-MIN_CUT, d.ocutH + dy)); break
          case 'SE': newCutW = Math.max(MIN_CUT, Math.min(d.zone.w-MIN_CUT, d.ocutW - dx)); newCutH = Math.max(MIN_CUT, Math.min(d.zone.h-MIN_CUT, d.ocutH - dy)); break
          case 'SW': newCutW = Math.max(MIN_CUT, Math.min(d.zone.w-MIN_CUT, d.ocutW + dx)); newCutH = Math.max(MIN_CUT, Math.min(d.zone.h-MIN_CUT, d.ocutH - dy)); break
        }
        d.zone.cutW = newCutW
        d.zone.cutH = newCutH
        drawBuild()
        return
      }
      const dx=x-d.sx, dy=y-d.sy
      const MIN=50
      const HP=7  // handle padding – keeps resize handles inside canvas bounds
      if (d.type==='move') {
        const nx=Math.max(HP,Math.min(CW-d.zone.w-HP,d.ox+dx))
        const ny=Math.max(HP,Math.min(dynCHRef.current-d.zone.h-HP,d.oy+dy))
        const newVerts=d.zone.shape==='polygon'&&d.origVertices
          ?d.origVertices.map(v=>({x:v.x+(nx-d.ox),y:v.y+(ny-d.oy)}))
          :null
        // 드래그 중엔 자유롭게 이동 (겹침 체크는 mouseup에서만)
        d.zone.x=nx; d.zone.y=ny
        if (newVerts) d.zone.vertices=newVerts
        if (d.mediaOffsets) {
          d.zone.media.forEach(m=>{
            const orig=d.mediaOffsets.find(mo=>mo.uid===m.uid)
            if (orig) {
              if (orig.polyVerts) m.polyVerts=orig.polyVerts.map(v=>({x:v.x+(nx-d.ox),y:v.y+(ny-d.oy)}))
              if (orig.px!=null) { m.px=orig.px+(nx-d.ox); m.py=orig.py+(ny-d.oy) }
            }
          })
        }
        // entry/exit도 존과 함께 이동
        if (d.entryOrig) d.zone.entryPos={x:d.entryOrig.x+(nx-d.ox), y:d.entryOrig.y+(ny-d.oy)}
        if (d.returnOrig) d.zone.returnPos={x:d.returnOrig.x+(nx-d.ox), y:d.returnOrig.y+(ny-d.oy)}
        if (d.exitOrig)  d.zone.exitPos ={x:d.exitOrig.x +(nx-d.ox), y:d.exitOrig.y +(ny-d.oy)}
      } else {
        switch(d.key) {
          case 'se': d.zone.w=Math.max(MIN,d.ow+dx); d.zone.h=Math.max(MIN,d.oh+dy); break
          case 'sw': d.zone.x=Math.min(d.ox+d.ow-MIN,d.ox+dx); d.zone.w=Math.max(MIN,d.ow-dx); d.zone.h=Math.max(MIN,d.oh+dy); break
          case 'ne': d.zone.w=Math.max(MIN,d.ow+dx); d.zone.y=Math.min(d.oy+d.oh-MIN,d.oy+dy); d.zone.h=Math.max(MIN,d.oh-dy); break
          case 'nw': d.zone.x=Math.min(d.ox+d.ow-MIN,d.ox+dx); d.zone.y=Math.min(d.oy+d.oh-MIN,d.oy+dy); d.zone.w=Math.max(MIN,d.ow-dx); d.zone.h=Math.max(MIN,d.oh-dy); break
        }
        // 리사이즈 후 핸들이 캔버스 밖으로 나가지 않도록 클램프
        const dCH=dynCHRef.current
        if (d.zone.x < HP) { d.zone.w=Math.max(MIN,d.zone.w-(HP-d.zone.x)); d.zone.x=HP }
        if (d.zone.y < HP) { d.zone.h=Math.max(MIN,d.zone.h-(HP-d.zone.y)); d.zone.y=HP }
        if (d.zone.x+d.zone.w > CW-HP) d.zone.w=Math.max(MIN,CW-HP-d.zone.x)
        if (d.zone.y+d.zone.h > dCH-HP) d.zone.h=Math.max(MIN,dCH-HP-d.zone.y)
        // 리사이즈 후 entry/exit가 존 밖으로 나가면 안쪽으로 클램프
        const pad=8
        if (d.zone.entryPos) {
          d.zone.entryPos={
            x:Math.max(d.zone.x+pad,Math.min(d.zone.x+d.zone.w-pad,d.zone.entryPos.x)),
            y:Math.max(d.zone.y+pad,Math.min(d.zone.y+d.zone.h-pad,d.zone.entryPos.y)),
          }
        }
        if (d.zone.returnPos) {
          d.zone.returnPos={
            x:Math.max(d.zone.x+pad,Math.min(d.zone.x+d.zone.w-pad,d.zone.returnPos.x)),
            y:Math.max(d.zone.y+pad,Math.min(d.zone.y+d.zone.h-pad,d.zone.returnPos.y)),
          }
        }
        if (d.zone.exitPos) {
          d.zone.exitPos={
            x:Math.max(d.zone.x+pad,Math.min(d.zone.x+d.zone.w-pad,d.zone.exitPos.x)),
            y:Math.max(d.zone.y+pad,Math.min(d.zone.y+d.zone.h-pad,d.zone.exitPos.y)),
          }
        }
      }
      layoutAll([d.zone])
      bCRef.current.style.cursor='grabbing'
      drawBuild(); return
    }
    const flZones=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const _sz2=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const _dynCH2=Math.max(160,Math.min(600,Math.round(CW*_sz2.h/_sz2.w)))
    const _sX2=CW/(_sz2.w*100)*0.5, _sY2=_dynCH2/(_sz2.h*100)*0.5
    if (mediaAt(flZones,x,y,_sX2,_sY2)) { bCRef.current.style.cursor='grab'; return }
    const selZ=selRef.current!=null?zonesRef.current.find(z=>z.id===selRef.current):null
    if (selZ) {
      // 다각형 미디어 꼭짓점 hover (편집 모드일 때만)
      if (mediaPolyEditRef.current) {
        for (const m of selZ.media) {
          if (m.uid===mediaPolyEditRef.current && m.polyVerts?.some(v=>Math.abs(x-v.x)<=7&&Math.abs(y-v.y)<=7)) { bCRef.current.style.cursor='crosshair'; return }
        }
      }
      if (selZ.shape === 'polygon' && selZ.vertices) {
        if (selZ.vertices.some(v=>Math.abs(x-v.x)<=7&&Math.abs(y-v.y)<=7)) { bCRef.current.style.cursor='crosshair'; return }
        // 변 위 hover → + 커서 (꼭짓점 추가 가능 힌트)
        const vts=selZ.vertices
        const onEdge=vts.some((_,vi)=>{
          const a=vts[vi],b=vts[(vi+1)%vts.length]
          return closestPtOnSeg(x,y,a.x,a.y,b.x,b.y).dist<=6
        })
        if (onEdge) { bCRef.current.style.cursor='cell'; return }
      } else {
        const corners=[{k:'nw',cx:selZ.x,cy:selZ.y},{k:'ne',cx:selZ.x+selZ.w,cy:selZ.y},{k:'se',cx:selZ.x+selZ.w,cy:selZ.y+selZ.h},{k:'sw',cx:selZ.x,cy:selZ.y+selZ.h}]
        if (corners.some(c=>Math.abs(x-c.cx)<=8&&Math.abs(y-c.cy)<=8)) { bCRef.current.style.cursor='crosshair'; return }
        if (selZ?.shape === 'L') {
          const ch = getLCutHandle(selZ)
          if (Math.abs(x-ch.x)<=8 && Math.abs(y-ch.y)<=8) { bCRef.current.style.cursor='crosshair'; return }
        }
      }
    }
    // cursor hint for zone door icons
    const flZ2=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const DOOR_R2=7
    if (flZ2.some(z=>
      (z.entryPos&&Math.abs(x-z.entryPos.x)<=DOOR_R2&&Math.abs(y-z.entryPos.y)<=DOOR_R2)||
      (z.returnPos&&Math.abs(x-z.returnPos.x)<=DOOR_R2&&Math.abs(y-z.returnPos.y)<=DOOR_R2)||
      (z.exitPos&&Math.abs(x-z.exitPos.x)<=DOOR_R2&&Math.abs(y-z.exitPos.y)<=DOOR_R2)
    )) { bCRef.current.style.cursor='grab'; return }
    bCRef.current.style.cursor=zoneAt(flZones,x,y)?'move':'default'
  },[drawBuild])

  const onBMU = useCallback(e=>{
    if (panDragRef.current) {
      panDragRef.current=null
      const cur=panModeRef.current?'grab':''
      ;[bCRef, sCRef, hCRef].forEach(r=>{ if(r.current) r.current.style.cursor=cur })
      return
    }
    if (vertexDragRef.current) {
      const vd=vertexDragRef.current
      vertexDragRef.current=null
      bCRef.current.style.cursor='default'
      // 꼭짓점 드래그 후 겹침 감지 → 겹치면 원래 위치 복귀
      const vZone=zonesRef.current.find(z=>z.id===vd.zoneId)
      if (vZone?.shape==='polygon'&&vZone.vertices) {
        function zoneVertsV(z) {
          if (z.shape==='polygon'&&z.vertices?.length>=3) return z.vertices
          if (z.shape==='L') return getLPoly(z)
          if (z.shape==='ellipse') {
            const N=12,cx=z.x+z.w/2,cy=z.y+z.h/2,rx=z.w/2,ry=z.h/2
            return Array.from({length:N},(_,i)=>({x:cx+rx*Math.cos(2*Math.PI*i/N),y:cy+ry*Math.sin(2*Math.PI*i/N)}))
          }
          return [{x:z.x,y:z.y},{x:z.x+z.w,y:z.y},{x:z.x+z.w,y:z.y+z.h},{x:z.x,y:z.y+z.h}]
        }
        const peers2=zonesRef.current.filter(z=>(z.floor||0)===(vZone.floor||0)&&z.id!==vZone.id)
        if (peers2.some(p=>polysOverlap(zoneVertsV(vZone),zoneVertsV(p)))) {
          vZone.vertices[vd.idx]={x:vd.ox,y:vd.oy}
          const b=getPolyBounds(vZone.vertices)
          vZone.x=b.x;vZone.y=b.y;vZone.w=b.w;vZone.h=b.h
        }
      }
      layoutAll(zonesRef.current)
      setZones(clone(zonesRef.current)); drawBuild(); return
    }
    if (mediaPolyVtxDragRef.current) {
      mediaPolyVtxDragRef.current=null
      bCRef.current.style.cursor='default'
      setZones(clone(zonesRef.current)); drawBuild(); return
    }
    if (doorDragRef.current) {
      doorDragRef.current=null
      bCRef.current.style.cursor='default'
      drawBuild(); return
    }
    if (zoneDragRef.current) {
      const d=zoneDragRef.current
      // 겹침 감지: 같은 층 다른 존과 겹치면 원위치 복귀
      const peers=zonesRef.current.filter(z=>(z.floor||0)===(d.zone.floor||0)&&z.id!==d.zone.id)
      // 존의 실제 폴리곤 꼭짓점 반환 (polygon/L/ellipse/rect 모두 처리)
      function zoneVerts(z) {
        if (z.shape==='polygon'&&z.vertices?.length>=3) return z.vertices
        if (z.shape==='L') return getLPoly(z)
        if (z.shape==='ellipse') {
          const N=12,cx=z.x+z.w/2,cy=z.y+z.h/2,rx=z.w/2,ry=z.h/2
          return Array.from({length:N},(_,i)=>({x:cx+rx*Math.cos(2*Math.PI*i/N),y:cy+ry*Math.sin(2*Math.PI*i/N)}))
        }
        return [{x:z.x,y:z.y},{x:z.x+z.w,y:z.y},{x:z.x+z.w,y:z.y+z.h},{x:z.x,y:z.y+z.h}]
      }
      const dzVerts=zoneVerts(d.zone)
      const overlaps=peers.some(p=>polysOverlap(dzVerts, zoneVerts(p)))
      if (overlaps) {
        d.zone.x=d.ox; d.zone.y=d.oy
        if (d.type==='resize') { d.zone.w=d.ow; d.zone.h=d.oh }
        // 다각형 꼭짓점 복원
        if (d.origVertices) d.zone.vertices=d.origVertices.map(v=>({...v}))
        if (d.type==='move') {
          if (d.mediaOffsets) {
            d.zone.media.forEach(m=>{
              const orig=d.mediaOffsets.find(mo=>mo.uid===m.uid)
              if (orig) {
                m.px=orig.px; m.py=orig.py
                if (orig.polyVerts) m.polyVerts=orig.polyVerts.map(v=>({...v}))
              }
            })
          }
          if (d.entryOrig) d.zone.entryPos={...d.entryOrig}
          else if (d.entryOrig===null) d.zone.entryPos=null
          if (d.returnOrig) d.zone.returnPos={...d.returnOrig}
          else if (d.returnOrig===null) d.zone.returnPos=null
          if (d.exitOrig) d.zone.exitPos={...d.exitOrig}
          else if (d.exitOrig===null) d.zone.exitPos=null
        }
      }
      zoneDragRef.current=null
      bCRef.current.style.cursor='default'
      layoutAll(zonesRef.current)
      setZones(clone(zonesRef.current)); drawBuild(); return
    }
    if (!cvDrag.current) return
    const {x,y}=sc2(bCRef.current,e)
    const dm=cvDrag.current.m
    const isPolyMedia=dm.polyVerts?.length>=3
    const tz=zoneAt(zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current),x,y)
    if (tz&&tz.id!==cvDrag.current.z.id) {
      // 다른 존으로 이동
      cvDrag.current.z.media=cvDrag.current.z.media.filter(m=>m.uid!==dm.uid)
      if (!isPolyMedia) { dm.px=null; dm.py=null }
      tz.media.push(dm)
      selRef.current=tz.id; setSelZoneId(tz.id); setEditingZoneName(false)
    } else if (!tz) {
      // 존 밖 — 다각형 미디어는 원래 존 유지, 사각형은 null 처리
      if (!isPolyMedia) { dm.px=null; dm.py=null }
    }
    cvDrag.current=null
    bCRef.current.style.cursor='default'
    layoutAll(zonesRef.current)
    setZones(clone(zonesRef.current))
    drawBuild()
  },[drawBuild])

  const onBCC = useCallback(e=>{
    if (didDrag.current) { didDrag.current=false; return }
    if (panModeRef.current) return
    const {x,y}=sc2(bCRef.current,e)
    const flZones=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const _sz3=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const _dynCH3=Math.max(160,Math.min(600,Math.round(CW*_sz3.h/_sz3.w)))
    const _sX3=CW/(_sz3.w*100)*0.5, _sY3=_dynCH3/(_sz3.h*100)*0.5
    const hit=mediaAt(flZones,x,y,_sX3,_sY3)
    if (hit) {
      // 미디어 클릭 → 해당 존 선택 + 미디어 활성화
      selRef.current=hit.z.id; setSelZoneId(hit.z.id); setEditingZoneName(false)
      setActiveMediaUid(hit.m.uid)
      drawBuild()
    } else {
      const z=zoneAt(flZones,x,y)
      const id=z?z.id:null
      selRef.current=id; setSelZoneId(id); setEditingZoneName(false)
      setActiveMediaUid(null)
      drawBuild()
    }
  },[drawBuild])

  const onBDbl = useCallback(e=>{
    const {x,y}=sc2(bCRef.current,e)
    for (const z of zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)) {
      if (x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+18) {
        const canvas=bCRef.current
        const scX=canvas.clientWidth/CW, scY=canvas.clientHeight/CH
        const ox=(z.x+z.w/2)*scX-60
        const oy=z.y*scY+1
        selRef.current=z.id; setSelZoneId(z.id)
        setEditZone({id:z.id, name:z.name, ox, oy})
        return
      }
    }
  },[])

  function saveZoneName() {
    if (!editZone) return
    const z=zonesRef.current.find(z=>z.id===editZone.id)
    if (z) z.name=editZone.name
    setZones(clone(zonesRef.current))
    setEditZone(null)
    drawBuild()
  }

  // 팔레트 → 캔버스 drop (native drag)
  useEffect(()=>{
    const canvas=bCRef.current; if (!canvas) return
    const onDrop=e=>{
      e.preventDefault(); if (!palDragRef.current) return
      const {x,y}=sc2(canvas,e)
      const item=palDragRef.current
      palDragRef.current=null
      if (item.id==='entry-door'||item.id==='exit-door') {
        const flZones=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
        const zone=zoneAt(flZones,x,y)
        if (!zone) { palDragRef.current=null; return } // must drop inside a zone
        const pad=8
        const cx=Math.max(zone.x+pad,Math.min(zone.x+zone.w-pad,x))
        const cy=Math.max(zone.y+pad,Math.min(zone.y+zone.h-pad,y))
        if (item.id==='entry-door') zone.entryPos={x:cx,y:cy}
        else zone.exitPos={x:cx,y:cy}
        setZones(clone(zonesRef.current))
        drawBuild(); return
      }
      const z=zoneAt(zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current),x,y); if (!z) return
      const nm={...item, uid:uid(item.id), px:null, py:null, widthCm:200, heightCm:200}
      z.media.push(nm)
      skipStats.current[nm.uid]={skip:0,exp:0}
      engAcc.current[nm.uid]={score:0,count:0}
      selRef.current=z.id; setSelZoneId(z.id); setEditingZoneName(false)
      layoutAll(zonesRef.current)
      setZones(clone(zonesRef.current))
      drawBuild()
    }
    const onDO=e=>e.preventDefault()
    canvas.addEventListener('dragover',onDO)
    canvas.addEventListener('drop',onDrop)
    return ()=>{ canvas.removeEventListener('dragover',onDO); canvas.removeEventListener('drop',onDrop) }
  },[drawBuild, projectName])

  // ── 마우스 휠 줌 ──
  useEffect(()=>{
    const handleWheel=(e)=>{
      e.preventDefault()
      const factor=e.deltaY<0?1.1:1/1.1
      doZoom(factor, e.clientX, e.clientY)
    }
    // 캔버스 + .cw 컨테이너 전체에 등록 (캔버스 외부 영역에서도 줌 가능)
    const targets=[
      bCRef.current, sCRef.current, hCRef.current,
      ...Array.from(document.querySelectorAll('.cw')),
    ].filter(Boolean)
    const unique=[...new Set(targets)]
    unique.forEach(el=>el.addEventListener('wheel',handleWheel,{passive:false}))
    return ()=>unique.forEach(el=>el.removeEventListener('wheel',handleWheel))
  }, [doZoom, projectName])

  // ── 브라우저 리사이즈 → 캔버스 재렌더 ──
  useEffect(()=>{
    const handleResize = () => {
      drawBuild()
      if (runRef.current) return // 시뮬 중엔 루프가 알아서 그림
      drawSim()
    }
    const ro = new ResizeObserver(handleResize)
    const cw = bCRef.current?.closest('.cw') || bCRef.current?.parentElement
    if (cw) ro.observe(cw)
    window.addEventListener('resize', handleResize)
    return () => { ro.disconnect(); window.removeEventListener('resize', handleResize) }
  }, [drawBuild])

  // ── 스페이스바 / 화살표 이동 / Ctrl+줌 ──
  useEffect(()=>{
    let active = false
    const ARROW = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])
    const onKD = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key==='Escape' && polyDrawRef.current.active) { cancelPolyDraw(); return }
      if (e.key==='Escape' && mediaPolyDrawRef.current.active) { cancelMediaPolyDraw(); return }
      if (e.key==='Escape' && mediaPolyEditRef.current) { exitMediaPolyEdit(); return }

      // ── Ctrl 단축키 (언두/리두/줌) ──
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          if (tabRef.current === 'build') performUndoRef.current?.()
          return
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault()
          if (tabRef.current === 'build') performRedoRef.current?.()
          return
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault(); doZoom(1.15)
          return
        }
        if (e.key === '-') {
          e.preventDefault(); doZoom(1/1.15)
          return
        }
        if (e.key === '0') {
          e.preventDefault(); resetVT()
          return
        }
      }

      // ── 화살표 → 선택 존 이동 ──
      if (ARROW.has(e.code) && selRef.current !== null) {
        e.preventDefault()
        if (!e.repeat) snapshotUndoRef.current?.()
        const step = e.shiftKey ? 5 : 1
        const delta = {
          ArrowUp:    { x:0, y:-step },
          ArrowDown:  { x:0, y: step },
          ArrowLeft:  { x:-step, y:0 },
          ArrowRight: { x: step, y:0 },
        }[e.code]
        const sz = floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
        const mPx = CW / sz.w
        zonesRef.current = zonesRef.current.map(z => {
          if (z.id !== selRef.current) return z
          const dx = delta.x * mPx * 0.5
          const dy = delta.y * mPx * 0.5
          const HP = 7
          const nx = Math.max(HP, Math.min(CW - z.w - HP, z.x + dx))
          const dynCH = Math.max(160, Math.min(600, Math.round(CW * sz.h / sz.w)))
          const ny = Math.max(HP, Math.min(dynCH - z.h - HP, z.y + dy))
          const actualDx = nx - z.x
          const actualDy = ny - z.y
          const movePos = (pos) => pos ? { x: pos.x + actualDx, y: pos.y + actualDy } : pos
          return {
            ...z,
            x: nx, y: ny,
            entryPos:  movePos(z.entryPos),
            exitPos:   movePos(z.exitPos),
            returnPos: movePos(z.returnPos),
            media: z.media.map(m=>{
              const updated={...m}
              if (m.px!=null) { updated.px=m.px+actualDx; updated.py=m.py+actualDy }
              if (m.polyVerts) updated.polyVerts=m.polyVerts.map(v=>({x:v.x+actualDx,y:v.y+actualDy}))
              return updated
            }),
          }
        })
        setZones(clone(zonesRef.current))
        drawBuild()
        return
      }

      // ── 스페이스바 → 팬 모드 ──
      if (e.code !== 'Space') return
      if (active) return
      active = true
      e.preventDefault()
      panModeRef.current = true
      setPanMode(true)
      document.body.style.cursor = 'grab'
      ;[bCRef, sCRef, hCRef].forEach(r => { if (r.current) r.current.style.cursor = 'grab' })
    }
    const onKU = (e) => {
      if (e.code !== 'Space') return
      active = false
      panModeRef.current = false
      setPanMode(false)
      document.body.style.cursor = ''
      ;[bCRef, sCRef, hCRef].forEach(r => { if (r.current) r.current.style.cursor = '' })
    }
    window.addEventListener('keydown', onKD)
    window.addEventListener('keyup', onKU)
    return () => { window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU) }
  }, [doZoom, resetVT, drawBuild, projectName])

  // ── 빌드 캔버스 팬 드래그: 캔버스 밖에서도 작동하도록 window 레벨 이벤트 ──
  useEffect(()=>{
    const md = (e) => {
      // 스페이스바 팬 모드일 때 캔버스 밖에서도 드래그 시작
      if (!panModeRef.current || e.button !== 0) return
      if (panDragRef.current) return  // 이미 드래그 중
      panDragRef.current = {sx: e.clientX, sy: e.clientY, ox: vtRef.current.x, oy: vtRef.current.y}
      document.body.style.cursor = 'grabbing'
      if (bCRef.current) bCRef.current.style.cursor = 'grabbing'
      e.preventDefault()
    }
    const mm = (e) => {
      if (!panDragRef.current) return
      vtRef.current.x = panDragRef.current.ox + (e.clientX - panDragRef.current.sx)
      vtRef.current.y = panDragRef.current.oy + (e.clientY - panDragRef.current.sy)
      ;[bCRef, sCRef, hCRef].forEach(r => applyVT(r.current))
    }
    const mu = () => {
      if (!panDragRef.current) return
      panDragRef.current = null
      const cur = panModeRef.current ? 'grab' : ''
      document.body.style.cursor = panModeRef.current ? 'grab' : ''
      ;[bCRef, sCRef, hCRef].forEach(r => { if (r.current) r.current.style.cursor = cur })
    }
    window.addEventListener('mousedown', md)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return () => {
      window.removeEventListener('mousedown', md)
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
    }
  }, [applyVT, projectName])

  // ── 캔버스/패널 외부 클릭 시 선택 해제 ──
  useEffect(()=>{
    const handler = (e) => {
      // Build 탭이 아니면 무시
      if (tabRef.current !== 'build') return
      // 캔버스 위 클릭이면 무시 (onBMD가 처리)
      if (bCRef.current && bCRef.current.contains(e.target)) return
      // 우측 패널(setup-panel) 위 클릭이면 무시
      const panel = document.querySelector('.setup-panel')
      if (panel && panel.contains(e.target)) return
      // 좌측 사이드바(build-sidebar) 위 클릭이면 무시
      const sidebar = document.querySelector('.build-sidebar')
      if (sidebar && sidebar.contains(e.target)) return
      // 나머지 영역 클릭 → 선택 해제
      if (selRef.current !== null) {
        selRef.current = null
        setSelZoneId(null)
        setEditingZoneName(false)
        drawBuild()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [drawBuild])

  // ── Sim/Heat 캔버스 팬 — 빌드와 동일하게 panMode일 때만 드래그 ──
  useEffect(()=>{
    const cleanup=[]
    ;[sCRef, hCRef].forEach(ref=>{
      const canvas=ref.current; if(!canvas) return
      const md=e=>{
        if (!panModeRef.current || e.button!==0) return
        if (panDragRef.current) return
        panDragRef.current={sx:e.clientX,sy:e.clientY,ox:vtRef.current.x,oy:vtRef.current.y}
        document.body.style.cursor='grabbing'
        ;[bCRef, sCRef, hCRef].forEach(r=>{ if(r.current) r.current.style.cursor='grabbing' })
        e.preventDefault()
      }
      canvas.addEventListener('mousedown',md)
      cleanup.push(()=>canvas.removeEventListener('mousedown',md))
    })
    return ()=>cleanup.forEach(fn=>fn())
  }, [applyVT, projectName])

  // ═══════════════════════════════════════════════
  // 미디어 관리
  // ═══════════════════════════════════════════════

  function removeMedia(zid, muid) {
    snapshotUndo()
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    z.media=z.media.filter(m=>m.uid!==muid)
    delete skipStats.current[muid]
    delete engAcc.current[muid]
    layoutAll(zonesRef.current)
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function moveMedia(zid, muid, dir) {
    snapshotUndo()
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    const i=z.media.findIndex(m=>m.uid===muid); if (i<0) return
    const j=i+dir
    if (j<0||j>=z.media.length) return
    ;[z.media[i],z.media[j]]=[z.media[j],z.media[i]]
    layoutAll(zonesRef.current)
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function renameZone(zid, name) {
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    z.name=name
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function findFreePos(peers, nw, nh) {
    const canvasH = dynCHRef.current
    const PAD = 10
    for (let y = PAD; y + nh <= canvasH - PAD; y += PAD) {
      for (let x = PAD; x + nw <= CW - PAD; x += PAD) {
        const hit = peers.some(z => !(x+nw <= z.x || x >= z.x+z.w || y+nh <= z.y || y >= z.y+z.h))
        if (!hit) return {x, y}
      }
    }
    return {x: Math.min(20, CW-nw-PAD), y: Math.min(20, canvasH-nh-PAD)}
  }

  function commitPolygon(pts) {
    snapshotUndo()
    polyDrawRef.current={active:false, pts:[]}
    setPolyDrawing(false)
    if (pts.length < 3) return
    const bounds=getPolyBounds(pts)
    const newId=zonesRef.current.reduce((m,z)=>Math.max(m,z.id),-1)+1
    const floorPeers=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const maxOrder=floorPeers.reduce((m,z)=>Math.max(m,z.order??0),-1)
    const newZone={
      id:newId, name:`Zone ${newId}`,
      shape:'polygon', vertices:pts.map(p=>({...p})),
      ...bounds,
      media:[], defCap:20, defDwell:20,
      floor:viewFloorRef.current, order:maxOrder+1,
      entryPos:{x:pts[0].x,y:pts[0].y},
      exitPos:{x:pts[Math.min(1,pts.length-1)].x,y:pts[Math.min(1,pts.length-1)].y},
      returnPos:null, flowType:'guided',
    }
    zonesRef.current=[...zonesRef.current, newZone]
    heatAcc.current[newId]=0
    skipStats.current[`z${newId}`]={skip:0,exp:0}
    engAcc.current[`z${newId}`]={score:0,count:0}
    setZones(clone(zonesRef.current))
    setSelZoneId(newId); selRef.current=newId
    layoutAll(zonesRef.current); drawBuild()
  }

  function startPolyDraw() {
    if (simStatus!=='idle') return
    selRef.current=null; setSelZoneId(null)
    polyDrawRef.current={active:true, pts:[]}
    setPolyDrawing(true)
    drawBuild()
  }

  function cancelPolyDraw() {
    polyDrawRef.current={active:false, pts:[]}
    setPolyDrawing(false)
    drawBuild()
  }

  function startMediaPolyDraw(mediaUid) {
    mediaPolyDrawRef.current={active:true, uid:mediaUid, pts:[]}
    setMediaPolyDrawing(true)
    if (bCRef.current) bCRef.current.style.cursor='crosshair'
    drawBuild()
  }

  function cancelMediaPolyDraw() {
    mediaPolyDrawRef.current={active:false, uid:null, pts:[]}
    setMediaPolyDrawing(false)
    if (bCRef.current) bCRef.current.style.cursor='default'
    drawBuild()
  }

  function commitMediaPoly(pts) {
    snapshotUndo()
    const muid=mediaPolyDrawRef.current.uid
    mediaPolyDrawRef.current={active:false, uid:null, pts:[]}
    setMediaPolyDrawing(false)
    for (const zone of zonesRef.current) {
      const m=zone.media.find(m=>m.uid===muid)
      if (m) { m.polyVerts=pts; m.px=null; m.py=null; break }
    }
    if (bCRef.current) bCRef.current.style.cursor='default'
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function createRectMediaPoly(zoneId, mediaUid) {
    const zone=zonesRef.current.find(z=>z.id===zoneId)
    if (!zone) return
    const m=zone.media.find(m=>m.uid===mediaUid)
    if (!m) return
    // 존 중앙 기준 존 크기의 30% 사각형 — 순서: TL(0) TR(1) BR(2) BL(3)
    const rw=zone.w*0.30, rh=zone.h*0.30
    const cx=zone.x+zone.w/2, cy=zone.y+zone.h/2
    m.polyVerts=[
      {x:cx-rw/2, y:cy-rh/2},
      {x:cx+rw/2, y:cy-rh/2},
      {x:cx+rw/2, y:cy+rh/2},
      {x:cx-rw/2, y:cy+rh/2},
    ]
    m.rectShape=true
    m.px=null; m.py=null
    setZones(clone(zonesRef.current))
    // 생성 즉시 편집 모드 → 핸들 바로 표시
    mediaPolyEditRef.current=mediaUid
    setMediaPolyEditingUid(mediaUid)
    drawBuild()
  }

  function createCircleMediaPoly(zoneId, mediaUid) {
    const zone=zonesRef.current.find(z=>z.id===zoneId)
    if (!zone) return
    const m=zone.media.find(m=>m.uid===mediaUid)
    if (!m) return
    const N=24
    const r=Math.min(zone.w, zone.h)*0.15
    const cx=zone.x+zone.w/2, cy=zone.y+zone.h/2
    // idx 0 = 오른쪽(3시) → 4등분 핸들: 0(E), 6(S), 12(W), 18(N)
    m.polyVerts=Array.from({length:N},(_,i)=>({
      x:cx+r*Math.cos(2*Math.PI*i/N),
      y:cy+r*Math.sin(2*Math.PI*i/N)
    }))
    m.circleShape=true
    m.px=null; m.py=null
    setZones(clone(zonesRef.current))
    mediaPolyEditRef.current=mediaUid
    setMediaPolyEditingUid(mediaUid)
    drawBuild()
  }

  function clearMediaPoly(zoneId, mediaUid) {
    const zone=zonesRef.current.find(z=>z.id===zoneId)
    const m=zone?.media.find(m=>m.uid===mediaUid)
    if (m) { m.polyVerts=null; m.rectShape=false; m.circleShape=false }
    if (mediaPolyEditRef.current===mediaUid) { mediaPolyEditRef.current=null; setMediaPolyEditingUid(null) }
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function enterMediaPolyEdit(mediaUid) {
    mediaPolyEditRef.current=mediaUid
    setMediaPolyEditingUid(mediaUid)
    drawBuild()
  }

  function exitMediaPolyEdit() {
    mediaPolyEditRef.current=null
    setMediaPolyEditingUid(null)
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function addZone() {
    if (simStatus!=='idle') return
    snapshotUndo()
    const newId=zonesRef.current.reduce((m,z)=>Math.max(m,z.id),-1)+1
    const floorPeers=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const maxOrder=floorPeers.reduce((m,z)=>Math.max(m,z.order??0),-1)
    const nw=130, nh=90
    const {x,y}=findFreePos(floorPeers,nw,nh)
    const pad=8
    const newZone={ id:newId, name:`Zone ${newId}`, x, y, w:nw, h:nh, media:[], defCap:20, defDwell:20, floor:viewFloor, order:maxOrder+1, entryPos:{x:x+pad,y:y+pad}, returnPos:null, exitPos:{x:x+nw-pad,y:y+pad}, flowType:'guided' }
    zonesRef.current=[...zonesRef.current, newZone]
    heatAcc.current[newId]=0
    skipStats.current[`z${newId}`]={skip:0,exp:0}
    engAcc.current[`z${newId}`]={score:0,count:0}
    setZones(clone(zonesRef.current))
    setSelZoneId(newId); selRef.current=newId
    layoutAll(zonesRef.current); drawBuild()
  }

  function removeZone(zid) {
    if (simStatus!=='idle') return
    if (zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current).length<=1) return
    snapshotUndo()
    zonesRef.current=zonesRef.current.filter(z=>z.id!==zid)
    delete heatAcc.current[zid]
    delete skipStats.current[`z${zid}`]
    delete engAcc.current[`z${zid}`]
    setZones(clone(zonesRef.current))
    setSelZoneId(null); selRef.current=null
    drawBuild()
  }

  function moveZoneOrder(zid, dir) {
    if (simStatus!=='idle') return
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    snapshotUndo()
    const fl=z.floor||0
    const peers=zonesRef.current.filter(p=>(p.floor||0)===fl).sort((a,b)=>(a.order??0)-(b.order??0))
    const idx=peers.findIndex(p=>p.id===zid)
    const swapIdx=idx+dir
    if (swapIdx<0||swapIdx>=peers.length) return
    const tmp=peers[idx].order
    peers[idx].order=peers[swapIdx].order
    peers[swapIdx].order=tmp
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function updateZone(zid, field, value) {
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    z[field]=value
    setZones(clone(zonesRef.current)); drawBuild()
  }

  function updateMedia(zid, muid, field, value) {
    const z=zonesRef.current.find(z=>z.id===zid); if (!z) return
    const m=z.media.find(m=>m.uid===muid); if (!m) return
    if (field==='label') {
      m.label=value
    } else if (field==='engagementLevel') {
      m.engagementLevel=Math.min(5,Math.max(1,parseInt(value)||3))
    } else {
      m[field]=Math.max(1,parseInt(value)||1)
    }
    setZones(clone(zonesRef.current)); drawBuild()
  }

  // ═══════════════════════════════════════════════
  // 시뮬레이션 로직
  // ═══════════════════════════════════════════════

  function initSkipStats() {
    skipStats.current={}; engAcc.current={}
    zoneEntriesRef.current={}
    zoneEngagedRef.current={}
    zoneWaitAccRef.current={}
    zonesRef.current.forEach(z=>{
      skipStats.current[`z${z.id}`]={skip:0,exp:0}
      engAcc.current[`z${z.id}`]={score:0,count:0}
      zoneEntriesRef.current[z.id]=0
      zoneEngagedRef.current[z.id]=0
      zoneWaitAccRef.current[z.id]=0
      z.media.forEach(m=>{
        skipStats.current[m.uid]={skip:0,exp:0}
        engAcc.current[m.uid]={score:0,count:0}
      })
    })
  }

  function initHeat() {
    heatAcc.current={}
    zonesRef.current.forEach(z=>{ heatAcc.current[z.id]=0 })
  }

  function recordSlotResult(slotIdx) {
    const allSS=Object.values(skipStats.current)
    const totSkip=allSS.reduce((s,v)=>s+v.skip,0)
    const totExp=allSS.reduce((s,v)=>s+v.exp,0)
    const skipRate=totSkip+totExp>0?Math.round(totSkip/(totSkip+totExp)*100):0
    const avgDw=exitedCnt.current?Math.round(dwellTotal.current/exitedCnt.current/1000):0
    const allEng=Object.values(engAcc.current)
    const engTot=allEng.reduce((s,e)=>s+e.count,0)
    const engScore=engTot>0?(allEng.reduce((s,e)=>s+e.score,0)/engTot).toFixed(1):'-'
    cumulativeVisitorsRef.current += totalSpawnedRef.current
    setSlotResults(prev=>[...prev,{
      slot:slotIdx, label:SLOTS[slotIdx],
      visitors:totalSpawnedRef.current, skipRate,
      avgDwell:avgDw, engIdx:engScore,
      bottlenecks:bnRef.current,
    }])
  }

  function resetSlotState() {
    agentsRef.current=[]; spawnTimer.current=0; tourTimer.current=0
    bnRef.current=0; dwellTotal.current=0; exitedCnt.current=0; flashRef.current=[]
    totalSpawnedRef.current=0; simTimeRef.current=0
    zoneEntriesRef.current={}
    zoneEngagedRef.current={}
    zoneWaitAccRef.current={}
    zonesRef.current.forEach(z=>{
      zoneEntriesRef.current[z.id]=0
      zoneEngagedRef.current[z.id]=0
      zoneWaitAccRef.current[z.id]=0
    })
  }

  function addFloor() {
    if (simStatus!=='idle') return
    snapshotUndo()
    const newFloor=floorCount
    const newId=zonesRef.current.reduce((m,z)=>Math.max(m,z.id),-1)+1
    const newZone={ id:newId, name:`입구 (Area ${newFloor+1})`, x:14, y:14, w:140, h:76, media:[], defCap:30, defDwell:10, floor:newFloor, order:0, entryPos:{x:14+8,y:14+8}, returnPos:null, exitPos:{x:14+140-8,y:14+8}, flowType:'guided' }
    zonesRef.current=[...zonesRef.current, newZone]
    heatAcc.current[newId]=0
    skipStats.current[`z${newId}`]={skip:0,exp:0}
    engAcc.current[`z${newId}`]={score:0,count:0}
    setZones(clone(zonesRef.current))
    setFloorCount(newFloor+1)
    setFloorSizes(p=>[...p,{w:20,h:14}])
    setViewFloor(newFloor)
  }

  function removeFloor(floorIdx) {
    if (simStatus!=='idle') return
    if (floorCount<=1) return
    snapshotUndo()
    const zonesOnFloor=zonesRef.current.filter(z=>(z.floor||0)===floorIdx)
    const hasMedia=zonesOnFloor.some(z=>z.media.length>0)
    const doRemove=()=>{
      zonesOnFloor.forEach(z=>{
        delete heatAcc.current[z.id]
        delete skipStats.current[`z${z.id}`]
        delete engAcc.current[`z${z.id}`]
      })
      zonesRef.current=zonesRef.current
        .filter(z=>(z.floor||0)!==floorIdx)
        .map(z=>z.floor>floorIdx?{...z,floor:z.floor-1}:z)
      const newCount=floorCount-1
      const newView=viewFloor>=newCount?newCount-1:viewFloor
      setZones(clone(zonesRef.current))
      setFloorCount(newCount)
      setFloorSizes(p=>p.filter((_,i)=>i!==floorIdx))
      setViewFloor(newView); viewFloorRef.current=newView
      setSelZoneId(null); selRef.current=null
      drawBuild()
    }
    setConfirmModal({
      visible: true,
      title: `Area ${floorIdx+1} 삭제`,
      message: hasMedia
        ? `Area ${floorIdx+1}에 배치된 미디어가 있어요.\n이 Area와 모든 콘텐츠를 삭제할까요?`
        : `Area ${floorIdx+1}을 삭제할까요?`,
      onConfirm: doRemove,
    })
  }

  function getNextZone(zoneId, visited) {
    const ft=flowRef.current
    const sorted=zonesRef.current.slice().sort((a,b)=>{
      const fa=(a.floor||0), fb=(b.floor||0)
      return fa!==fb ? fa-fb : (a.order??0)-(b.order??0)
    })
    const GP=sorted.map(z=>z.id)
    if (ft==='guided') {
      const i=GP.indexOf(zoneId)
      return i>=0&&i<GP.length-1 ? GP[i+1] : -1
    }
    if (ft==='free') {
      const av=sorted.filter(z=>!visited.includes(z.id))
      return av.length ? av[Math.floor(Math.random()*av.length)].id : -1
    }
    const fixedIdxs=[0, Math.floor((GP.length-1)/2), GP.length-1]
    const fixedIds=new Set(fixedIdxs.map(i=>GP[i]))
    if (fixedIds.has(zoneId)) { const i=GP.indexOf(zoneId); return i<GP.length-1?GP[i+1]:-1 }
    const av=sorted.filter(z=>!visited.includes(z.id)&&!fixedIds.has(z.id))
    if (av.length) return av[Math.floor(Math.random()*av.length)].id
    const i=GP.indexOf(zoneId); return i<GP.length-1?GP[i+1]:-1
  }

  function getEntryZoneId() {
    const z=zonesRef.current.filter(z=>(z.floor||0)===0).sort((a,b)=>(a.order??0)-(b.order??0))[0]
    return z ? z.id : (zonesRef.current[0]?.id ?? 0)
  }

  function getExitZoneId() {
    if (circularFlowRef.current) return getEntryZoneId()
    return null
  }

  function decideNext(a) {
    const dZone=zonesRef.current.find(z=>z.id===a.zoneId)
    const isFree=(dZone?.flowType||'guided')==='free'
    let next=null
    if (a.mediaRemaining.length>0) {
      next = isFree
        ? a.mediaRemaining[Math.floor(Math.random()*a.mediaRemaining.length)]
        : a.mediaRemaining[0]   // guided: 순서대로
    }
    if (next) {
      a.mediaRemaining=a.mediaRemaining.filter(m=>m!==next)
      a.curMedia=next; a.waitTime=0; a.phase='moving_to_media'; a._wanderAngle=undefined; a._wanderDir=undefined
    } else {
      const nxt=getNextZone(a.zoneId,a.visited)
      a.curMedia=null; a.waitTime=0
      if (nxt<0) {
        if (circularFlowRef.current && !a.returnedToEntry) {
          const entryId=getEntryZoneId()
          a.returnedToEntry=true
          if (a.zoneId===entryId) {
            a.exited=true; exitedCnt.current++; dwellTotal.current+=simTimeRef.current-a.spawnTime
          } else {
            const curZone2=zonesRef.current.find(z=>z.id===a.zoneId)
            const entryZone=zonesRef.current.find(z=>z.id===entryId)
            a.nextZoneId=entryId
            if (curZone2?.exitPos) {
              a.phase='moving_to_exit'
              a.exitTargetX=curZone2.exitPos.x
              a.exitTargetY=curZone2.exitPos.y
            } else {
              a.phase='moving_to_zone'
            }
            // Use returnPos as the entry target for the first zone when returning
            if (entryZone?.returnPos) {
              a._returnTargetPos=entryZone.returnPos
            }
          }
        } else {
          a.exited=true; exitedCnt.current++; dwellTotal.current+=simTimeRef.current-a.spawnTime
        }
      } else {
        const curZone=zonesRef.current.find(z=>z.id===a.zoneId)
        a.nextZoneId=nxt
        if (curZone?.exitPos) {
          a.phase='moving_to_exit'
          a.exitTargetX=curZone.exitPos.x
          a.exitTargetY=curZone.exitPos.y
        } else {
          a.phase='moving_to_zone'
        }
      }
    }
  }

  function enterZone(a, zoneId) {
    const zn=zonesRef.current.find(z=>z.id===zoneId)
    if (!zn) { a.exited=true; exitedCnt.current++; return }
    if (a.returnedToEntry) {
      a.zoneId=zoneId
      // ENTRY(returnPos)에 도착 → ENTRY/EXIT(entryPos)까지 걸어가서 퇴장
      if (zn.entryPos) {
        a.phase='moving_to_exit'
        a.exitTargetX=zn.entryPos.x
        a.exitTargetY=zn.entryPos.y
        a._circularFinalExit=true
      } else {
        a.exited=true; exitedCnt.current++; dwellTotal.current+=simTimeRef.current-a.spawnTime
      }
      return
    }
    a.zoneId=zoneId; a.visited.push(zoneId)
    // 존 진입 추적
    if (zoneEntriesRef.current[zoneId] !== undefined) {
      zoneEntriesRef.current[zoneId] += a.size
    }
    const isFreeZone=(zn.flowType||'guided')==='free'
    let meds=[...zn.media]
    if (isFreeZone) {
      // 자유 동선: 미디어 순서 셔플
      for (let i=meds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[meds[i],meds[j]]=[meds[j],meds[i]]}
    }
    const first=meds[0]||null
    a.mediaRemaining=meds.slice(1)
    a.curMedia=first||null; a.waitTime=0
    if (first) { a.phase='moving_to_media' }
    else {
      const nxt=getNextZone(zoneId,a.visited)
      if (nxt<0) { a.exited=true; exitedCnt.current++; dwellTotal.current+=simTimeRef.current-a.spawnTime }
      else { a.phase='moving_to_zone'; a.nextZoneId=nxt }
    }
  }

  function spawn() {
    const cfg=cfgRef.current
    const segs=cfg.segs
    const totalPct=Object.values(segs).reduce((s,v)=>s+v,0)||1
    let roll=Math.random()*totalPct
    let segKey='individual'
    for (const s of SEGS) { roll-=(segs[s.key]||0); if (roll<=0){segKey=s.key;break} }
    const seg=SEGS.find(s=>s.key===segKey)
    let size
    switch(segKey) {
      case 'smallGroup':   size=Math.floor(Math.random()*4)+2; break
      case 'studentGroup': size=Math.floor(Math.random()*21)+10; break
      case 'corpGroup':    size=Math.floor(Math.random()*41)+10; break
      case 'genGroup':     size=Math.floor(Math.random()*15)+6; break
      default: size=1
    }
    const vtDist=cfg.visitorTypes||{quick:33,info:34,immersive:33}
    const vtTotal=Object.values(vtDist).reduce((s,v)=>s+v,0)||1
    let vtRoll=Math.random()*vtTotal, vtKey='info'
    for (const vt of VISITOR_TYPES){vtRoll-=(vtDist[vt.key]||0);if(vtRoll<=0){vtKey=vt.key;break}}
    const entryZ=zonesRef.current.filter(z=>(z.floor||0)===0).sort((a,b)=>(a.order??0)-(b.order??0))[0]||zonesRef.current[0]
    const spawnX=entryZ.entryPos?entryZ.entryPos.x+(Math.random()*8-4):entryZ.x+entryZ.w/2+(Math.random()*14-7)
    const spawnY=entryZ.entryPos?entryZ.entryPos.y+(Math.random()*6-3):entryZ.y+entryZ.h/2+(Math.random()*10-5)
    const a={
      uid:uid('a'), x:spawnX, y:spawnY,
      zoneId:-1, visited:[], segKey, size, color:seg.color, r:seg.r,
      phase:'moving_to_media', curMedia:null, mediaRemaining:[], nextZoneId:-1,
      waitTime:0, dwellLeft:0, dwellTotal:0, exited:false, spawnTime:simTimeRef.current,
      isDocent:false, visitorType:vtKey, _lastX:null, _lastY:null, _stuckTime:0, returnedToEntry:false,
      exitTargetX:0, exitTargetY:0,
      engagedZones: new Set()
    }
    totalSpawnedRef.current+=size
    enterZone(a,entryZ.id); agentsRef.current.push(a)
  }

  function spawnTour() {
    const dc=docentCfgRef.current
    if (!dc.enabled) return
    const size=dc.size
    const entryZ=zonesRef.current.filter(z=>(z.floor||0)===0).sort((a,b)=>(a.order??0)-(b.order??0))[0]||zonesRef.current[0]
    const spawnX=entryZ.entryPos?entryZ.entryPos.x+(Math.random()*8-4):entryZ.x+entryZ.w/2+(Math.random()*14-7)
    const spawnY=entryZ.entryPos?entryZ.entryPos.y+(Math.random()*6-3):entryZ.y+entryZ.h/2+(Math.random()*10-5)
    const a={
      uid:uid('a'), x:spawnX, y:spawnY,
      zoneId:-1, visited:[], segKey:'docent', size, color:DOCENT_COLOR, r:9,
      phase:'moving_to_media', curMedia:null, mediaRemaining:[], nextZoneId:-1,
      waitTime:0, dwellLeft:0, dwellTotal:0, exited:false, spawnTime:simTimeRef.current,
      isDocent:true, visitorType:'immersive', _lastX:null, _lastY:null, _stuckTime:0, returnedToEntry:false,
      exitTargetX:0, exitTargetY:0,
      engagedZones: new Set()
    }
    totalSpawnedRef.current+=size
    enterZone(a,entryZ.id); agentsRef.current.push(a)
  }

  // ── 미디어 장애물 헬퍼 (rect / circle / polygon 공통 처리) ──
  function getMediaObs(om, sX, sY) {
    if (om.polyVerts?.length>=3) {
      const cx=om.polyVerts.reduce((s,v)=>s+v.x,0)/om.polyVerts.length
      const cy=om.polyVerts.reduce((s,v)=>s+v.y,0)/om.polyVerts.length
      if (om.circleShape) {
        const r=Math.hypot(om.polyVerts[0].x-cx,om.polyVerts[0].y-cy)
        return {type:'circle',cx,cy,r}
      }
      const xs=om.polyVerts.map(v=>v.x), ys=om.polyVerts.map(v=>v.y)
      const px2=Math.min(...xs),py2=Math.min(...ys),w=Math.max(...xs)-px2,h=Math.max(...ys)-py2
      return {type:'rect',px:px2,py:py2,w,h,cx:px2+w/2,cy:py2+h/2}
    }
    if (om.px==null) return null
    const w=Math.max(MS,(om.widthCm||100)*sX), h=Math.max(MS,(om.heightCm||100)*sY)
    return {type:'rect',px:om.px,py:om.py,w,h,cx:om.px+w/2,cy:om.py+h/2}
  }
  function ptInObs(obs,px2,py2) {
    if (!obs) return false
    if (obs.type==='circle') return Math.hypot(px2-obs.cx,py2-obs.cy)<obs.r
    return px2>=obs.px&&px2<=obs.px+obs.w&&py2>=obs.py&&py2<=obs.py+obs.h
  }
  function pushOutObs(a,obs) {
    if (!obs||!ptInObs(obs,a.x,a.y)) return
    if (obs.type==='circle') {
      let ang=Math.atan2(a.y-obs.cy,a.x-obs.cx)
      if (!isFinite(ang)) ang=Math.random()*Math.PI*2
      a.x=obs.cx+Math.cos(ang)*(obs.r+0.8); a.y=obs.cy+Math.sin(ang)*(obs.r+0.8)
    } else {
      const dl=a.x-obs.px,dr=obs.px+obs.w-a.x,dt2=a.y-obs.py,db=obs.py+obs.h-a.y
      const mn=Math.min(dl,dr,dt2,db)
      if (mn===dl) a.x=obs.px-0.5
      else if (mn===dr) a.x=obs.px+obs.w+0.5
      else if (mn===dt2) a.y=obs.py-0.5
      else a.y=obs.py+obs.h+0.5
    }
  }

  function stepAgents(dt) {
    const skipThresh=cfgRef.current.skipThresh*1000
    const spd=speedRef.current
    let bn=0
    agentsRef.current.forEach(a=>{
      if (a.exited) return
      heatAcc.current[a.zoneId]+=a.size*dt*0.004
      if (a.phase==='moving_to_media') {
        if (!a.curMedia) { decideNext(a); return }
        // polyVerts 미디어는 centroid를 타깃으로, px==null이어도 정상 진행
        if (a.curMedia.px==null && !(a.curMedia.polyVerts?.length>=3)) { decideNext(a); return }
        const _tZone=zonesRef.current.find(z=>z.id===a.zoneId)
        const _tFi=_tZone?.floor||0
        const _tSz=floorSizesRef.current[_tFi]||{w:20,h:14}
        const _tSX=CW/(_tSz.w*100)*0.5, _tSY=dynCHRef.current/(_tSz.h*100)*0.5
        const _tFpW=Math.max(MS,(a.curMedia.widthCm||100)*_tSX)
        const _tFpH=Math.max(MS,(a.curMedia.heightCm||100)*_tSY)
        // polyVerts 미디어는 centroid를 타깃으로 사용
        const _hasPoly=a.curMedia.polyVerts?.length>=3
        const _polyCx=_hasPoly?a.curMedia.polyVerts.reduce((s,v)=>s+v.x,0)/a.curMedia.polyVerts.length:null
        const _polyCy=_hasPoly?a.curMedia.polyVerts.reduce((s,v)=>s+v.y,0)/a.curMedia.polyVerts.length:null
        const tx=_hasPoly?_polyCx:a.curMedia.px+_tFpW/2
        const ty=_hasPoly?_polyCy:a.curMedia.py+_tFpH/2
        const dx=tx-a.x, dy=ty-a.y, d=Math.sqrt(dx*dx+dy*dy)
        const busy=busyCount(a.curMedia.uid,agentsRef.current)
        const el=a.curMedia.engagementLevel||3
        const vt=VISITOR_TYPES.find(v=>v.key===a.visitorType)
        const effSkipThresh=skipThresh*(vt?vt.waitMult(el):1)
        if (busy>=a.curMedia.cap) {
          a.waitTime+=dt*spd
          if (zoneWaitAccRef.current[a.zoneId] !== undefined) {
            zoneWaitAccRef.current[a.zoneId] += dt * spd * a.size
          }
          // 대기 중에 mediaRemaining에 현재 여유있는 미디어가 있으면 즉시 이동
          const freeNext = a.mediaRemaining.find(m => {
            if (m.px==null && !(m.polyVerts?.length>=3)) return false
            return busyCount(m.uid, agentsRef.current) < m.cap
          })
          if (freeNext) {
            a._wanderAngle=undefined; a._wanderDir=undefined
            a.mediaRemaining=a.mediaRemaining.filter(m=>m!==freeNext)
            a.curMedia=freeNext; a.waitTime=0; a.phase='moving_to_media'; return
          }
          if (a.waitTime>=effSkipThresh) {
            if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].skip+=a.size
            if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].skip+=a.size
            flashRef.current.push({x:tx,y:ty,t:performance.now()})
            a._wanderAngle=undefined; decideNext(a)
          } else {
            // 미디어 풋프린트 외부 고정 궤도에서 대기
            const wZone=zonesRef.current.find(z=>z.id===a.zoneId)
            const floorIdx=wZone?.floor||0
            const sz2=floorSizesRef.current[floorIdx]||{w:20,h:14}
            const sX=CW/(sz2.w*100)*0.5, sY=dynCHRef.current/(sz2.h*100)*0.5
            const fpW=wZone?Math.min(Math.max(MS,(a.curMedia.widthCm||100)*sX),wZone.w):MS
            const fpH=wZone?Math.min(Math.max(MS,(a.curMedia.heightCm||100)*sY),wZone.h):MS
            const _wHasPoly=a.curMedia.polyVerts?.length>=3
            const cx=_wHasPoly
              ? a.curMedia.polyVerts.reduce((s,v)=>s+v.x,0)/a.curMedia.polyVerts.length
              : a.curMedia.px+fpW/2
            const cy=_wHasPoly
              ? a.curMedia.polyVerts.reduce((s,v)=>s+v.y,0)/a.curMedia.polyVerts.length
              : a.curMedia.py+fpH/2
            // 처음 대기 시작 시: 기존 대기자들과 겹치지 않는 각도 슬롯 배정
            if (a._wanderAngle===undefined) {
              const waiters=agentsRef.current.filter(ag=>
                !ag.exited && ag._wanderAngle!==undefined &&
                ag.curMedia?.uid===a.curMedia.uid
              )
              if (waiters.length===0) {
                a._wanderAngle=Math.random()*Math.PI*2
              } else {
                const used=waiters.map(ag=>ag._wanderAngle)
                let bestAngle=0, maxGap=-1
                const sorted=[...used].sort((a,b)=>a-b)
                sorted.push(sorted[0]+Math.PI*2)
                for (let i=0;i<sorted.length-1;i++){
                  const mid=(sorted[i]+sorted[i+1])/2
                  const gap=sorted[i+1]-sorted[i]
                  if (gap>maxGap){maxGap=gap;bestAngle=mid%(Math.PI*2)}
                }
                a._wanderAngle=bestAngle
              }
              a._wanderDir = Math.random()<0.5 ? 1 : -1  // 각자 공전 방향 배정
            }
            // 궤도 반경: 실제 미디어 형태 기준 (원형은 polyVerts 반경, 사각형은 대각선)
            a._wanderAngle += 0.004 * spd * (a._wanderDir||1)
            const wSX=CW/(sz2.w*100)*0.5, wSY=dynCHRef.current/(sz2.h*100)*0.5
            const wObs=getMediaObs(a.curMedia,wSX,wSY)
            const outerR=wObs
              ? (wObs.type==='circle'
                  ? wObs.r + MS*1.5
                  : Math.sqrt(wObs.w*wObs.w+wObs.h*wObs.h)/2+MS*1.5)
              : Math.sqrt(fpW*fpW+fpH*fpH)/2+MS*1.5
            const wx=cx+Math.cos(a._wanderAngle)*outerR
            const wy=cy+Math.sin(a._wanderAngle)*outerR
            const wdx=wx-a.x, wdy=wy-a.y, wd=Math.sqrt(wdx*wdx+wdy*wdy)
            const ws=0.18*spd
            if (wd>0.5){a.x+=wdx/wd*Math.min(wd,ws);a.y+=wdy/wd*Math.min(wd,ws)}
            // 미디어 장애물 밖으로 밀어내기 (현재 대기 미디어 포함, 내부 진입 방지)
            if (wZone) {
              const wFi2=wZone.floor||0
              const wSz2=floorSizesRef.current[wFi2]||{w:20,h:14}
              const wSX2=CW/(wSz2.w*100)*0.5, wSY2=dynCHRef.current/(wSz2.h*100)*0.5
              for (const om of wZone.media) {
                pushOutObs(a, getMediaObs(om,wSX2,wSY2))
              }
              // 존 경계 클램프
              a.x=Math.max(wZone.x+0.5, Math.min(wZone.x+wZone.w-0.5, a.x))
              a.y=Math.max(wZone.y+0.5, Math.min(wZone.y+wZone.h-0.5, a.y))
            }
            bn++
          }
          return
        }
        a.waitTime=0
        if (d>2) {
          const mv=Math.min(d, (a.size>5?0.22:0.38)*spd)
          let mvx=dx/d*mv, mvy=dy/d*mv
          // 미디어 풋프린트 장애물 우회 (rect + circle 모두 처리, 목적지는 허용)
          const mZone=zonesRef.current.find(z=>z.id===a.zoneId)
          if (mZone) {
            const mFi=mZone.floor||0
            const mSz=floorSizesRef.current[mFi]||{w:20,h:14}
            const mSX=CW/(mSz.w*100)*0.5, mSY=dynCHRef.current/(mSz.h*100)*0.5
            for (const om of mZone.media) {
              if (om.uid===a.curMedia.uid) continue  // 목적지는 통과 허용
              const obs=getMediaObs(om,mSX,mSY)
              if (!obs) continue
              // 이미 장애물 안에 있으면(직전 미디어 탈출 중) 밀어내기만
              if (ptInObs(obs,a.x,a.y)) { pushOutObs(a,obs); continue }
              const nx=a.x+mvx, ny=a.y+mvy
              if (!ptInObs(obs,nx,ny)) continue
              if (obs.type==='circle') {
                // 원형: 접선 방향으로 슬라이드
                const ang=Math.atan2(ny-obs.cy,nx-obs.cx)
                const tang={x:-Math.sin(ang),y:Math.cos(ang)}
                const dot=mvx*tang.x+mvy*tang.y
                mvx=tang.x*dot*0.7; mvy=tang.y*dot*0.7
              } else {
                const xOk=!ptInObs(obs,a.x+mvx,a.y)
                const yOk=!ptInObs(obs,a.x,a.y+mvy)
                if (xOk) mvy=0
                else if (yOk) mvx=0
                else { mvx=0; mvy=0 }
              }
            }
          }
          a.x+=mvx; a.y+=mvy
        } else {
          const entryP=vt?vt.entryChance(el):1
          if (!a._entryChecked) {
            a._entryChecked=true
            if (Math.random()>entryP) {
              if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].skip+=a.size
              if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].skip+=a.size
              flashRef.current.push({x:tx,y:ty,t:performance.now()})
              a._entryChecked=false; decideNext(a); return
            }
          }
          a.x=tx; a.y=ty; a.phase='experiencing'; a._entryChecked=false
          const baseMult=a.isDocent?0.55*(0.85+Math.random()*0.3):(0.85+Math.random()*0.3)
          const vtMult=vt?vt.dwellMult(el):1
          a.dwellTotal=a.curMedia.dwell*1000*baseMult*vtMult
          a.dwellLeft=a.dwellTotal
          // 체험 전환 추적 (zone당 최초 1회)
          if (a.engagedZones && !a.engagedZones.has(a.zoneId)) {
            a.engagedZones.add(a.zoneId)
            if (zoneEngagedRef.current[a.zoneId] !== undefined) {
              zoneEngagedRef.current[a.zoneId] += a.size
            }
          }
          if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].exp+=a.size
          if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].exp+=a.size
        }
      } else if (a.phase==='experiencing') {
        a.dwellLeft-=dt*spd
        if (a.dwellLeft<=0) {
          if (a.curMedia?.isTransit && a.curMedia.linkedZoneId!=null) {
            enterZone(a, a.curMedia.linkedZoneId)
          } else {
            const ek=`z${a.zoneId}`
            if (!engAcc.current[ek]) engAcc.current[ek]={score:0,count:0}
            const lvl=a.curMedia?(a.curMedia.engagementLevel||3):3
            engAcc.current[ek].score+=lvl*a.size
            engAcc.current[ek].count+=a.size
            if (a.curMedia) {
              const mk=a.curMedia.uid
              if (!engAcc.current[mk]) engAcc.current[mk]={score:0,count:0}
              engAcc.current[mk].score+=lvl*a.size
              engAcc.current[mk].count+=a.size
              // 체험 완료 후 미디어 풋프린트 밖으로 탈출 (이후 이동 시 갇힘 방지)
              const expZone=zonesRef.current.find(z=>z.id===a.zoneId)
              if (expZone) {
                const eFi=expZone.floor||0
                const eSz=floorSizesRef.current[eFi]||{w:20,h:14}
                const eSX=CW/(eSz.w*100)*0.5, eSY=dynCHRef.current/(eSz.h*100)*0.5
                const expObs=getMediaObs(a.curMedia,eSX,eSY)
                if (expObs) {
                  let escAng=Math.atan2(a.y-expObs.cy,a.x-expObs.cx)
                  if (!isFinite(escAng)) escAng=Math.random()*Math.PI*2
                  const escR=(expObs.type==='circle'?expObs.r:Math.sqrt(expObs.w*expObs.w+expObs.h*expObs.h)/2)+1.5
                  a.x=expObs.cx+Math.cos(escAng)*escR
                  a.y=expObs.cy+Math.sin(escAng)*escR
                }
              }
            }
            decideNext(a)
          }
        }
      } else if (a.phase==='moving_to_zone') {
        const nid=a.nextZoneId
        if (nid<0){a.exited=true;exitedCnt.current++;dwellTotal.current+=simTimeRef.current-a.spawnTime;return}
        const nz=zonesRef.current.find(z=>z.id===nid)
        if (!nz){a.exited=true;exitedCnt.current++;dwellTotal.current+=simTimeRef.current-a.spawnTime;return}
        const rtp=a._returnTargetPos
        const tx=rtp?rtp.x:(nz.entryPos?nz.entryPos.x:nz.x+nz.w/2)
        const ty=rtp?rtp.y:(nz.entryPos?nz.entryPos.y:nz.y+nz.h/2)
        const dx=tx-a.x, dy=ty-a.y, d=Math.sqrt(dx*dx+dy*dy)
        if (d>3) { const mv=Math.min(d, (a.size>5?0.22:0.38)*spd); a.x+=dx/d*mv; a.y+=dy/d*mv }
        else { a._returnTargetPos=undefined; enterZone(a,nid) }
      }
      else if (a.phase==='moving_to_exit') {
        const tx=a.exitTargetX, ty=a.exitTargetY
        const dx=tx-a.x,dy=ty-a.y,d=Math.sqrt(dx*dx+dy*dy)
        if (d>3){const mv=Math.min(d,(a.size>5?0.22:0.38)*spd);a.x+=dx/d*mv;a.y+=dy/d*mv}
        else if (a._circularFinalExit) {
          // ENTRY/EXIT 도착 → 퇴장
          a.exited=true; exitedCnt.current++; dwellTotal.current+=simTimeRef.current-a.spawnTime
        } else {
          a.phase='moving_to_zone'
        }
      }
      // 존 경계 클램프 — 이동 중(이존→다음존) 페이즈 제외
      if (!a.exited && a.phase!=='moving_to_zone' && a.phase!=='moving_to_exit') {
        const az=zonesRef.current.find(z=>z.id===a.zoneId)
        if (az) {
          if (az.shape === 'ellipse') {
            const cx=az.x+az.w/2, cy=az.y+az.h/2, rx=az.w/2-0.5, ry=az.h/2-0.5
            const ddx=a.x-cx, ddy=a.y-cy
            const dist=Math.sqrt((ddx/rx)*(ddx/rx)+(ddy/ry)*(ddy/ry))
            if (dist>1) { a.x=cx+ddx/dist*rx; a.y=cy+ddy/dist*ry }
          } else {
            a.x=Math.max(az.x+0.5, Math.min(az.x+az.w-0.5, a.x))
            a.y=Math.max(az.y+0.5, Math.min(az.y+az.h-0.5, a.y))
            if (az.shape === 'L') {
              const r = a.r ?? 0.5
              const corner = az.cutCorner ?? 'NE'
              const cw = Math.min(az.cutW ?? az.w*0.4, az.w-20)
              const ch = Math.min(az.cutH ?? az.h*0.4, az.h-20)
              let inCut = false
              switch(corner) {
                case 'NE': inCut = a.x > az.x+az.w-cw && a.y < az.y+ch; if(inCut){const dL=a.x-(az.x+az.w-cw),dD=(az.y+ch)-a.y;if(dL<dD)a.x=az.x+az.w-cw-r;else a.y=az.y+ch+r}; break
                case 'NW': inCut = a.x < az.x+cw && a.y < az.y+ch; if(inCut){const dR=(az.x+cw)-a.x,dD=(az.y+ch)-a.y;if(dR<dD)a.x=az.x+cw+r;else a.y=az.y+ch+r}; break
                case 'SE': inCut = a.x > az.x+az.w-cw && a.y > az.y+az.h-ch; if(inCut){const dL=a.x-(az.x+az.w-cw),dU=a.y-(az.y+az.h-ch);if(dL<dU)a.x=az.x+az.w-cw-r;else a.y=az.y+az.h-ch-r}; break
                case 'SW': inCut = a.x < az.x+cw && a.y > az.y+az.h-ch; if(inCut){const dR=(az.x+cw)-a.x,dU=a.y-(az.y+az.h-ch);if(dR<dU)a.x=az.x+cw+r;else a.y=az.y+az.h-ch-r}; break
              }
            }
          }
          // 미디어 풋프린트 장애물 처리 (체험 중 관람객 제외)
          if (a.phase!=='experiencing') {
            const fi=az.floor||0
            const szM=floorSizesRef.current[fi]||{w:20,h:14}
            const sXM=CW/(szM.w*100)*0.5, sYM=dynCHRef.current/(szM.h*100)*0.5
            for (const m of az.media) {
              if (m.px==null) continue
              if (a.curMedia?.uid===m.uid) continue  // 이동 중인 목적지 미디어는 제외
              const fpW=Math.max(MS,(m.widthCm||100)*sXM)
              const fpH=Math.max(MS,(m.heightCm||100)*sYM)
              if (a.x>=m.px&&a.x<=m.px+fpW&&a.y>=m.py&&a.y<=m.py+fpH) {
                const dl=a.x-m.px, dr=m.px+fpW-a.x, dt2=a.y-m.py, db=m.py+fpH-a.y
                const mn=Math.min(dl,dr,dt2,db)
                if (mn===dl) a.x=m.px-0.5
                else if (mn===dr) a.x=m.px+fpW+0.5
                else if (mn===dt2) a.y=m.py-0.5
                else a.y=m.py+fpH+0.5
              }
            }
          }
        }
      }
    })
    agentsRef.current.forEach(a=>{
      if (a.exited) return
      if (!a._lastX) { a._lastX=a.x; a._lastY=a.y; a._stuckTime=0 }
      const moved=Math.abs(a.x-a._lastX)+Math.abs(a.y-a._lastY)
      const isWaiting=a.phase==='moving_to_media'&&a.waitTime>0
      if (!isWaiting && moved<0.5 && a.phase!=='experiencing') {
        a._stuckTime=(a._stuckTime||0)+dt*speedRef.current
        if (a._stuckTime>8000){a.exited=true;exitedCnt.current++;dwellTotal.current+=simTimeRef.current-a.spawnTime}
      } else { a._lastX=a.x; a._lastY=a.y; a._stuckTime=0 }
    })
    bnRef.current=Math.max(0,bn)
  }

  function drawSim() {
    const canvas=sCRef.current; if (!canvas) return
    const DPR=window.devicePixelRatio||1
    const sz=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const dynCH=Math.max(160,Math.min(600,Math.round(CW*sz.h/sz.w)))
    const cssW=fitCanvasWidth(canvas,dynCH)
    const cssH=Math.round(cssW*sz.h/sz.w)
    canvas.width=Math.round(cssW*DPR); canvas.height=Math.round(cssH*DPR)
    canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'
    const ctx=canvas.getContext('2d')
    const scale=cssW/CW*DPR
    ctx.scale(scale,scale)
    ctx.clearRect(0,0,CW,dynCH)
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad,pad,CW-pad*2,dynCH-pad*2,clipR); ctx.clip()

    // ── 1m 그리드 ──
    ;(()=>{
      const mPx=CW/sz.w
      ctx.save()
      ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=0.3
      for (let i=0;i<=sz.w;i++) { const x=Math.round(i*mPx*10)/10; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,dynCH);ctx.stroke() }
      for (let j=0;j<=sz.h;j++) { const y=Math.round(j*mPx*10)/10; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke() }
      ctx.strokeStyle='rgba(0,0,0,0.13)'; ctx.lineWidth=0.4
      for (let i=0;i<=sz.w;i+=5) { const x=Math.round(i*mPx*10)/10; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,dynCH);ctx.stroke() }
      for (let j=0;j<=sz.h;j+=5) { const y=Math.round(j*mPx*10)/10; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke() }
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.font='3.5px sans-serif'
      ctx.textAlign='left'; ctx.textBaseline='top'
      for (let i=1;i<sz.w;i++) { if (i%5===0) continue; ctx.fillText(`${i}`, i*mPx+1, pad+1) }
      for (let i=5;i<sz.w;i+=5) ctx.fillText(`${i}m`, i*mPx+1, pad+1)
      for (let j=1;j<sz.h;j++) { if (j%5===0) continue; ctx.fillText(`${j}`, pad+1, j*mPx+1) }
      for (let j=5;j<sz.h;j+=5) ctx.fillText(`${j}m`, pad+1, j*mPx+1)
      ctx.restore()
    })()

    const scaleX=CW/(sz.w*100)*0.5, scaleY=dynCH/(sz.h*100)*0.5
    const zs=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const sortedSimZs=zs.slice().sort((a,b)=>(a.order??0)-(b.order??0))
    const agents=agentsRef.current.filter(a=>{
      if (a.exited) return false
      if (a.zoneId<0) return viewFloorRef.current===0
      return (zonesRef.current.find(z=>z.id===a.zoneId)?.floor||0)===viewFloorRef.current
    })

    sortedSimZs.forEach((z,zi)=>{
      const cnt=agents.filter(a=>a.zoneId===z.id&&!a.exited).reduce((s,a)=>s+a.size,0)
      const cap=zCap(z), crowded=cnt>=cap
      drawZoneShape(ctx, z, crowded?'rgba(234,75,74,0.06)':'rgba(255,255,255,1)', crowded?'#E24B4A':'rgba(0,0,0,0.15)', crowded?0.6:0.4)
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='500 5px sans-serif'; ctx.textAlign='center'
      ctx.fillText(`${zi+1}. ${z.name}`,z.x+z.w/2,z.y+10)
      ctx.font='5px sans-serif'
      ctx.fillStyle=crowded?'#E24B4A':'rgba(0,0,0,0.28)'
      ctx.fillText(`${cnt}/${cap}인`,z.x+z.w/2,z.y+z.h-8); ctx.textAlign='left'
    })

    sortedSimZs.forEach(z=>z.media.forEach(m=>{
      const busy=busyCount(m.uid,agents), full=busy>=m.cap
      const pr=MS/2+2
      const expA=agents.filter(a=>!a.exited&&a.phase==='experiencing'&&a.curMedia?.uid===m.uid)
      let icx, icy
      if (m.polyVerts?.length>=3) {
        icx=m.polyVerts.reduce((s,v)=>s+v.x,0)/m.polyVerts.length
        icy=m.polyVerts.reduce((s,v)=>s+v.y,0)/m.polyVerts.length
        ctx.save()
        ctx.beginPath()
        if (m.circleShape) {
          const r2=Math.hypot(m.polyVerts[0].x-icx,m.polyVerts[0].y-icy)
          ctx.arc(icx,icy,r2,0,Math.PI*2)
        } else {
          ctx.moveTo(m.polyVerts[0].x,m.polyVerts[0].y)
          m.polyVerts.forEach((v,i)=>{ if(i>0) ctx.lineTo(v.x,v.y) })
          ctx.closePath()
        }
        ctx.fillStyle=m.bg+'55'; ctx.fill()
        ctx.strokeStyle=m.color+'99'; ctx.lineWidth=0.8; ctx.stroke()
        ctx.restore()
        drawMIcon(ctx,m,icx-MS/2,icy-MS/2,drawSim,MS,MS)
      } else {
        if (m.px==null) return
        const fpW=Math.max(MS,(m.widthCm||100)*scaleX)
        const fpH=Math.max(MS,(m.heightCm||100)*scaleY)
        const cW=Math.min(fpW, z.x+z.w-m.px)
        const cH=Math.min(fpH, z.y+z.h-m.py)
        drawMIcon(ctx,m,m.px,m.py,drawSim,cW,cH)
        icx=m.px+cW/2; icy=m.py+cH/2
      }
      if (expA.length>0) {
        const avgP=expA.reduce((s,a)=>s+(1-a.dwellLeft/a.dwellTotal),0)/expA.length
        ctx.beginPath(); ctx.arc(icx,icy,pr,0,Math.PI*2); ctx.strokeStyle='rgba(29,158,117,0.2)'; ctx.lineWidth=1; ctx.stroke()
        ctx.beginPath(); ctx.arc(icx,icy,pr,-Math.PI/2,-Math.PI/2+avgP*Math.PI*2); ctx.strokeStyle='#1D9E75'; ctx.lineWidth=1; ctx.stroke()
        ctx.font='4px sans-serif'; ctx.textAlign='center'
        ctx.fillStyle=full?'#E24B4A':'#1D9E75'
        ctx.fillText(`${busy}/${m.cap}`,icx,icy+pr+2)
      } else {
        ctx.font='4px sans-serif'; ctx.textAlign='center'
        ctx.fillStyle=full?'#E24B4A':'rgba(0,0,0,0.3)'
        ctx.fillText(`0/${m.cap}`,icx,icy+pr+2)
      }
      ctx.textAlign='left'
    }))

    const now=performance.now()
    flashRef.current=flashRef.current.filter(f=>{
      const p=Math.min((now-f.t)/700,1)
      ctx.globalAlpha=(1-p)*0.95; ctx.font='bold 4px sans-serif'; ctx.textAlign='center'
      ctx.fillStyle='#EF9F27'; ctx.fillText('SKIP',f.x,f.y-p*14)
      ctx.globalAlpha=1; ctx.textAlign='left'
      return p<1
    })

    agents.forEach(a=>{
      if (a.exited) return
      const isWait=a.phase==='moving_to_media'&&a.waitTime>0&&a.curMedia&&busyCount(a.curMedia.uid,agents)>=a.curMedia.cap
      const isExp=a.phase==='experiencing'
      if (!a.isDocent && a.visitorType) {
        const vtC=VISITOR_TYPES.find(v=>v.key===a.visitorType)?.color
        if (vtC) { ctx.beginPath(); ctx.arc(a.x,a.y,a.r+1.8,0,Math.PI*2); ctx.strokeStyle=vtC; ctx.lineWidth=1.5; ctx.globalAlpha=0.65; ctx.stroke(); ctx.globalAlpha=1 }
      }
      ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,Math.PI*2)
      ctx.fillStyle=isWait?'#E24B4A':a.color; ctx.globalAlpha=0.88; ctx.fill(); ctx.globalAlpha=1
      if (isExp&&a.dwellTotal>0) {
        const prog=Math.max(0,Math.min(1,1-a.dwellLeft/a.dwellTotal)), pr=a.r+2.5
        ctx.beginPath(); ctx.arc(a.x,a.y,pr,0,Math.PI*2); ctx.strokeStyle='rgba(29,158,117,0.2)'; ctx.lineWidth=1.5; ctx.stroke()
        ctx.beginPath(); ctx.arc(a.x,a.y,pr,-Math.PI/2,-Math.PI/2+prog*Math.PI*2); ctx.strokeStyle='#1D9E75'; ctx.lineWidth=1.5; ctx.stroke()
      }
      if (a.size>1) {
        ctx.fillStyle='#fff'; ctx.font='bold 5px sans-serif'; ctx.textAlign='center'
        ctx.fillText(a.size,a.x,a.y+2.5); ctx.textAlign='left'
      }
    })
    // ── Footprint scale 레이블 (좌하단) ──
    ;(()=>{
      const sqm=sz.w*sz.h; const py=(sqm*0.3025).toFixed(1)
      const lbl=`□  Footprint scale: Area ${viewFloorRef.current+1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font='4px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.28)'
      ctx.textAlign='left'; ctx.textBaseline='bottom'
      ctx.fillText(lbl, 4, dynCH-4)
      ctx.restore()
    })()
    applyVT(canvas)
  }

  function updateDispStats() {
    const agents=agentsRef.current
    const liveAgents=agents.filter(a=>!a.exited)
    const active=liveAgents.reduce((s,a)=>s+a.size,0)
    const avgDw=exitedCnt.current?Math.round(dwellTotal.current/exitedCnt.current/1000):0

    // 실시간 상태별 인원
    const experiencingCount=liveAgents.filter(a=>a.phase==='experiencing').reduce((s,a)=>s+a.size,0)
    const waitingCount=liveAgents.filter(a=>a.phase==='moving_to_media'&&a.waitTime>0).reduce((s,a)=>s+a.size,0)

    // ① 관람 효율: 방문된 존 / 전체 존
    const totalZones=zonesRef.current.length
    const visitedZoneCount=Object.entries(heatAcc.current).filter(([,v])=>v>0).length
    const flowEffNum=totalZones>0?Math.round(visitedZoneCount/totalZones*100):0
    const flowEff=totalZones>0?flowEffNum+'%':'-'

    // ② 체험 전환율: 체험 전환 수 / 존 진입 수
    const totalEntries=Object.values(zoneEntriesRef.current).reduce((s,v)=>s+v,0)
    const totalEngaged=Object.values(zoneEngagedRef.current).reduce((s,v)=>s+v,0)
    const engRateNum=totalEntries>0?Math.round(totalEngaged/totalEntries*100):0
    const engRate=totalEntries>0?engRateNum+'%':'-'

    // ③ 혼잡도: 평균 대기시간 (ms→sec, 진입 수 기준)
    const totalWait=Object.values(zoneWaitAccRef.current).reduce((s,v)=>s+v,0)
    const congestionSec=totalEntries>0?Math.round(totalWait/totalEntries/1000):0
    const congestion=congestionSec>0?congestionSec+'초':'0초'

    // 보조: 스킵율 · 몰입 강도
    const allSS=Object.values(skipStats.current)
    const totSkip=allSS.reduce((s,v)=>s+v.skip,0)
    const totExp=allSS.reduce((s,v)=>s+v.exp,0)
    const skipRate=totSkip+totExp>0?Math.round(totSkip/(totSkip+totExp)*100):0
    const allEng=Object.values(engAcc.current)
    const ts2=allEng.reduce((s,ea)=>s+ea.score,0)
    const tc2=allEng.reduce((s,ea)=>s+ea.count,0)
    const engIdx=tc2>0?(ts2/tc2).toFixed(1):'-'

    // 전시 클록: 슬롯 시작 시각 + 실제 시뮬레이션 경과 시간 (배속 반영)
    const _slotStartHour = 9 + runningSlotRef.current   // 9시=9, 10시=10 ...
    const _simElapsedMs = simTimeRef.current * speedRef.current  // 배속 반영 경과 ms
    const _simElapsedMin = Math.floor(_simElapsedMs / 60000)
    const _exhibMinTotal = _slotStartHour * 60 + _simElapsedMin
    const _exhibHour = Math.floor(_exhibMinTotal / 60)
    const _exhibMin  = _exhibMinTotal % 60
    const simTimeDisplay = `${String(_exhibHour).padStart(2,'0')}:${String(_exhibMin).padStart(2,'0')}`

    const slotTotal = cfgRef.current.total
    const slotProgress = slotTotal > 0 ? Math.min(100, Math.round(totalSpawnedRef.current / slotTotal * 100)) : 0
    const cumVisitors = cumulativeVisitorsRef.current + totalSpawnedRef.current

    const _totalArea = floorSizesRef.current.reduce((s,f)=>s+f.w*f.h, 0)
    const densityNum = _totalArea>0 ? +(active/_totalArea).toFixed(2) : 0
    const density = _totalArea>0 ? densityNum.toFixed(2)+'명/㎡' : '-'

    setDispStats(p=>({
      ...p,
      curVisitors:active+'명', curVisitorsNum:active,
      experiencingCount, waitingCount,
      avgDwell:avgDw?avgDw+'초':'-',
      flowEff, flowEffNum,
      engRate, engRateNum,
      congestion, congestionSec,
      bottlenecks:bnRef.current+'건', bottlenecksNum:bnRef.current,
      skipRate:skipRate+'%', skipRateNum:skipRate, engIdx,
      density, densityNum,
      simTimeDisplay,
      slotProgress,
      slotVisitors: totalSpawnedRef.current,
      slotTotal,
      cumVisitors,
    }))

    const table=zonesRef.current.map(z=>{
      const zs=skipStats.current[`z${z.id}`]||{skip:0,exp:0}
      const tot=zs.skip+zs.exp, rate=tot>0?Math.round(zs.skip/tot*100):0
      const ea=engAcc.current[`z${z.id}`]
      const zEng=ea&&ea.count>0?(ea.score/ea.count).toFixed(1):'-'
      const entries=zoneEntriesRef.current[z.id]||0
      const engaged=zoneEngagedRef.current[z.id]||0
      const convRate=entries>0?Math.round(engaged/entries*100):0
      const waitMs=zoneWaitAccRef.current[z.id]||0
      const avgWait=entries>0?Math.round(waitMs/entries/1000):0
      return {
        zone:z, zs, rate, zEng, entries, engaged, convRate, avgWait,
        media:z.media.map(m=>{
          const ms=skipStats.current[m.uid]||{skip:0,exp:0}
          const mt=ms.skip+ms.exp, mr=mt>0?Math.round(ms.skip/mt*100):0
          const me=engAcc.current[m.uid]
          const mEng=me&&me.count>0?(me.score/me.count).toFixed(1):'-'
          return {m, ms, mr, mEng}
        })
      }
    })
    setSkipTable(table)
  }

  // ── 시뮬레이션 루프 (ref로 항상 최신 버전 유지) ──
  const simLoopFn = useRef(null)
  function simLoop(ts) {
    if (!lastTRef.current) lastTRef.current=ts
    const dt=Math.min(ts-lastTRef.current,50); lastTRef.current=ts
    simTimeRef.current+=dt
    const cfg=cfgRef.current
    const total=cfg.total
    spawnTimer.current+=dt*speedRef.current
    const spawnInterval=60000/(cfg.arrivalRate||5)
    while (spawnTimer.current>spawnInterval&&totalSpawnedRef.current<total) {
      spawn(); spawnTimer.current-=spawnInterval
    }
    const dc=docentCfgRef.current
    if (dc.enabled) {
      tourTimer.current+=dt*speedRef.current
      const tourIntervalMs=dc.interval*60*1000
      if (tourTimer.current>=tourIntervalMs) {
        spawnTour(); tourTimer.current=0
      }
    }
    for (let i=0;i<speedRef.current;i++) stepAgents(dt/speedRef.current)
    drawSim()
    updateDispStats()

    const _slotTotal=cfgRef.current.total
    if (_slotTotal>0) {
      const _snapEvery=Math.max(1,Math.floor(_slotTotal/20))
      const _snapIdx=Math.floor(totalSpawnedRef.current/_snapEvery)
      if (_snapIdx>lastSnapIdxRef.current&&totalSpawnedRef.current>0) {
        lastSnapIdxRef.current=_snapIdx
        heatSnapshotsRef.current.push({
          slotIdx:runningSlotRef.current,
          slotLabel:SLOTS[runningSlotRef.current],
          pct:Math.min(100,Math.round(totalSpawnedRef.current/_slotTotal*100)),
          heat:{...heatAcc.current},
          skip:Object.fromEntries(Object.entries(skipStats.current).map(([k,v])=>[k,{...v}])),
          entries:{...zoneEntriesRef.current},
          engaged:{...zoneEngagedRef.current},
          wait:{...zoneWaitAccRef.current},
        })
      }
    }

    const slotCfgNow=cfgRef.current
    const allSpawned=totalSpawnedRef.current>=slotCfgNow.total
    const allExited=agentsRef.current.length>0&&agentsRef.current.every(a=>a.exited)
    if (slotCfgNow.total>0&&allSpawned&&allExited) {
      const cur=runningSlotRef.current
      recordSlotResult(cur)
      const next=cur+1
      if (next>simRangeRef.current.end) {
        stopSim(true)
        return
      } else {
        runningSlotRef.current=next
        cfgRef.current=slotCfgsRef.current[next]
        docentCfgRef.current=slotCfgsRef.current[next].docent
        setRunningSlot(next); setSlot(next)
        lastSnapIdxRef.current=-1
        resetSlotState()
      }
    }

    if (runRef.current&&!pausedRef.current) rafRef.current=requestAnimationFrame(ts=>simLoopFn.current(ts))
  }
  simLoopFn.current=simLoop

  function startSim() {
    if (runRef.current) return
    const r=simRangeRef.current
    runningSlotRef.current=r.start
    cfgRef.current=slotCfgsRef.current[r.start]
    docentCfgRef.current=slotCfgsRef.current[r.start].docent
    setRunningSlot(r.start)
    setSlot(r.start)
    setSlotResults([])
    cumulativeVisitorsRef.current = 0
    initHeat(); initSkipStats()
    resetSlotState()
    heatSnapshotsRef.current=[]; lastSnapIdxRef.current=-1
    heatScrubSnapRef.current=null
    setHeatTimeline([]); setHeatScrubIdx(0)
    runRef.current=true; pausedRef.current=false; lastTRef.current=null
    setSimStatus('running')
    rafRef.current=requestAnimationFrame(ts=>simLoopFn.current(ts))
  }

  function pauseSim() {
    if (!runRef.current) return
    pausedRef.current=!pausedRef.current
    setSimStatus(pausedRef.current?'paused':'running')
    if (!pausedRef.current) { lastTRef.current=null; rafRef.current=requestAnimationFrame(ts=>simLoopFn.current(ts)) }
    else cancelAnimationFrame(rafRef.current)
  }

  function stopSim(finished=false) {
    cancelAnimationFrame(rafRef.current)
    runRef.current=false; pausedRef.current=false
    if (finished) {
      agentsRef.current=[]; flashRef.current=[]
      drawSim()
      heatSnapshotsRef.current.push({
        slotIdx:simRangeRef.current.end,
        slotLabel:SLOTS[simRangeRef.current.end],
        pct:100,
        isFinal:true,
        heat:{...heatAcc.current},
        skip:Object.fromEntries(Object.entries(skipStats.current).map(([k,v])=>[k,{...v}])),
        entries:{...zoneEntriesRef.current},
        engaged:{...zoneEngagedRef.current},
        wait:{...zoneWaitAccRef.current},
      })
      const tl=[...heatSnapshotsRef.current]
      heatScrubSnapRef.current=null
      setHeatTimeline(tl)
      setHeatScrubIdx(tl.length-1)
      const _capturedZones = zonesRef.current.map(z=>{
        const zss=skipStats.current[`z${z.id}`]||{skip:0,exp:0}
        const ea=engAcc.current[`z${z.id}`]
        const zSR=zss.skip+zss.exp>0?Math.round(zss.skip/(zss.skip+zss.exp)*100):0
        const zEntries = zoneEntriesRef.current[z.id] || 0
        const zEngaged = zoneEngagedRef.current[z.id] || 0
        const zConvRate = zEntries > 0 ? Math.round(zEngaged / zEntries * 100) : 0
        const zWaitMs = zoneWaitAccRef.current[z.id] || 0
        const zAvgWait = zEntries > 0 ? Math.round(zWaitMs / zEntries / 1000) : 0
        return {
          id:z.id, name:z.name, floor:z.floor||0,
          skipRate:zSR, skipCount:zss.skip, expCount:zss.exp,
          engIdx:ea&&ea.count>0?parseFloat((ea.score/ea.count).toFixed(1)):null,
          heatVal:Math.round(heatAcc.current[z.id]||0),
          entries: zEntries, engaged: zEngaged, convRate: zConvRate, avgWait: zAvgWait,
          media:z.media.map(m=>{
            const ms=skipStats.current[m.uid]||{skip:0,exp:0}
            const me=engAcc.current[m.uid]
            return {
              uid:m.uid, name:m.label||m.name||m.id, type:m.id, color:m.color, bg:m.bg,
              skipRate:ms.skip+ms.exp>0?Math.round(ms.skip/(ms.skip+ms.exp)*100):0,
              exposure:ms.skip+ms.exp, skipCount:ms.skip,
              engIdx:me&&me.count>0?parseFloat((me.score/me.count).toFixed(1)):null,
            }
          }),
        }
      })
      const _totalEntries = _capturedZones.reduce((s,z)=>s+z.entries,0)
      const _totalEngaged = _capturedZones.reduce((s,z)=>s+z.engaged,0)
      const _overallFlowEff = _capturedZones.length > 0 ? Math.round(_capturedZones.filter(z=>z.entries>0).length / _capturedZones.length * 100) : 0
      const _overallEngRate = _totalEntries > 0 ? Math.round(_totalEngaged / _totalEntries * 100) : 0
      const _totalWait = _capturedZones.reduce((s,z)=>s+(z.avgWait*z.entries),0)
      const _overallAvgWait = _totalEntries > 0 ? Math.round(_totalWait / _totalEntries) : 0
      const _capturedRange={
        start:simRangeRef.current.start, end:simRangeRef.current.end,
        label:simRangeRef.current.start===simRangeRef.current.end
          ?SLOTS[simRangeRef.current.start]
          :`${SLOTS[simRangeRef.current.start]} ~ ${SLOTS[simRangeRef.current.end]}`,
      }
      setSlotResults(prev=>{
        const _entryId = Date.now()
        const _ts = new Date().toLocaleString('ko-KR')
        const _project = projectName||'(프로젝트)'
        const _scenario = scenarioName||'시나리오 1'
        setReportData({zones:_capturedZones, range:_capturedRange, slotResults:prev, flowEff:_overallFlowEff, engRate:_overallEngRate, avgWait:_overallAvgWait,
          _logId:_entryId, _project, _scenario, _ts, _rangeLabel:_capturedRange.label, _runNo:null /* 완료 직후엔 1번 */})
        reportDataRef.current={zones:_capturedZones, range:_capturedRange, slotResults:prev, flowEff:_overallFlowEff, engRate:_overallEngRate, avgWait:_overallAvgWait}
        const entry={
          id: _entryId,
          ts: _ts,
          project: _project,
          scenario: _scenario,
          range: { start: simRangeRef.current.start, end: simRangeRef.current.end },
          rangeLabel: _capturedRange.label,
          results: prev,
          zones: _capturedZones,
          flowEff: _overallFlowEff,
          engRate: _overallEngRate,
          avgWait: _overallAvgWait,
          heatTimeline: [...heatSnapshotsRef.current],
        }
        setSimLogs(logs=>{
          const updated=[entry,...logs].slice(0,30)
          try { localStorage.setItem('exsim_logs', JSON.stringify(updated)) } catch {}
          return updated
        })
        return prev
      })
    } else {
      resetSlotState(); initHeat(); initSkipStats()
      heatSnapshotsRef.current=[]; lastSnapIdxRef.current=-1
      heatScrubSnapRef.current=null
      setHeatTimeline([]); setHeatScrubIdx(0)
      setReportData(null)
      drawSim()
    }
    setSimStatus(finished?'done':'idle')
    if (!finished) setSlotResults([])
    setDispStats(p=>({...p,curVisitors:'0명',avgDwell:'-',bottlenecks:'0건',skipRate:'0%',skipRateNum:0,engIdx:'-'}))
    setSkipTable([])
  }

  // ── 설정 저장 / 불러오기 ──
  async function saveSettings() {
    const data=JSON.stringify({
      version:2,
      projectName: projectName||'',
      scenarioName: scenarioName||'',
      zones:zonesRef.current,
      slotCfgs:slotCfgsRef.current,
      floorCount,
      floorSizes,
      simLogs,
    },null,2)
    const fileName=`${projectName||'exhibition'}-${new Date().toISOString().slice(0,10)}.json`
    // 폴더 선택 창 (File System Access API 지원 브라우저)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'JSON 파일', accept: { 'application/json': ['.json'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(data)
        await writable.close()
        return
      } catch(e) {
        if (e.name==='AbortError') return  // 사용자가 취소
        // 그 외 에러는 fallback으로 진행
      }
    }
    // fallback: 바로 다운로드
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}))
    a.download=fileName
    a.click()
  }

  function loadSettings(e) {
    const file=e.target.files[0]; if (!file) return
    const reader=new FileReader()
    reader.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result)
        if (!d.zones) { alert('올바른 설정 파일이 아닙니다.\n(zones 데이터가 없습니다)'); return }

        // 구역 / 플로어 복원
        zonesRef.current=d.zones
        setZones(clone(d.zones))
        const fc=d.floorCount||1
        setFloorCount(fc); setViewFloor(0); viewFloorRef.current=0
        const fs=d.floorSizes||Array.from({length:fc},()=>({w:20,h:14}))
        setFloorSizes(fs); floorSizesRef.current=fs

        // 슬롯 설정 복원 (없으면 기본값 유지)
        if (d.slotCfgs) {
          setSlotCfgs(d.slotCfgs)
          slotCfgsRef.current=d.slotCfgs
        }

        // 프로젝트명 / 시나리오명 복원
        if (d.projectName) {
          setProjectName(d.projectName)
          localStorage.setItem('exsim_projectName', d.projectName)
        } else {
          // 파일명에서 프로젝트명 추출
          const nameFromFile=file.name.replace(/-\d{4}-\d{2}-\d{2}\.json$/, '').replace(/\.json$/, '')
          if (nameFromFile) { setProjectName(nameFromFile); localStorage.setItem('exsim_projectName', nameFromFile) }
        }
        if (d.scenarioName) {
          setScenarioName(d.scenarioName)
          localStorage.setItem('exsim_scenarioName', d.scenarioName)
        }

        // 런 히스토리 복원
        if (d.simLogs && Array.isArray(d.simLogs)) {
          setSimLogs(d.simLogs)
          try { localStorage.setItem('exsim_logs', JSON.stringify(d.simLogs)) } catch {}
        }

        heatAcc.current=d.zones.map(()=>0)
        initSkipStats()
        layoutAll(d.zones)
        drawBuild()
        setTab('build')
      } catch(err) {
        console.error('loadSettings error:', err)
        alert('파일을 읽을 수 없습니다.\n' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value=''
  }

  // ── 리포트 저장 (Excel) ──
  function saveReport() {
    const wb=XLSX.utils.book_new()
    const dateStr=new Date().toISOString().slice(0,10)
    const rd=reportDataRef.current

    const _slotResults=rd?rd.slotResults:slotResults
    const slotRows=[
      ['시간대','입장객(명)','스킵율(%)','평균체류(초)','몰입 강도','병목 건수'],
      ..._slotResults.map(r=>[r.label, r.visitors, r.skipRate, r.avgDwell, r.engIdx, r.bottlenecks])
    ]
    const ws1=XLSX.utils.aoa_to_sheet(slotRows)
    ws1['!cols']=[{wch:8},{wch:12},{wch:10},{wch:14},{wch:8},{wch:10}]
    XLSX.utils.book_append_sheet(wb,ws1,'시간대별 결과')

    const zoneRows=[
      ['구역명','Area','진입 수','체험 전환 수','전환율(%)','평균 대기(초)','스킵 건수','체험 건수','스킵율(%)','몰입 강도','누적 밀집도'],
    ]
    if (rd) {
      rd.zones.forEach(z=>{
        zoneRows.push([
          z.name, 'Area '+(z.floor+1),
          z.entries||0, z.engaged||0, z.convRate||0, z.avgWait||0,
          z.skipCount, z.expCount, z.skipRate,
          z.engIdx!==null?z.engIdx:'-',
          z.heatVal,
        ])
      })
    } else {
      zonesRef.current.forEach(z=>{
        const s=skipStats.current[`z${z.id}`]||{skip:0,exp:0}
        const ea=engAcc.current[`z${z.id}`]
        const zEnt=zoneEntriesRef.current[z.id]||0
        const zEng=zoneEngagedRef.current[z.id]||0
        const zWait=zoneWaitAccRef.current[z.id]||0
        zoneRows.push([
          z.name, 'Area '+((z.floor||0)+1),
          zEnt, zEng,
          zEnt>0?Math.round(zEng/zEnt*100):0,
          zEnt>0?Math.round(zWait/zEnt/1000):0,
          s.skip, s.exp,
          s.skip+s.exp>0?Math.round(s.skip/(s.skip+s.exp)*100):0,
          ea&&ea.count>0?parseFloat((ea.score/ea.count).toFixed(1)):'-',
          Math.round(heatAcc.current[z.id]||0),
        ])
      })
    }
    const ws2=XLSX.utils.aoa_to_sheet(zoneRows)
    ws2['!cols']=[{wch:14},{wch:6},{wch:10},{wch:12},{wch:10},{wch:12},{wch:10},{wch:10},{wch:10},{wch:8},{wch:12}]
    XLSX.utils.book_append_sheet(wb,ws2,'구역별 분석')

    const cfgRows=[
      ['시간대','총 관람객','개인(%)','소그룹(%)','학생단체(%)','기업단체(%)','일반단체(%)','스킵임계(초)','도슨트','투어간격(분)','투어규모'],
      ...SLOTS.map((label,i)=>{
        const c=slotCfgsRef.current[i]
        return [label,c.total,c.segs.individual,c.segs.smallGroup,c.segs.studentGroup,c.segs.corpGroup,c.segs.genGroup,c.skipThresh,c.docent.enabled?'ON':'OFF',c.docent.interval,c.docent.size]
      })
    ]
    const ws3=XLSX.utils.aoa_to_sheet(cfgRows)
    ws3['!cols']=[{wch:8},{wch:12},{wch:8},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:8},{wch:12},{wch:10}]
    XLSX.utils.book_append_sheet(wb,ws3,'운영 설정')

    XLSX.writeFile(wb,`exhibition-report-${dateStr}.xlsx`)
  }

  // ── 히트맵 구역 통계 ──
  function computeHeatZoneStats(snap) {
    const entriesData=snap?(snap.entries||{}):zoneEntriesRef.current
    const engagedData=snap?(snap.engaged||{}):zoneEngagedRef.current
    const waitData=snap?(snap.wait||{}):zoneWaitAccRef.current
    const heatData=snap?snap.heat:heatAcc.current
    // heat ratio 기준 — drawHeat 색상과 동일하게 판정
    const maxHeat=Math.max(...zonesRef.current.map(z=>heatData[z.id]||0),1)
    const stats=zonesRef.current.map(z=>{
      const entries=entriesData[z.id]||0
      const engaged=engagedData[z.id]||0
      const waitMs=waitData[z.id]||0
      const avgWait=entries>0?Math.round(waitMs/entries/1000):0
      const convRate=entries>0?Math.round(engaged/entries*100):0
      const heatVal=Math.round(heatData[z.id]||0)
      const ratio=heatVal/maxHeat
      const hasHeat=heatVal>0
      let statusKey=null
      if (avgWait>20)                             statusKey='bottleneck'
      else if (ratio>0.6&&avgWait>5)              statusKey='crowded'
      else if (hasHeat&&ratio<0.2)                statusKey='underused'
      else if (entries>0&&convRate>60&&avgWait<10) statusKey='efficient'
      return {id:z.id,name:z.name,floor:z.floor||0,entries,convRate,avgWait,heatVal,ratio,statusKey}
    })
    setHeatZoneStats(stats)
    return stats
  }

  // ── 스냅샷 시점 dispStats 갱신 (Analyze 탭 스탯바용) ──
  function updateDispStatsFromSnap(snap) {
    const entriesData = snap ? (snap.entries||{}) : zoneEntriesRef.current
    const engagedData = snap ? (snap.engaged||{}) : zoneEngagedRef.current
    const waitData    = snap ? (snap.wait||{})    : zoneWaitAccRef.current
    const heatData    = snap ? snap.heat          : heatAcc.current
    const skipData    = snap ? snap.skip          : skipStats.current

    // 관람 효율: 방문된 존 / 전체 존
    const totalZones = zonesRef.current.length
    const visitedZones = Object.entries(heatData).filter(([,v])=>v>0).length
    const flowEffNum = totalZones>0 ? Math.round(visitedZones/totalZones*100) : 0
    const flowEff    = totalZones>0 ? flowEffNum+'%' : '-'

    // 체험 전환율
    const totalEntries  = Object.values(entriesData).reduce((s,v)=>s+v,0)
    const totalEngaged  = Object.values(engagedData).reduce((s,v)=>s+v,0)
    const engRateNum    = totalEntries>0 ? Math.round(totalEngaged/totalEntries*100) : 0
    const engRate       = totalEntries>0 ? engRateNum+'%' : '-'

    // 혼잡도
    const totalWait     = Object.values(waitData).reduce((s,v)=>s+v,0)
    const congestionSec = totalEntries>0 ? Math.round(totalWait/totalEntries/1000) : 0
    const congestion    = congestionSec>0 ? congestionSec+'초' : '0초'

    // 스킵율
    const allSS  = Object.values(skipData)
    const totSkip= allSS.reduce((s,v)=>s+v.skip,0)
    const totExp = allSS.reduce((s,v)=>s+v.exp,0)
    const skipRateNum = totSkip+totExp>0 ? Math.round(totSkip/(totSkip+totExp)*100) : 0
    const skipRate    = skipRateNum+'%'

    // 병목 존 수
    const bottlenecksNum = zonesRef.current.filter(z=>{
      const e=entriesData[z.id]||0
      const w=waitData[z.id]||0
      return e>0 && Math.round(w/e/1000)>20
    }).length

    // 밀집도: 최다 방문 구역 기준 명/㎡ (누적 진입 수 / 구역 면적)
    const _snapArea = floorSizesRef.current.reduce((s,f)=>s+f.w*f.h, 0)
    const _peakDens = zonesRef.current.reduce((max, z) => {
      const d = (entriesData[z.id]||0) / Math.max(z.w*z.h, 1)
      return d > max ? d : max
    }, 0)
    const densityNum = _snapArea>0 ? +(_peakDens).toFixed(2) : 0
    const density = densityNum>0 ? densityNum.toFixed(2)+'명/㎡' : '-'

    // 슬롯 시점 레이블
    const snapLabel = snap ? `${snap.slotLabel} ${snap.pct}%` : null

    setDispStats(p=>({
      ...p,
      flowEff, flowEffNum,
      engRate, engRateNum,
      congestion, congestionSec,
      skipRate, skipRateNum,
      bottlenecks: bottlenecksNum+'건', bottlenecksNum,
      density, densityNum,
      totalVisitors: totalEntries,
      totalEngaged,
      snapLabel,
    }))
  }

  // ── 히트맵 ──
  function drawHeat() {
    const canvas=hCRef.current; if (!canvas) return
    const snap=heatScrubSnapRef.current
    const heatData=snap?snap.heat:heatAcc.current
    const skipData=snap?snap.skip:skipStats.current
    const DPR=window.devicePixelRatio||1
    const sz=floorSizesRef.current[viewFloorRef.current]||{w:20,h:14}
    const dynCH=Math.max(160,Math.min(600,Math.round(CW*sz.h/sz.w)))
    const cssW=fitCanvasWidth(canvas,dynCH)
    const cssH=Math.round(cssW*sz.h/sz.w)
    canvas.width=Math.round(cssW*DPR); canvas.height=Math.round(cssH*DPR)
    canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'
    const ctx=canvas.getContext('2d')
    const scale=cssW/CW*DPR
    ctx.scale(scale,scale)
    ctx.clearRect(0,0,CW,dynCH)
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad,pad,CW-pad*2,dynCH-pad*2,clipR); ctx.clip()

    // ── 1m 그리드 ──
    ;(()=>{
      const mPx=CW/sz.w
      ctx.save()
      ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=0.3
      for (let i=0;i<=sz.w;i++) { const x=Math.round(i*mPx*10)/10; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,dynCH);ctx.stroke() }
      for (let j=0;j<=sz.h;j++) { const y=Math.round(j*mPx*10)/10; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke() }
      ctx.strokeStyle='rgba(0,0,0,0.13)'; ctx.lineWidth=0.4
      for (let i=0;i<=sz.w;i+=5) { const x=Math.round(i*mPx*10)/10; ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,dynCH);ctx.stroke() }
      for (let j=0;j<=sz.h;j+=5) { const y=Math.round(j*mPx*10)/10; ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke() }
      ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.font='3.5px sans-serif'
      ctx.textAlign='left'; ctx.textBaseline='top'
      for (let i=1;i<sz.w;i++) { if (i%5===0) continue; ctx.fillText(`${i}`, i*mPx+1, pad+1) }
      for (let i=5;i<sz.w;i+=5) ctx.fillText(`${i}m`, i*mPx+1, pad+1)
      for (let j=1;j<sz.h;j++) { if (j%5===0) continue; ctx.fillText(`${j}`, pad+1, j*mPx+1) }
      for (let j=5;j<sz.h;j+=5) ctx.fillText(`${j}m`, pad+1, j*mPx+1)
      ctx.restore()
    })()

    const maxH=Math.max(...Object.values(heatData),1)
    const scaleX=CW/(sz.w*100)*0.5, scaleY=dynCH/(sz.h*100)*0.5
    const flZones=zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)

    const entriesData=snap?(snap.entries||{}):zoneEntriesRef.current
    const engagedData=snap?(snap.engaged||{}):zoneEngagedRef.current
    const waitData=snap?(snap.wait||{}):zoneWaitAccRef.current

    const sortedHeatZs=flZones.slice().sort((a,b)=>(a.order??0)-(b.order??0))
    sortedHeatZs.forEach((z,zi)=>{
      // 베이스 흰 배경 (Build 스타일과 동일)
      drawZoneShape(ctx, z, '#F7F9F8', null, 0)

      // heat ratio — 색상과 동일한 기준
      const ratio=(heatData[z.id]||0)/maxH
      let r2,g2,b2
      if (ratio<0.4) { r2=55+(230-55)*ratio/0.4; g2=138+(100-138)*ratio/0.4; b2=221+(30-221)*ratio/0.4 }
      else { r2=230+(220-230)*(ratio-0.4)/0.6; g2=100*(1-(ratio-0.4)/0.6); b2=30*(1-(ratio-0.4)/0.6) }
      drawZoneShape(ctx, z, `rgb(${Math.round(r2)},${Math.round(g2)},${Math.round(b2)})`, 'rgba(0,0,0,0.15)', 0.4, 0.18+ratio*0.68)

      // Zone name (번호 포함 — Build 스타일)
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='500 5px sans-serif'; ctx.textAlign='center'
      ctx.fillText(`${zi+1}. ${z.name}`,z.x+z.w/2,z.y+10)

      // Status detection — heat ratio 기준 (색상과 일치)
      const zEntries=entriesData[z.id]||0
      const zEngaged=engagedData[z.id]||0
      const zWaitMs=waitData[z.id]||0
      const zAvgWait=zEntries>0?zWaitMs/zEntries/1000:0
      const zConvRate=zEntries>0?zEngaged/zEntries*100:0
      const hasHeat=(heatData[z.id]||0)>0
      let statusLabel=null, statusColor=null
      if (zAvgWait>20)                              { statusLabel='● 병목'; statusColor='#DC2626' }
      else if (ratio>0.6&&zAvgWait>5)              { statusLabel='● 과밀'; statusColor='#D97706' }
      else if (hasHeat&&ratio<0.2)                  { statusLabel='● 저활용'; statusColor='#6B7280' }
      else if (zEntries>0&&zConvRate>60&&zAvgWait<10){ statusLabel='● 효율'; statusColor='#059669' }

      // Status label (top-right corner)
      if(statusLabel){
        ctx.font='bold 4px sans-serif'; ctx.textAlign='right'
        ctx.fillStyle=statusColor
        ctx.fillText(statusLabel,z.x+z.w-3,z.y+9)
        ctx.textAlign='left'
      }

      // Bottom stats
      ctx.font='4.5px sans-serif'; ctx.textAlign='center'
      ctx.fillStyle='rgba(0,0,0,0.38)'
      if(zEntries>0){
        ctx.fillText(`진입 ${zEntries}명 · 대기 ${Math.round(zAvgWait)}초`,z.x+z.w/2,z.y+z.h-8)
      } else {
        ctx.fillText(`누적 ${Math.round(heatData[z.id]||0)}`,z.x+z.w/2,z.y+z.h-8)
      }
      ctx.textAlign='left'
    })

    sortedHeatZs.forEach(z=>z.media.forEach(m=>{
      const ms=skipData[m.uid]||{skip:0,exp:0}
      const total=ms.skip+ms.exp
      const mr=total>0?Math.round(ms.skip/total*100):0
      const sc=mr>50?'#7C3AED':mr>20?'#D97706':'#059669'
      if (m.polyVerts?.length>=3) {
        ctx.save()
        ctx.beginPath()
        const cx2=m.polyVerts.reduce((s,v)=>s+v.x,0)/m.polyVerts.length
        const cy2=m.polyVerts.reduce((s,v)=>s+v.y,0)/m.polyVerts.length
        if (m.circleShape) {
          const r2=Math.hypot(m.polyVerts[0].x-cx2,m.polyVerts[0].y-cy2)
          ctx.arc(cx2,cy2,r2,0,Math.PI*2)
        } else {
          ctx.moveTo(m.polyVerts[0].x,m.polyVerts[0].y)
          m.polyVerts.forEach((v,i)=>{ if(i>0) ctx.lineTo(v.x,v.y) })
          ctx.closePath()
        }
        ctx.globalAlpha=0.72
        ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill()
        ctx.strokeStyle=sc; ctx.lineWidth=0.5
        ctx.setLineDash([1.5,1.5]); ctx.stroke(); ctx.setLineDash([])
        ctx.globalAlpha=1
        ctx.restore()
        return
      }
      if (m.px==null) return
      const fpW=Math.max(MS,(m.widthCm||100)*scaleX)
      const fpH=Math.max(MS,(m.heightCm||100)*scaleY)
      const fx=Math.max(z.x,m.px), fy=Math.max(z.y,m.py)
      const fw=Math.min(m.px+fpW,z.x+z.w)-fx
      const fh=Math.min(m.py+fpH,z.y+z.h)-fy
      if (fw<=0||fh<=0) return
      ctx.globalAlpha=0.72
      rr(ctx,fx,fy,fw,fh,3)
      ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill()
      ctx.strokeStyle=sc; ctx.lineWidth=0.5
      ctx.setLineDash([1.5,1.5]); ctx.stroke(); ctx.setLineDash([])
      ctx.globalAlpha=1
    }))

    sortedHeatZs.forEach(z=>z.media.forEach(m=>{
      const ms=skipData[m.uid]||{skip:0,exp:0}
      const total=ms.skip+ms.exp
      const mr=total>0?Math.round(ms.skip/total*100):0
      const bc=mr>50?'#7C3AED':mr>20?'#D97706':'#059669'
      let icx, icy
      if (m.polyVerts?.length>=3) {
        icx=m.polyVerts.reduce((s,v)=>s+v.x,0)/m.polyVerts.length
        icy=m.polyVerts.reduce((s,v)=>s+v.y,0)/m.polyVerts.length
        drawMIcon(ctx,m,icx-MS/2,icy-MS/2,drawHeat,MS,MS)
      } else {
        if (m.px==null) return
        const fpW=Math.max(MS,(m.widthCm||100)*scaleX)
        const fpH=Math.max(MS,(m.heightCm||100)*scaleY)
        const cW=Math.min(fpW, z.x+z.w-m.px)
        const cH=Math.min(fpH, z.y+z.h-m.py)
        drawMIcon(ctx,m,m.px,m.py,drawHeat,cW,cH)
        icx=m.px+cW/2; icy=m.py+cH/2
      }
      if (total>0) {
        const bx=icx, by=icy+MS/2+5
        ctx.globalAlpha=0.88
        ctx.fillStyle='rgba(255,255,255,0.9)'
        const tw=mr>9?7:5
        rr(ctx,bx-tw/2,by-3.5,tw,4.5,1.5)
        ctx.fill()
        ctx.globalAlpha=1
        ctx.font='bold 3.5px sans-serif'; ctx.textAlign='center'
        ctx.fillStyle=bc
        ctx.fillText(`${mr}%`, bx, by)
        ctx.textAlign='left'
      }
    }))
    // ── 존 분석 배지 (히트맵/종합/구역분석/미디어 모드) ──
    const mainV = heatMainViewRef.current
    if (mainV === 'heatmap' || mainV === 'zones' || mainV === 'media' || mainV === 'all') {
      const skipD = snap ? snap.skip : skipStats.current
      const maxHeat = Math.max(...sortedHeatZs.map(z => heatData[z.id]||0), 1)
      sortedHeatZs.forEach(z => {
        const ent  = (snap?snap.entries:zoneEntriesRef.current)[z.id]||0
        const eng  = (snap?snap.engaged:zoneEngagedRef.current)[z.id]||0
        const wt   = (snap?snap.wait:zoneWaitAccRef.current)[z.id]||0
        const conv = ent>0 ? Math.round(eng/ent*100) : 0
        const wait = ent>0 ? Math.round(wt/ent/1000) : 0
        const zss  = skipD[`z${z.id}`]||{skip:0,exp:0}
        const zsr  = zss.skip+zss.exp>0 ? Math.round(zss.skip/(zss.skip+zss.exp)*100) : 0
        const zMedia = z.media.filter(m => (skipD[m.uid]?.skip||0)+(skipD[m.uid]?.exp||0) > 0)
        const avgSkip = zMedia.length > 0
          ? Math.round(zMedia.reduce((s,m)=>{ const ms=skipD[m.uid]||{skip:0,exp:0}; return s+(ms.skip+ms.exp>0?ms.skip/(ms.skip+ms.exp)*100:0) }, 0)/zMedia.length)
          : 0
        const heatPct = Math.round((heatData[z.id]||0) / maxHeat * 100)
        const isBottleneck = wait > 20

        const drawBadge = (bx, by, bw, bh, rows) => {
          ctx.globalAlpha = 0.92
          ctx.fillStyle = 'rgba(12,12,12,0.75)'
          rr(ctx, bx, by, bw, bh, 3); ctx.fill()
          ctx.globalAlpha = 1
          rows.forEach((row, ri) => {
            const rowY   = by + 10 + ri * 16
            const rowLY  = by + 14 + ri * 16
            if (ri > 0) {
              ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5
              ctx.beginPath(); ctx.moveTo(bx+3, by+16*ri); ctx.lineTo(bx+bw-3, by+16*ri); ctx.stroke()
            }
            const cw = bw / row.length
            row.forEach((col, ci) => {
              const cx = bx + cw*ci + cw/2
              ctx.font='bold 3.5px sans-serif'; ctx.textAlign='center'
              ctx.fillStyle = col.c
              ctx.fillText(col.val, cx, rowY)
              ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font='2.8px sans-serif'
              ctx.fillText(col.label, cx, rowLY)
            })
          })
          ctx.textAlign = 'left'
        }

        const bw = z.w - 4, bx = z.x + 2

        if (mainV === 'heatmap') {
          // 밀집도: 단일 값
          const bh = 14
          drawBadge(bx, z.y+z.h-bh-2, bw, bh, [[
            { label:'밀집도', val:`${heatPct}%`, c: heatPct>70?'#f87171':heatPct>40?'#fbbf24':'#93c5fd' },
          ]])

        } else if (mainV === 'zones') {
          // 진입 | 체험 / 대기 | 병목 (2행 2열)
          const bh = 28
          drawBadge(bx, z.y+z.h-bh-2, bw, bh, [
            [
              { label:'진입', val:`${ent}명`, c:'#e2e8f0' },
              { label:'체험', val:`${eng}명`, c:conv>60?'#4ade80':conv>30?'#fbbf24':'#f87171' },
            ],
            [
              { label:'대기', val:`${wait}초`, c:wait>20?'#f87171':wait>10?'#fbbf24':'#4ade80' },
              { label:'병목', val:isBottleneck?'발생':'없음', c:isBottleneck?'#f87171':'#4ade80' },
            ],
          ])

        } else if (mainV === 'media') {
          // 미디어수 | 전환율 / 혼잡도 | 스킵율 (2행 2열)
          const bh = 28
          drawBadge(bx, z.y+z.h-bh-2, bw, bh, [
            [
              { label:'미디어', val:`${zMedia.length}개`, c:'#93c5fd' },
              { label:'전환율', val:`${conv}%`, c:conv>60?'#4ade80':conv>30?'#fbbf24':'#f87171' },
            ],
            [
              { label:'혼잡도', val:`${wait}초`, c:wait>20?'#f87171':wait>10?'#fbbf24':'#4ade80' },
              { label:'스킵율', val:`${zsr}%`, c:zsr>50?'#c084fc':zsr>20?'#fbbf24':'#4ade80' },
            ],
          ])

        } else { // 'all' - 진입/전환율 / 미디어/스킵율 (2행 2열)
          const bh = 28
          drawBadge(bx, z.y+z.h-bh-2, bw, bh, [
            [
              { label:'진입', val:`${ent}명`, c:'#e2e8f0' },
              { label:'전환율', val:`${conv}%`, c:conv>60?'#4ade80':conv>30?'#fbbf24':'#f87171' },
            ],
            [
              { label:'미디어', val:`${zMedia.length}개`, c:'#93c5fd' },
              { label:'스킵율', val:`${zsr}%`, c:zsr>50?'#c084fc':zsr>20?'#fbbf24':'#4ade80' },
            ],
          ])
        }
      })
    }

    // ── Footprint scale 레이블 (좌하단) ──
    ;(()=>{
      const sqm=sz.w*sz.h; const py=(sqm*0.3025).toFixed(1)
      const lbl=`□  Footprint scale: Area ${viewFloorRef.current+1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font='4px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.28)'
      ctx.textAlign='left'; ctx.textBaseline='bottom'
      ctx.fillText(lbl, 4, dynCH-4)
      ctx.restore()
    })()
    applyVT(canvas)
  }

  // ── 히트맵 캔버스 클릭 → 존 팝업 ──
  function onHeatCanvasClick(e) {
    const canvas = hCRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    // CSS 픽셀 → 캔버스 논리 좌표 (VT 적용)
    const vt = vtRef.current
    const scale = rect.width / CW
    const logicX = (cssX / scale - vt.x) / vt.scale
    const logicY = (cssY / scale - vt.y) / vt.scale
    const flZones = zonesRef.current.filter(z=>(z.floor||0)===viewFloorRef.current)
    const hit = flZones.find(z => logicX>=z.x && logicX<=z.x+z.w && logicY>=z.y && logicY<=z.y+z.h)
    if (hit) {
      setHeatPopupZone(prev =>
        prev?.zoneId === hit.id ? null
          : { zoneId: hit.id, x: e.clientX - rect.left + 8, y: e.clientY - rect.top - 60 }
      )
    } else {
      setHeatPopupZone(null)
    }
  }

  // ── 탭 전환 / 시뮬 완료 시 캔버스 그리기 ──
  useEffect(()=>{
    // display:none → visible 전환 후 레이아웃이 확정된 뒤 그려야 정확한 사이즈로 렌더됨
    setTimeout(()=>{
      if (tab==='build') drawBuild()
      else if (tab==='sim') drawSim()
      else if (tab==='heat') { computeHeatZoneStats(heatScrubSnapRef.current); drawHeat() }
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  useEffect(()=>{
    if (simStatus==='done') { computeHeatZoneStats(null); drawHeat() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simStatus])
  useEffect(()=>{
    const snap=heatTimeline[heatScrubIdx]
    heatScrubSnapRef.current=(snap&&heatScrubIdx<heatTimeline.length-1)?snap:null
    computeHeatZoneStats(heatScrubSnapRef.current)
    drawHeat()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatScrubIdx, heatTimeline])

  // ── 마운트: 캔버스 초기화 ──
  useEffect(()=>{
    [bCRef,sCRef,hCRef].forEach(r=>{ if(r.current){r.current.width=CW;r.current.height=CH} })
    if (rCRef.current) { rCRef.current.width=CW; rCRef.current.height=100 }
    layoutAll(zonesRef.current)
    drawBuild()
    drawSim()
    initSkipStats()
    initHeat()
    return ()=>{ cancelAnimationFrame(rafRef.current); rptChart.current?.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── zones / selZoneId / viewFloor 변경 시 캔버스 재그리기 ──
  useEffect(()=>{
    viewFloorRef.current=viewFloor
    drawBuild()
    if (tab==='heat') drawHeat()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFloor, drawBuild])
  useEffect(()=>{ drawBuild() }, [zones, selZoneId, drawBuild])
  // zones가 변경될 때마다 entry/exit 위치를 존 경계 안으로 보정
  useEffect(()=>{
    let changed=false
    zonesRef.current.forEach(z=>{
      const pad=8
      if (z.entryPos) {
        const nx=Math.max(z.x+pad,Math.min(z.x+z.w-pad,z.entryPos.x))
        const ny=Math.max(z.y+pad,Math.min(z.y+z.h-pad,z.entryPos.y))
        if (nx!==z.entryPos.x||ny!==z.entryPos.y){z.entryPos={x:nx,y:ny};changed=true}
      }
      if (z.returnPos) {
        const nx=Math.max(z.x+pad,Math.min(z.x+z.w-pad,z.returnPos.x))
        const ny=Math.max(z.y+pad,Math.min(z.y+z.h-pad,z.returnPos.y))
        if (nx!==z.returnPos.x||ny!==z.returnPos.y){z.returnPos={x:nx,y:ny};changed=true}
      }
      if (z.exitPos) {
        const nx=Math.max(z.x+pad,Math.min(z.x+z.w-pad,z.exitPos.x))
        const ny=Math.max(z.y+pad,Math.min(z.y+z.h-pad,z.exitPos.y))
        if (nx!==z.exitPos.x||ny!==z.exitPos.y){z.exitPos={x:nx,y:ny};changed=true}
      }
    })
    if (changed) setZones(clone(zonesRef.current))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones])

  // localStorage 복원 (프로젝트 있을 때 마운트 시)
  useEffect(()=>{
    if (!projectName) { isRestoredRef.current=true; return }
    try {
      const raw=localStorage.getItem('exsim_data')
      if (raw) {
        const d=JSON.parse(raw)
        if (d.zones&&d.slotCfgs) {
          clampDoors(d.zones)
          zonesRef.current=d.zones; setZones(clone(d.zones))
          setSlotCfgs(d.slotCfgs); slotCfgsRef.current=d.slotCfgs
          const fc=d.floorCount||1
          setFloorCount(fc); setViewFloor(0); viewFloorRef.current=0
          const fs=d.floorSizes||Array.from({length:fc},()=>({w:20,h:14}))
          setFloorSizes(fs); floorSizesRef.current=fs
        }
      }
    } catch {}
    isRestoredRef.current=true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 프로젝트 생성 함수 ──
  function createProject(name) {
    const trimmed=name.trim()
    if (!trimmed) return
    localStorage.removeItem('exsim_data')
    zonesRef.current=clone(INIT_ZONES); setZones(clone(INIT_ZONES))
    setFloorCount(1); setFloorSizes([{w:20,h:14}]); floorSizesRef.current=[{w:20,h:14}]
    setViewFloor(0); viewFloorRef.current=0
    vtRef.current={scale:1,x:0,y:0}  // 뷰 초기화
    localStorage.setItem('exsim_projectName', trimmed)
    localStorage.setItem('exsim_scenarioName', '시나리오 1')
    setScenarioName('시나리오 1')
    setProjectName(trimmed)
    // 캔버스 마운트 후 초기 draw (React 렌더 완료 후 실행)
    setTimeout(()=>{ drawBuild(); drawSim() }, 0)
  }

  // ═══════════════════════════════════════════════
  // 렌더
  // ═══════════════════════════════════════════════

  // ── 프로젝트 생성 화면 ──
  if (!projectName) return (
    <div className="project-create-screen">
      <div className="project-create-card">
        <div className="project-create-logo">AION mark1</div>
        <h2 className="project-create-title">새 프로젝트 만들기</h2>
        <p className="project-create-desc">전시관 시뮬레이션을 위한 프로젝트 이름을 입력하세요</p>
        <input
          className="project-create-input"
          type="text"
          placeholder="예: 2025 서울 아트페어"
          value={projectInput}
          onChange={e=>setProjectInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') createProject(projectInput) }}
          autoFocus
        />
        <button
          className="project-create-btn"
          disabled={!projectInput.trim()}
          onClick={()=>createProject(projectInput)}
        >프로젝트 생성</button>
        <div className="project-create-or">또는</div>
        <button className="project-load-btn" onClick={()=>{
          const inp=document.createElement('input')
          inp.type='file'; inp.accept='.json'
          inp.onchange=e=>{
            const file=e.target.files[0]; if(!file) return
            const reader=new FileReader()
            reader.onload=ev=>{
              try {
                const d=JSON.parse(ev.target.result)
                if(!d.zones||!d.slotCfgs){alert('올바른 설정 파일이 아닙니다.');return}
                const name=file.name.replace(/-\d{4}-\d{2}-\d{2}\.json$/,'').replace('.json','')
                clampDoors(d.zones)
                zonesRef.current=d.zones; setZones(clone(d.zones))
                setSlotCfgs(d.slotCfgs); slotCfgsRef.current=d.slotCfgs
                const fc=d.floorCount||1
                setFloorCount(fc); setViewFloor(0); viewFloorRef.current=0
                const fs=d.floorSizes||Array.from({length:fc},()=>({w:20,h:14}))
                setFloorSizes(fs); floorSizesRef.current=fs
                if (Array.isArray(d.simLogs)) {
                  setSimLogs(d.simLogs)
                  try { localStorage.setItem('exsim_logs', JSON.stringify(d.simLogs)) } catch {}
                }
                localStorage.setItem('exsim_projectName',name)
                localStorage.setItem('exsim_data',JSON.stringify(d))
                setProjectName(name)
              } catch { alert('파일을 읽을 수 없습니다.') }
            }
            reader.readAsText(file)
          }
          inp.click()
        }}>기존 프로젝트 불러오기</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      <Header
        projectName={projectName}
        setProjectName={setProjectName}
        scenarioName={scenarioName}
        setScenarioName={setScenarioName}
        tab={tab}
        setTab={setTab}
        saveSettings={saveSettings}
        loadSettings={loadSettings}
      />
      <div className="canvas-stage">
        <StatBar tab={tab} />

        {/* 모든 패널 항상 마운트 — 각 패널이 display:none으로 자체 가시성 제어 */}
        <SetupPanel
          tab={tab}
          bCRef={bCRef}
          onBMD={onBMD} onBMM={onBMM} onBMU={onBMU} onBCC={onBCC} onBDbl={onBDbl}
          addZone={addZone} removeZone={removeZone}
          startPolyDraw={startPolyDraw} cancelPolyDraw={cancelPolyDraw} polyDrawing={polyDrawing}
          startMediaPolyDraw={startMediaPolyDraw} clearMediaPoly={clearMediaPoly} createRectMediaPoly={createRectMediaPoly} createCircleMediaPoly={createCircleMediaPoly} mediaPolyDrawing={mediaPolyDrawing} cancelMediaPolyDraw={cancelMediaPolyDraw}
          enterMediaPolyEdit={enterMediaPolyEdit} exitMediaPolyEdit={exitMediaPolyEdit} mediaPolyEditingUid={mediaPolyEditingUid}
          addFloor={addFloor} removeFloor={removeFloor}
          moveZoneOrder={moveZoneOrder}
          renameZone={renameZone}
          drawBuild={drawBuild} drawSim={drawSim} drawHeat={drawHeat}
          palDragRef={palDragRef}
          saveZoneName={saveZoneName}
          updateZone={updateZone}
          updateMedia={updateMedia}
          moveMedia={moveMedia}
          removeMedia={removeMedia}
          onZoomIn={()=>doZoom(1.2)}
          onZoomOut={()=>doZoom(1/1.2)}
          onResetView={resetVT}
          panMode={panMode}
          onTogglePan={togglePanMode}
          canUndo={canUndo} canRedo={canRedo}
          onUndo={performUndo} onRedo={performRedo}
        />
        <SimPanel
          tab={tab}
          sCRef={sCRef}
          startSim={startSim}
          pauseSim={pauseSim}
          stopSim={stopSim}
          onZoomIn={()=>doZoom(1.2)}
          onZoomOut={()=>doZoom(1/1.2)}
          onResetView={resetVT}
          panMode={panMode}
          onTogglePan={togglePanMode}
          onAnalyzeLog={log => {
            // reportData 세팅 (로그 메타 포함)
            const runNo = simLogs.findIndex(l => l.id === log.id)
            setReportData({
              zones: log.zones||[],
              range: log.range||{label:log.rangeLabel},
              slotResults: log.results||[],
              flowEff: log.flowEff,
              engRate: log.engRate,
              avgWait: log.avgWait,
              _logId: log.id,
              _project: log.project,
              _scenario: log.scenario,
              _ts: log.ts,
              _rangeLabel: log.rangeLabel,
              _runNo: runNo >= 0 ? simLogs.length - runNo : null,
            })
            // 히트맵 타임라인 복원
            const tl = log.heatTimeline || []
            heatSnapshotsRef.current = tl
            heatScrubSnapRef.current = null
            setHeatTimeline(tl)
            setHeatScrubIdx(tl.length > 0 ? tl.length - 1 : 0)
            // 히트맵 재계산
            setTimeout(() => {
              computeHeatZoneStats(null)
              updateDispStatsFromSnap(null)
              drawHeat()
            }, 0)
            setTab('heat')
          }}
        />
        <HeatmapPanel
          tab={tab}
          hCRef={hCRef}
          heatScrubSnapRef={heatScrubSnapRef}
          redrawHeat={(snap) => { computeHeatZoneStats(snap); updateDispStatsFromSnap(snap); drawHeat() }}
          onZoomIn={()=>doZoom(1.2)}
          onZoomOut={()=>doZoom(1/1.2)}
          onResetView={resetVT}
          panMode={panMode}
          onTogglePan={togglePanMode}
          onCanvasClick={onHeatCanvasClick}
        />
        <ResultPanel
          tab={tab}
          saveReport={saveReport}
        />
      </div>

      {/* ── 확인 모달 ── */}
      {confirmModal.visible&&(
        <div className="modal-backdrop" onClick={()=>setConfirmModal(p=>({...p,visible:false}))}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{confirmModal.title}</div>
            <div className="modal-message">{confirmModal.message}</div>
            <div className="modal-btns">
              <button className="modal-btn-cancel"
                onClick={()=>setConfirmModal(p=>({...p,visible:false}))}>취소</button>
              <button className="modal-btn-confirm"
                onClick={()=>{confirmModal.onConfirm?.();setConfirmModal(p=>({...p,visible:false}))}}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
