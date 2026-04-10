import { CW } from '../constants'
import { clone, layoutAll } from '../utils'
import { getPolyBounds } from '../utils/geometry'

export function useZoneEditor({
  // state values
  simStatus,
  viewFloor,
  floorCount,
  // state setters
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
  // refs
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
  // callbacks
  drawBuild,
  // editZone state (for saveZoneName)
  editZone,
}) {
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

  function saveZoneName() {
    if (!editZone) return
    const z=zonesRef.current.find(z=>z.id===editZone.id)
    if (z) z.name=editZone.name
    setZones(clone(zonesRef.current))
    setEditZone(null)
    drawBuild()
  }

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

  return {
    saveZoneName,
    removeMedia,
    moveMedia,
    renameZone,
    findFreePos,
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
  }
}
