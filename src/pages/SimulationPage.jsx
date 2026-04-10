import { useRef, useEffect, useCallback, useState } from 'react'
import * as XLSX from 'xlsx'

import useSimStore from '../store/simulationStore'
import {
  INIT_ZONES,
  CW, CH, MS,
  SLOTS, SLOT_DEF_TOTALS, makeSlotCfg,
} from '../constants'
import {
  clone, uid, zCap,
  zoneAt, mediaAt, layoutAll,
  sc2, ptInPoly,
} from '../utils'
import {
  getLPoly, getLCutHandle, shiftSnap, getPolyBounds,
  closestPtOnSeg, clampToZonePoly,
  polysOverlap, polyRectOverlap,
} from '../utils/geometry'
import { useZoneEditor } from '../hooks/useZoneEditor'
import { useCanvasDraw } from '../hooks/useCanvasDraw'
import { useSimEngine } from '../hooks/useSimEngine'
import { useBuildCanvasEvents } from '../hooks/useBuildCanvasEvents'
import { useHeatStats } from '../hooks/useHeatStats'
import { useProjectIO } from '../hooks/useProjectIO'
import { useUndoRedo } from '../hooks/useUndoRedo'

import Header      from '../components/layout/Header'
import StatBar     from '../components/layout/StatBar'
import SetupPanel  from '../components/panels/SetupPanel'
import SimPanel    from '../components/panels/SimPanel'
import HeatmapPanel from '../components/panels/HeatmapPanel'
import ResultPanel  from '../components/panels/ResultPanel'

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  const confirmRef = useRef(null)
  const cancelRef  = useRef(null)

  // 열릴 때 확인 버튼에 포커스
  useEffect(() => { confirmRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        document.activeElement === cancelRef.current ? onCancel() : onConfirm()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        if (document.activeElement === confirmRef.current) cancelRef.current?.focus()
        else confirmRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onConfirm, onCancel])

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-message">{message}</div>
        <div className="modal-btns">
          <button ref={cancelRef}  className="modal-btn-cancel"  onClick={onCancel}>취소</button>
          <button ref={confirmRef} className="modal-btn-confirm" onClick={onConfirm}>삭제</button>
        </div>
      </div>
    </div>
  )
}

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

  // ── 뷰 변환 함수 ──
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
    const activeCanvas = [bCRef, sCRef, hCRef].find(ref => ref.current?.offsetParent)?.current
    const parent = activeCanvas?.parentElement
    const pRect = parent?.getBoundingClientRect()
    const cW = activeCanvas?.clientWidth ?? 0
    const cH = activeCanvas?.clientHeight ?? 0
    const pW = pRect?.width ?? window.innerWidth
    const natLeft  = (pW - cW) / 2
    const natViewLeft = (pRect?.left ?? 0) + natLeft
    const natViewTop  = pRect?.top ?? 52
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
  // Canvas draw helpers (useCanvasDraw hook)
  // ═══════════════════════════════════════════════

  const {
    drawBuild,
    drawSim,
    drawHeat,
  } = useCanvasDraw({
    bCRef, sCRef, hCRef,
    zonesRef, agentsRef, flashRef,
    vtRef, viewFloorRef, floorSizesRef, dynCHRef,
    selRef, heatScrubSnapRef, heatMainViewRef,
    skipStats, engAcc,
    zoneEntriesRef, zoneEngagedRef, zoneWaitAccRef,
    heatAcc,
    cvDrag, mxRef, myRef,
    zoneDragRef, doorDragRef,
    circularFlowRef, polyDrawRef, mediaPolyDrawRef, mediaPolyEditRef,
    shiftRef,
    applyVT,
  })

  // ── 언두/리두 ──
  const { performUndo, performRedo, performUndoRef, performRedoRef, snapshotUndoRef } = useUndoRedo({
    zonesRef, floorCountRef, floorSizesRef, selRef,
    undoStackRef, redoStackRef,
    setZones, setFloorCount, setFloorSizes, setSelZoneId,
    setCanUndo, setCanRedo,
    drawBuild,
  })

  // ═══════════════════════════════════════════════
  // Build 캔버스 이벤트 (useBuildCanvasEvents hook)
  // ═══════════════════════════════════════════════

  const { onBMD, onBMM, onBMU, onBCC, onBDbl } = useBuildCanvasEvents({
    bCRef, sCRef, hCRef,
    zonesRef, viewFloorRef, floorSizesRef, dynCHRef, selRef,
    cvDrag, cvOff, didDrag,
    panModeRef, panDragRef, vtRef,
    zoneDragRef, doorDragRef, circularFlowRef,
    polyDrawRef, mediaPolyDrawRef, mediaPolyEditRef,
    vertexDragRef, mediaPolyVtxDragRef,
    shiftRef, mxRef, myRef,
    snapshotUndoRef,
    drawBuild, applyVT,
    commitPolygon, commitMediaPoly,
    setSelZoneId, setEditingZoneName, setActiveMediaUid, setEditZone, setZones,
  })

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
  // 존/미디어 편집 훅 (hooks/useZoneEditor.js)
  // ═══════════════════════════════════════════════

  const {
    saveZoneName,
    removeMedia,
    moveMedia,
    renameZone,
    commitPolygon,
    startPolyDraw,
    cancelPolyDraw,
    startMediaPolyDraw,
    cancelMediaPolyDraw,
    commitMediaPoly,
    createRectMediaPoly,
    createCircleMediaPoly,
    clearMediaPoly,
    enterMediaPolyEdit,
    exitMediaPolyEdit,
    addZone,
    removeZone,
    moveZoneOrder,
    updateZone,
    updateMedia,
    addFloor,
    removeFloor,
  } = useZoneEditor({
    simStatus,
    viewFloor,
    floorCount,
    setZones,
    setSelZoneId,
    setEditZone,
    setPolyDrawing,
    setMediaPolyDrawing,
    setMediaPolyEditingUid,
    setFloorCount,
    setFloorSizes,
    setViewFloor,
    setConfirmModal,
    setCanUndo,
    setCanRedo,
    zonesRef,
    polyDrawRef,
    mediaPolyDrawRef,
    mediaPolyEditRef,
    floorSizesRef,
    floorCountRef,
    viewFloorRef,
    dynCHRef,
    selRef,
    bCRef,
    heatAcc,
    skipStats,
    engAcc,
    undoStackRef,
    redoStackRef,
    drawBuild,
    editZone,
  })

  // ═══════════════════════════════════════════════
  // 시뮬레이션 엔진 (useSimEngine hook)
  // ═══════════════════════════════════════════════

  const {
    initSkipStats,
    initHeat,
    startSim,
    pauseSim,
    stopSim,
  } = useSimEngine({
    agentsRef, simTimeRef, spawnTimer, tourTimer,
    docentCfgRef, slotCfgsRef, simRangeRef,
    runningSlotRef, totalSpawnedRef, cumulativeVisitorsRef,
    heatAcc, skipStats, engAcc,
    bnRef, dwellTotal, exitedCnt,
    runRef, pausedRef, lastTRef, rafRef, flashRef,
    heatSnapshotsRef, lastSnapIdxRef,
    speedRef, slotRef, flowRef, circularFlowRef,
    cfgRef, zonesRef,
    zoneEntriesRef, zoneEngagedRef, zoneWaitAccRef,
    floorSizesRef, dynCHRef, heatScrubSnapRef,
    drawSim,
    setSimStatus, setSlotResults, setDispStats, setSkipTable,
    setRunningSlot, setSlot,
    setHeatTimeline, setHeatScrubIdx,
    setReportData, setSimLogs,
    projectName, scenarioName,
  })

  // ── 히트맵 통계 훅 ──
  const { computeHeatZoneStats, updateDispStatsFromSnap } = useHeatStats({
    zonesRef, floorSizesRef,
    zoneEntriesRef, zoneEngagedRef, zoneWaitAccRef,
    heatAcc, skipStats,
    setHeatZoneStats, setDispStats,
  })

  // ── 프로젝트 IO 훅 ──
  const { saveSettings, loadSettings, saveReport, onAnalyzeLog } = useProjectIO({
    projectName, scenarioName,
    zonesRef, slotCfgsRef, floorSizesRef, floorCountRef,
    heatAcc, skipStats, engAcc,
    zoneEntriesRef, zoneEngagedRef, zoneWaitAccRef,
    heatSnapshotsRef, heatScrubSnapRef,
    reportDataRef, slotResults, simLogs,
    initSkipStats,
    setZones, setSlotCfgs, setFloorCount, setFloorSizes,
    setViewFloor, setProjectName, setScenarioName,
    setSimLogs, setSimStatus, setHeatTimeline, setHeatScrubIdx,
    setTab, setDispStats, setReportData, setHeatZoneStats,
    drawBuild, drawHeat,
    computeHeatZoneStats, updateDispStatsFromSnap,
    viewFloorRef,
  })


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
          onAnalyzeLog={onAnalyzeLog}
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
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={()=>{confirmModal.onConfirm?.();setConfirmModal(p=>({...p,visible:false}))}}
          onCancel={()=>setConfirmModal(p=>({...p,visible:false}))}
        />
      )}
    </div>
  )
}
