import { useCallback } from 'react'
import { CW, CH, MS } from '../constants'
import { clone, zoneAt, mediaAt, layoutAll, sc2, ptInPoly } from '../utils'
import {
  getLPoly, getLCutHandle, shiftSnap, getPolyBounds,
  closestPtOnSeg, clampToZonePoly,
  polysOverlap, polyRectOverlap,
} from '../utils/geometry'

export function useBuildCanvasEvents({
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
}) {
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

  return { onBMD, onBMM, onBMU, onBCC, onBDbl }
}
