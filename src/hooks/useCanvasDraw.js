import { useCallback, useRef } from 'react'
import { CW, CH, MS, VISITOR_TYPES } from '../constants'
import { zCap, zDwell, busyCount, drawMIcon, rr } from '../utils'
import { getLPoly, getLCutHandle, shiftSnap } from '../utils/geometry'

export function useCanvasDraw({
  bCRef,
  sCRef,
  hCRef,
  zonesRef,
  agentsRef,
  flashRef,
  vtRef,
  viewFloorRef,
  floorSizesRef,
  dynCHRef,
  selRef,
  heatScrubSnapRef,
  heatMainViewRef,
  skipStats,
  engAcc,
  zoneEntriesRef,
  zoneEngagedRef,
  zoneWaitAccRef,
  heatAcc,
  // drag refs (needed for build canvas drawing)
  cvDrag,
  mxRef,
  myRef,
  zoneDragRef,
  doorDragRef,
  circularFlowRef,
  polyDrawRef,
  mediaPolyDrawRef,
  mediaPolyEditRef,
  shiftRef,
  applyVT,
}) {
  // self-references for passing as redraw callback to drawMIcon
  const drawBuildRef = useRef(null)
  const drawSimRef   = useRef(null)
  const drawHeatRef  = useRef(null)

  function fitCanvasWidth(canvas, dynCH) {
    const p = canvas.closest('.cw') || canvas.parentElement
    if (!p) return CW
    const cW = p.clientWidth || CW
    const cH = p.clientHeight || dynCH
    const aspect = dynCH / CW
    return cH / cW < aspect ? Math.floor(cH / aspect) : cW
  }

  // ── 입구/출구 아이콘 그리기 (캔버스용) ──
  function drawDoorIcon(ctx, pos, type, isSelected) {
    const isEntry = type === 'entry'
    const color = isEntry ? '#4A8A72' : '#8A6060'
    const label = isEntry ? 'ENTRY' : 'EXIT'
    ctx.font = 'bold 3.8px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const tw = ctx.measureText(label).width + 5, th = 6.5
    ctx.fillStyle = isEntry ? 'rgba(74,138,114,0.12)' : 'rgba(138,96,96,0.12)'
    ctx.fillRect(pos.x - tw / 2, pos.y - th / 2, tw, th)
    ctx.fillStyle = color
    ctx.fillText(label, pos.x, pos.y + 0.3)
    if (isSelected) {
      ctx.beginPath(); ctx.arc(pos.x, pos.y - th / 2 - 1.5, 1, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  }

  // 순환형 전용: ENTRY+EXIT 통합 아이콘
  function drawCircularDoorIcon(ctx, pos, isSelected) {
    ctx.font = 'bold 3.8px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const label = 'ENTRY/EXIT'
    const tw = ctx.measureText(label).width + 6, th = 6.5
    const bx = pos.x - tw / 2, by = pos.y - th / 2
    ctx.fillStyle = 'rgba(90,143,168,0.12)'
    ctx.fillRect(bx, by, tw, th)
    ctx.strokeStyle = 'rgba(90,143,168,0.3)'; ctx.lineWidth = 0.4
    ctx.strokeRect(bx, by, tw, th)
    ctx.fillStyle = '#5A8FA8'
    ctx.fillText(label, pos.x, pos.y + 0.3)
    ctx.restore()
    if (isSelected) {
      ctx.beginPath(); ctx.arc(pos.x, by - 1.5, 1, 0, Math.PI * 2)
      ctx.fillStyle = '#5A8FA8'; ctx.fill()
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  }

  function drawZoneShape(ctx, z, fillStyle, strokeStyle, lineWidth, alpha = 1) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    if (z.shape === 'ellipse') {
      ctx.ellipse(z.x + z.w / 2, z.y + z.h / 2, z.w / 2, z.h / 2, 0, 0, Math.PI * 2)
    } else if (z.shape === 'L') {
      const pts = getLPoly(z)
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath()
    } else if (z.shape === 'polygon' && z.vertices?.length >= 3) {
      z.vertices.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath()
    } else {
      ctx.rect(z.x, z.y, z.w, z.h)
    }
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill() }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth; ctx.stroke() }
    ctx.restore()
  }

  // ── Build 캔버스 그리기 ──
  const drawBuild = useCallback(() => {
    const canvas = bCRef.current; if (!canvas) return
    const DPR = window.devicePixelRatio || 1
    const sz = floorSizesRef.current[viewFloorRef.current] || { w: 20, h: 14 }
    const dynCH = Math.max(160, Math.min(600, Math.round(CW * sz.h / sz.w)))
    dynCHRef.current = dynCH
    const cssW = fitCanvasWidth(canvas, dynCH)
    const cssH = Math.round(cssW * sz.h / sz.w)
    canvas.width = Math.round(cssW * DPR); canvas.height = Math.round(cssH * DPR)
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'
    const ctx = canvas.getContext('2d')
    const scale = cssW / CW * DPR
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, CW, dynCH)
    // CSS border-radius(10px)에 맞춰 캔버스 콘텐츠를 클리핑
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad, pad, CW - pad * 2, dynCH - pad * 2, clipR); ctx.clip()

    // ── 1m 그리드 ──
    ;(() => {
      const mPx = CW / sz.w
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'
      ctx.lineWidth = 0.3
      for (let i = 0; i <= sz.w; i++) {
        const x = Math.round(i * mPx * 10) / 10
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke()
      }
      for (let j = 0; j <= sz.h; j++) {
        const y = Math.round(j * mPx * 10) / 10
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'
      ctx.lineWidth = 0.4
      for (let i = 0; i <= sz.w; i += 5) {
        const x = Math.round(i * mPx * 10) / 10
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke()
      }
      for (let j = 0; j <= sz.h; j += 5) {
        const y = Math.round(j * mPx * 10) / 10
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.font = '3.5px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      for (let i = 1; i < sz.w; i++) {
        if (i % 5 === 0) continue
        ctx.fillText(`${i}`, i * mPx + 1, pad + 1)
      }
      for (let i = 5; i < sz.w; i += 5) ctx.fillText(`${i}m`, i * mPx + 1, pad + 1)
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      for (let j = 1; j < sz.h; j++) {
        if (j % 5 === 0) continue
        ctx.fillText(`${j}`, pad + 1, j * mPx + 1)
      }
      for (let j = 5; j < sz.h; j += 5) ctx.fillText(`${j}m`, pad + 1, j * mPx + 1)
      ctx.restore()
    })()

    const zs = zonesRef.current.filter(z => (z.floor || 0) === viewFloorRef.current)
    const selId = selRef.current

    const scaleX = CW / (sz.w * 100) * 0.5, scaleY = dynCH / (sz.h * 100) * 0.5

    const sortedZs = zs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    // 드래그 중 겹침 감지
    const dragZ = zoneDragRef.current?.zone
    const dragOverlap = dragZ ? zs.some(z => z.id !== dragZ.id &&
      !(dragZ.x + dragZ.w <= z.x || dragZ.x >= z.x + z.w || dragZ.y + dragZ.h <= z.y || dragZ.y >= z.y + z.h)) : false

    sortedZs.forEach((z, zi) => {
      const isSel = selId === z.id, hasMed = z.media.length > 0
      const isEntry = false
      const isDragging = dragZ && z.id === dragZ.id
      const isConflict = isDragging && dragOverlap
      drawZoneShape(ctx, z, '#F7F9F8', isConflict ? '#DC2626' : isSel ? '#5A8FA8' : 'rgba(0,0,0,0.15)', isConflict ? 0.8 : isSel ? 0.7 : 0.4)
      const orderNum = zi + 1
      ctx.fillStyle = isSel ? '#0C447C' : 'rgba(0,0,0,0.5)'
      ctx.font = '500 5px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`${orderNum}. ${z.name}`, z.x + z.w / 2, z.y + 10)
      if (isEntry) {
        ctx.font = 'bold 4px sans-serif'
        const label = circularFlowRef.current ? 'ENTRY/EXIT' : 'ENTRY'
        const bw = label === 'ENTRY/EXIT' ? 26 : 16, bh = 6, bx = z.x + 4, by = z.y + 4
        ctx.fillStyle = 'rgba(34,197,94,0.15)'; ctx.fillRect(bx, by, bw, bh)
        ctx.fillStyle = '#15803D'; ctx.fillText(label, bx + bw / 2, by + 4.5)
      }
      if (!hasMed) {
        ctx.font = '5px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.2)'
        ctx.fillText('Drag to add', z.x + z.w / 2, z.y + z.h / 2 + 2)
      } else {
        ctx.font = '5px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.28)'
        ctx.fillText(`${zCap(z)}인·${zDwell(z)}초`, z.x + z.w / 2, z.y + z.h - 8)
      }
      ctx.textAlign = 'left'
    })

    // ── 존별 ENTRY/EXIT 레이블 그리기 ──
    const isCircular = circularFlowRef.current
    const sortedForDoor = zs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const firstZoneId = sortedForDoor[0]?.id
    zs.forEach(z => {
      const selDoor = doorDragRef.current
      const isFirst = isCircular && z.id === firstZoneId
      if (isFirst) {
        if (z.entryPos) {
          const isSel = selDoor && selDoor.zoneId === z.id && selDoor.type === 'entry'
          drawCircularDoorIcon(ctx, z.entryPos, isSel)
        }
        if (z.returnPos) {
          const isSel = selDoor && selDoor.zoneId === z.id && selDoor.type === 'return'
          drawDoorIcon(ctx, z.returnPos, 'entry', isSel)
        }
        if (z.exitPos) {
          const isSel = selDoor && selDoor.zoneId === z.id && selDoor.type === 'exit'
          drawDoorIcon(ctx, z.exitPos, 'exit', isSel)
        }
      } else {
        if (z.entryPos) {
          const isSel = selDoor && selDoor.zoneId === z.id && selDoor.type === 'entry'
          drawDoorIcon(ctx, z.entryPos, 'entry', isSel)
        }
        if (z.exitPos) {
          const isSel = selDoor && selDoor.zoneId === z.id && selDoor.type === 'exit'
          drawDoorIcon(ctx, z.exitPos, 'exit', isSel)
        }
      }
    })

    if (selId !== null) {
      const sz2 = zs.find(z => z.id === selId)
      if (sz2) {
        if (sz2.shape === 'polygon' && sz2.vertices) {
          sz2.vertices.forEach(v => {
            ctx.beginPath(); ctx.arc(v.x, v.y, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'; ctx.fill()
            ctx.strokeStyle = '#E07040'; ctx.lineWidth = 0.5; ctx.stroke()
          })
        } else {
          const hpts = [{ x: sz2.x, y: sz2.y }, { x: sz2.x + sz2.w, y: sz2.y }, { x: sz2.x + sz2.w, y: sz2.y + sz2.h }, { x: sz2.x, y: sz2.y + sz2.h }]
          hpts.forEach(h => {
            ctx.beginPath(); ctx.arc(h.x, h.y, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'; ctx.fill()
            ctx.strokeStyle = '#5A8FA8'; ctx.lineWidth = 0.5; ctx.stroke()
          })
          if (sz2.shape === 'L') {
            const ch = getLCutHandle(sz2)
            ctx.beginPath(); ctx.arc(ch.x, ch.y, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = '#fff'; ctx.fill()
            ctx.strokeStyle = '#E07040'; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
    }

    zs.forEach(z => z.media.forEach(m => {
      if (cvDrag.current && cvDrag.current.m.uid === m.uid) return
      const lvl = m.engagementLevel || 3
      if (m.polyVerts?.length >= 3) {
        const isEditing = mediaPolyEditRef.current === m.uid
        const cx2 = m.polyVerts.reduce((s, v) => s + v.x, 0) / m.polyVerts.length
        const cy2 = m.polyVerts.reduce((s, v) => s + v.y, 0) / m.polyVerts.length
        ctx.save()
        if (m.circleShape) {
          const r2 = Math.hypot(m.polyVerts[0].x - cx2, m.polyVerts[0].y - cy2)
          ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2)
          ctx.fillStyle = m.bg + '55'; ctx.fill()
          ctx.strokeStyle = isEditing ? m.color : m.color + '99'; ctx.lineWidth = isEditing ? 1 : 0.8; ctx.stroke()
          if (isEditing) {
            const N = m.polyVerts.length, step = N / 4
            for (let i = 0; i < 4; i++) {
              const v = m.polyVerts[i * step]
              ctx.beginPath(); ctx.arc(v.x, v.y, 1.5, 0, Math.PI * 2)
              ctx.fillStyle = '#fff'; ctx.fill()
              ctx.strokeStyle = m.color; ctx.lineWidth = 0.5; ctx.stroke()
            }
          }
        } else {
          ctx.beginPath()
          ctx.moveTo(m.polyVerts[0].x, m.polyVerts[0].y)
          m.polyVerts.forEach((v, i) => { if (i > 0) ctx.lineTo(v.x, v.y) })
          ctx.closePath()
          ctx.fillStyle = m.bg + '55'; ctx.fill()
          ctx.strokeStyle = isEditing ? m.color : m.color + '99'; ctx.lineWidth = isEditing ? 1 : 0.8; ctx.stroke()
          if (isEditing) {
            m.polyVerts.forEach(v => {
              ctx.beginPath(); ctx.arc(v.x, v.y, 1.5, 0, Math.PI * 2)
              ctx.fillStyle = '#fff'; ctx.fill()
              ctx.strokeStyle = m.color; ctx.lineWidth = 0.5; ctx.stroke()
            })
          }
        }
        drawMIcon(ctx, m, cx2 - MS / 2, cy2 - MS / 2, () => drawBuildRef.current?.(), MS, MS)
        const maxY = Math.max(...m.polyVerts.map(v => v.y))
        ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = '#534AB7'
        ctx.fillText('E' + lvl, cx2, maxY + 5)
        ctx.textAlign = 'left'
        ctx.restore()
        return
      }
      if (m.px == null) return
      const fpW = Math.max(MS, (m.widthCm || 100) * scaleX)
      const fpH = Math.max(MS, (m.heightCm || 100) * scaleY)
      const clampedW = Math.min(fpW, z.x + z.w - m.px)
      const clampedH = Math.min(fpH, z.y + z.h - m.py)
      drawMIcon(ctx, m, m.px, m.py, () => drawBuildRef.current?.(), clampedW, clampedH)
      ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center'
      ctx.fillStyle = '#534AB7'
      ctx.fillText('E' + lvl, m.px + MS / 2, m.py + MS + 4)
      ctx.textAlign = 'left'
    }))

    if (cvDrag.current) {
      const { zoneAt } = { zoneAt: (zs2, cx2, cy2) => zs2.find(z => cx2 >= z.x && cx2 <= z.x + z.w && cy2 >= z.y && cy2 <= z.y + z.h) }
      const tz = zoneAt(zs, mxRef.current, myRef.current)
      if (tz && tz.id !== cvDrag.current.z.id) {
        ctx.save()
        ctx.beginPath()
        if (tz.shape === 'ellipse') {
          ctx.ellipse(tz.x + tz.w / 2, tz.y + tz.h / 2, tz.w / 2, tz.h / 2, 0, 0, Math.PI * 2)
        } else {
          ctx.rect(tz.x, tz.y, tz.w, tz.h)
        }
        ctx.strokeStyle = '#378ADD'; ctx.lineWidth = 0.8
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([])
        ctx.restore()
      }
      ctx.globalAlpha = 0.55
      const dm = cvDrag.current.m
      if (dm.polyVerts?.length >= 3) {
        const cx2 = dm.polyVerts.reduce((s, v) => s + v.x, 0) / dm.polyVerts.length
        const cy2 = dm.polyVerts.reduce((s, v) => s + v.y, 0) / dm.polyVerts.length
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(dm.polyVerts[0].x, dm.polyVerts[0].y)
        dm.polyVerts.forEach((v, i) => { if (i > 0) ctx.lineTo(v.x, v.y) })
        ctx.closePath()
        ctx.fillStyle = dm.bg + '55'; ctx.fill()
        ctx.strokeStyle = dm.color + 'cc'; ctx.lineWidth = 0.8; ctx.stroke()
        drawMIcon(ctx, dm, cx2 - MS / 2, cy2 - MS / 2, () => drawBuildRef.current?.(), MS, MS)
        ctx.restore()
      } else if (dm.px != null) {
        const dfpW = Math.max(MS, (dm.widthCm || 100) * scaleX)
        const dfpH = Math.max(MS, (dm.heightCm || 100) * scaleY)
        drawMIcon(ctx, dm, dm.px, dm.py, () => drawBuildRef.current?.(), dfpW, dfpH)
      }
      ctx.globalAlpha = 1
    }
    // ── 폴리곤 그리기 미리보기 ──
    if (polyDrawRef.current.active) {
      const pts = polyDrawRef.current.pts
      const rawMx = mxRef.current, rawMy = myRef.current
      const { x: mx, y: my } = shiftRef.current ? shiftSnap(pts, rawMx, rawMy) : { x: rawMx, y: rawMy }
      ctx.save()
      if (pts.length > 0) {
        ctx.strokeStyle = '#5A8FA8'; ctx.lineWidth = 0.9
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y) })
        ctx.lineTo(mx, my)
        ctx.stroke()
        ctx.setLineDash([])
        pts.forEach((p, i) => {
          ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 2.5 : 2, 0, Math.PI * 2)
          ctx.fillStyle = i === 0 ? '#00c896' : '#5A8FA8'; ctx.fill()
          if (i === 0 && pts.length >= 3) {
            ctx.strokeStyle = 'rgba(0,200,150,0.5)'; ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke()
          }
        })
      } else {
        ctx.strokeStyle = 'rgba(90,143,168,0.5)'; ctx.lineWidth = 0.7
        ctx.beginPath(); ctx.moveTo(mx - 8, my); ctx.lineTo(mx + 8, my); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(mx, my - 8); ctx.lineTo(mx, my + 8); ctx.stroke()
      }
      ctx.restore()
    }
    // ── 미디어 다각형 그리기 미리보기 ──
    if (mediaPolyDrawRef.current.active) {
      const pts = mediaPolyDrawRef.current.pts
      const rawMx = mxRef.current, rawMy = myRef.current
      const mx = rawMx, my = rawMy
      ctx.save()
      ctx.strokeStyle = '#534AB7'; ctx.lineWidth = 0.9
      ctx.setLineDash([3, 2])
      ctx.beginPath()
      if (pts.length > 0) {
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y) })
      }
      ctx.lineTo(mx, my)
      ctx.stroke(); ctx.setLineDash([])
      if (pts.length >= 3) {
        ctx.fillStyle = 'rgba(83,74,183,0.06)'
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y) })
        ctx.closePath(); ctx.fill()
      }
      pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 2.5 : 2, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#534AB7' : 'rgba(83,74,183,0.6)'; ctx.fill()
        if (i === 0 && pts.length >= 3) {
          ctx.strokeStyle = 'rgba(83,74,183,0.4)'; ctx.lineWidth = 0.5
          ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke()
        }
      })
      ctx.restore()
    }
    // ── Footprint scale 레이블 (좌하단) ──
    ;(() => {
      const sqm = sz.w * sz.h; const py = (sqm * 0.3025).toFixed(1)
      const lbl = `□  Footprint scale: Area ${viewFloorRef.current + 1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font = '4px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText(lbl, 4, dynCH - 4)
      ctx.restore()
    })()
    applyVT(canvas)
  }, [applyVT])

  // keep ref in sync
  drawBuildRef.current = drawBuild

  function drawSim() {
    const canvas = sCRef.current; if (!canvas) return
    const DPR = window.devicePixelRatio || 1
    const sz = floorSizesRef.current[viewFloorRef.current] || { w: 20, h: 14 }
    const dynCH = Math.max(160, Math.min(600, Math.round(CW * sz.h / sz.w)))
    const cssW = fitCanvasWidth(canvas, dynCH)
    const cssH = Math.round(cssW * sz.h / sz.w)
    canvas.width = Math.round(cssW * DPR); canvas.height = Math.round(cssH * DPR)
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'
    const ctx = canvas.getContext('2d')
    const scale = cssW / CW * DPR
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, CW, dynCH)
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad, pad, CW - pad * 2, dynCH - pad * 2, clipR); ctx.clip()

    ;(() => {
      const mPx = CW / sz.w
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.3
      for (let i = 0; i <= sz.w; i++) { const x = Math.round(i * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke() }
      for (let j = 0; j <= sz.h; j++) { const y = Math.round(j * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.4
      for (let i = 0; i <= sz.w; i += 5) { const x = Math.round(i * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke() }
      for (let j = 0; j <= sz.h; j += 5) { const y = Math.round(j * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.font = '3.5px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      for (let i = 1; i < sz.w; i++) { if (i % 5 === 0) continue; ctx.fillText(`${i}`, i * mPx + 1, pad + 1) }
      for (let i = 5; i < sz.w; i += 5) ctx.fillText(`${i}m`, i * mPx + 1, pad + 1)
      for (let j = 1; j < sz.h; j++) { if (j % 5 === 0) continue; ctx.fillText(`${j}`, pad + 1, j * mPx + 1) }
      for (let j = 5; j < sz.h; j += 5) ctx.fillText(`${j}m`, pad + 1, j * mPx + 1)
      ctx.restore()
    })()

    const scaleX = CW / (sz.w * 100) * 0.5, scaleY = dynCH / (sz.h * 100) * 0.5
    const zs = zonesRef.current.filter(z => (z.floor || 0) === viewFloorRef.current)
    const sortedSimZs = zs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const agents = agentsRef.current.filter(a => {
      if (a.exited) return false
      if (a.zoneId < 0) return viewFloorRef.current === 0
      return (zonesRef.current.find(z => z.id === a.zoneId)?.floor || 0) === viewFloorRef.current
    })

    sortedSimZs.forEach((z, zi) => {
      const cnt = agents.filter(a => a.zoneId === z.id && !a.exited).reduce((s, a) => s + a.size, 0)
      const cap = zCap(z), crowded = cnt >= cap
      drawZoneShape(ctx, z, crowded ? 'rgba(234,75,74,0.06)' : 'rgba(255,255,255,1)', crowded ? '#E24B4A' : 'rgba(0,0,0,0.15)', crowded ? 0.6 : 0.4)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = '500 5px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`${zi + 1}. ${z.name}`, z.x + z.w / 2, z.y + 10)
      ctx.font = '5px sans-serif'
      ctx.fillStyle = crowded ? '#E24B4A' : 'rgba(0,0,0,0.28)'
      ctx.fillText(`${cnt}/${cap}인`, z.x + z.w / 2, z.y + z.h - 8); ctx.textAlign = 'left'
    })

    sortedSimZs.forEach(z => z.media.forEach(m => {
      const busy = busyCount(m.uid, agents), full = busy >= m.cap
      const pr = MS / 2 + 2
      const expA = agents.filter(a => !a.exited && a.phase === 'experiencing' && a.curMedia?.uid === m.uid)
      let icx, icy
      if (m.polyVerts?.length >= 3) {
        icx = m.polyVerts.reduce((s, v) => s + v.x, 0) / m.polyVerts.length
        icy = m.polyVerts.reduce((s, v) => s + v.y, 0) / m.polyVerts.length
        ctx.save()
        ctx.beginPath()
        if (m.circleShape) {
          const r2 = Math.hypot(m.polyVerts[0].x - icx, m.polyVerts[0].y - icy)
          ctx.arc(icx, icy, r2, 0, Math.PI * 2)
        } else {
          ctx.moveTo(m.polyVerts[0].x, m.polyVerts[0].y)
          m.polyVerts.forEach((v, i) => { if (i > 0) ctx.lineTo(v.x, v.y) })
          ctx.closePath()
        }
        ctx.fillStyle = m.bg + '55'; ctx.fill()
        ctx.strokeStyle = m.color + '99'; ctx.lineWidth = 0.8; ctx.stroke()
        ctx.restore()
        drawMIcon(ctx, m, icx - MS / 2, icy - MS / 2, () => drawSimRef.current?.(), MS, MS)
      } else {
        if (m.px == null) return
        const fpW = Math.max(MS, (m.widthCm || 100) * scaleX)
        const fpH = Math.max(MS, (m.heightCm || 100) * scaleY)
        const cW = Math.min(fpW, z.x + z.w - m.px)
        const cH = Math.min(fpH, z.y + z.h - m.py)
        drawMIcon(ctx, m, m.px, m.py, () => drawSimRef.current?.(), cW, cH)
        icx = m.px + cW / 2; icy = m.py + cH / 2
      }
      if (expA.length > 0) {
        const avgP = expA.reduce((s, a) => s + (1 - a.dwellLeft / a.dwellTotal), 0) / expA.length
        ctx.beginPath(); ctx.arc(icx, icy, pr, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(29,158,117,0.2)'; ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath(); ctx.arc(icx, icy, pr, -Math.PI / 2, -Math.PI / 2 + avgP * Math.PI * 2); ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1; ctx.stroke()
        ctx.font = '4px sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = full ? '#E24B4A' : '#1D9E75'
        ctx.fillText(`${busy}/${m.cap}`, icx, icy + pr + 2)
      } else {
        ctx.font = '4px sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = full ? '#E24B4A' : 'rgba(0,0,0,0.3)'
        ctx.fillText(`0/${m.cap}`, icx, icy + pr + 2)
      }
      ctx.textAlign = 'left'
    }))

    const now = performance.now()
    flashRef.current = flashRef.current.filter(f => {
      const p = Math.min((now - f.t) / 700, 1)
      ctx.globalAlpha = (1 - p) * 0.95; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'
      ctx.fillStyle = '#EF9F27'; ctx.fillText('SKIP', f.x, f.y - p * 14)
      ctx.globalAlpha = 1; ctx.textAlign = 'left'
      return p < 1
    })

    agents.forEach(a => {
      if (a.exited) return
      const isWait = a.phase === 'moving_to_media' && a.waitTime > 0 && a.curMedia && busyCount(a.curMedia.uid, agents) >= a.curMedia.cap
      const isExp = a.phase === 'experiencing'
      if (!a.isDocent && a.visitorType) {
        const vtC = VISITOR_TYPES.find(v => v.key === a.visitorType)?.color
        if (vtC) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 1.8, 0, Math.PI * 2); ctx.strokeStyle = vtC; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.globalAlpha = 1 }
      }
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
      ctx.fillStyle = isWait ? '#E24B4A' : a.color; ctx.globalAlpha = 0.88; ctx.fill(); ctx.globalAlpha = 1
      if (isExp && a.dwellTotal > 0) {
        const prog = Math.max(0, Math.min(1, 1 - a.dwellLeft / a.dwellTotal)), pr = a.r + 2.5
        ctx.beginPath(); ctx.arc(a.x, a.y, pr, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(29,158,117,0.2)'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.beginPath(); ctx.arc(a.x, a.y, pr, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 1.5; ctx.stroke()
      }
      if (a.size > 1) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(a.size, a.x, a.y + 2.5); ctx.textAlign = 'left'
      }
    })
    ;(() => {
      const sqm = sz.w * sz.h; const py = (sqm * 0.3025).toFixed(1)
      const lbl = `□  Footprint scale: Area ${viewFloorRef.current + 1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font = '4px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText(lbl, 4, dynCH - 4)
      ctx.restore()
    })()
    applyVT(canvas)
  }

  drawSimRef.current = drawSim

  function drawHeat() {
    const canvas = hCRef.current; if (!canvas) return
    const snap = heatScrubSnapRef.current
    const heatData = snap ? snap.heat : heatAcc.current
    const skipData = snap ? snap.skip : skipStats.current
    const DPR = window.devicePixelRatio || 1
    const sz = floorSizesRef.current[viewFloorRef.current] || { w: 20, h: 14 }
    const dynCH = Math.max(160, Math.min(600, Math.round(CW * sz.h / sz.w)))
    const cssW = fitCanvasWidth(canvas, dynCH)
    const cssH = Math.round(cssW * sz.h / sz.w)
    canvas.width = Math.round(cssW * DPR); canvas.height = Math.round(cssH * DPR)
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'
    const ctx = canvas.getContext('2d')
    const scale = cssW / CW * DPR
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, CW, dynCH)
    const clipR = 10 * CW / cssW
    const pad = clipR * 0.5
    ctx.beginPath(); ctx.roundRect(pad, pad, CW - pad * 2, dynCH - pad * 2, clipR); ctx.clip()

    ;(() => {
      const mPx = CW / sz.w
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.3
      for (let i = 0; i <= sz.w; i++) { const x = Math.round(i * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke() }
      for (let j = 0; j <= sz.h; j++) { const y = Math.round(j * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }
      ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.4
      for (let i = 0; i <= sz.w; i += 5) { const x = Math.round(i * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dynCH); ctx.stroke() }
      for (let j = 0; j <= sz.h; j += 5) { const y = Math.round(j * mPx * 10) / 10; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.font = '3.5px sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      for (let i = 1; i < sz.w; i++) { if (i % 5 === 0) continue; ctx.fillText(`${i}`, i * mPx + 1, pad + 1) }
      for (let i = 5; i < sz.w; i += 5) ctx.fillText(`${i}m`, i * mPx + 1, pad + 1)
      for (let j = 1; j < sz.h; j++) { if (j % 5 === 0) continue; ctx.fillText(`${j}`, pad + 1, j * mPx + 1) }
      for (let j = 5; j < sz.h; j += 5) ctx.fillText(`${j}m`, pad + 1, j * mPx + 1)
      ctx.restore()
    })()

    const maxH = Math.max(...Object.values(heatData), 1)
    const scaleX = CW / (sz.w * 100) * 0.5, scaleY = dynCH / (sz.h * 100) * 0.5
    const flZones = zonesRef.current.filter(z => (z.floor || 0) === viewFloorRef.current)

    const entriesData = snap ? (snap.entries || {}) : zoneEntriesRef.current
    const engagedData = snap ? (snap.engaged || {}) : zoneEngagedRef.current
    const waitData = snap ? (snap.wait || {}) : zoneWaitAccRef.current

    const sortedHeatZs = flZones.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    sortedHeatZs.forEach((z, zi) => {
      drawZoneShape(ctx, z, '#F7F9F8', null, 0)

      const ratio = (heatData[z.id] || 0) / maxH
      let r2, g2, b2
      if (ratio < 0.4) { r2 = 55 + (230 - 55) * ratio / 0.4; g2 = 138 + (100 - 138) * ratio / 0.4; b2 = 221 + (30 - 221) * ratio / 0.4 }
      else { r2 = 230 + (220 - 230) * (ratio - 0.4) / 0.6; g2 = 100 * (1 - (ratio - 0.4) / 0.6); b2 = 30 * (1 - (ratio - 0.4) / 0.6) }
      drawZoneShape(ctx, z, `rgb(${Math.round(r2)},${Math.round(g2)},${Math.round(b2)})`, 'rgba(0,0,0,0.15)', 0.4, 0.18 + ratio * 0.68)

      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = '500 5px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`${zi + 1}. ${z.name}`, z.x + z.w / 2, z.y + 10)

      const zEntries = entriesData[z.id] || 0
      const zEngaged = engagedData[z.id] || 0
      const zWaitMs = waitData[z.id] || 0
      const zAvgWait = zEntries > 0 ? zWaitMs / zEntries / 1000 : 0
      const zConvRate = zEntries > 0 ? zEngaged / zEntries * 100 : 0
      const hasHeat = (heatData[z.id] || 0) > 0
      let statusLabel = null, statusColor = null
      if (zAvgWait > 20)                               { statusLabel = '● 병목'; statusColor = '#DC2626' }
      else if (ratio > 0.6 && zAvgWait > 5)           { statusLabel = '● 과밀'; statusColor = '#D97706' }
      else if (hasHeat && ratio < 0.2)                 { statusLabel = '● 저활용'; statusColor = '#6B7280' }
      else if (zEntries > 0 && zConvRate > 60 && zAvgWait < 10) { statusLabel = '● 효율'; statusColor = '#059669' }

      if (statusLabel) {
        ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'right'
        ctx.fillStyle = statusColor
        ctx.fillText(statusLabel, z.x + z.w - 3, z.y + 9)
        ctx.textAlign = 'left'
      }

      ctx.font = '4.5px sans-serif'; ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      if (zEntries > 0) {
        ctx.fillText(`진입 ${zEntries}명 · 대기 ${Math.round(zAvgWait)}초`, z.x + z.w / 2, z.y + z.h - 8)
      } else {
        ctx.fillText(`누적 ${Math.round(heatData[z.id] || 0)}`, z.x + z.w / 2, z.y + z.h - 8)
      }
      ctx.textAlign = 'left'
    })

    sortedHeatZs.forEach(z => z.media.forEach(m => {
      const ms = skipData[m.uid] || { skip: 0, exp: 0 }
      const total = ms.skip + ms.exp
      const mr = total > 0 ? Math.round(ms.skip / total * 100) : 0
      const sc = mr > 50 ? '#7C3AED' : mr > 20 ? '#D97706' : '#059669'
      if (m.polyVerts?.length >= 3) {
        ctx.save()
        ctx.beginPath()
        const cx2 = m.polyVerts.reduce((s, v) => s + v.x, 0) / m.polyVerts.length
        const cy2 = m.polyVerts.reduce((s, v) => s + v.y, 0) / m.polyVerts.length
        if (m.circleShape) {
          const r2 = Math.hypot(m.polyVerts[0].x - cx2, m.polyVerts[0].y - cy2)
          ctx.arc(cx2, cy2, r2, 0, Math.PI * 2)
        } else {
          ctx.moveTo(m.polyVerts[0].x, m.polyVerts[0].y)
          m.polyVerts.forEach((v, i) => { if (i > 0) ctx.lineTo(v.x, v.y) })
          ctx.closePath()
        }
        ctx.globalAlpha = 0.72
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
        ctx.strokeStyle = sc; ctx.lineWidth = 0.5
        ctx.setLineDash([1.5, 1.5]); ctx.stroke(); ctx.setLineDash([])
        ctx.globalAlpha = 1
        ctx.restore()
        return
      }
      if (m.px == null) return
      const fpW = Math.max(MS, (m.widthCm || 100) * scaleX)
      const fpH = Math.max(MS, (m.heightCm || 100) * scaleY)
      const fx = Math.max(z.x, m.px), fy = Math.max(z.y, m.py)
      const fw = Math.min(m.px + fpW, z.x + z.w) - fx
      const fh = Math.min(m.py + fpH, z.y + z.h) - fy
      if (fw <= 0 || fh <= 0) return
      ctx.globalAlpha = 0.72
      rr(ctx, fx, fy, fw, fh, 3)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill()
      ctx.strokeStyle = sc; ctx.lineWidth = 0.5
      ctx.setLineDash([1.5, 1.5]); ctx.stroke(); ctx.setLineDash([])
      ctx.globalAlpha = 1
    }))

    sortedHeatZs.forEach(z => z.media.forEach(m => {
      const ms = skipData[m.uid] || { skip: 0, exp: 0 }
      const total = ms.skip + ms.exp
      const mr = total > 0 ? Math.round(ms.skip / total * 100) : 0
      const bc = mr > 50 ? '#7C3AED' : mr > 20 ? '#D97706' : '#059669'
      let icx, icy
      if (m.polyVerts?.length >= 3) {
        icx = m.polyVerts.reduce((s, v) => s + v.x, 0) / m.polyVerts.length
        icy = m.polyVerts.reduce((s, v) => s + v.y, 0) / m.polyVerts.length
        drawMIcon(ctx, m, icx - MS / 2, icy - MS / 2, () => drawHeatRef.current?.(), MS, MS)
      } else {
        if (m.px == null) return
        const fpW = Math.max(MS, (m.widthCm || 100) * scaleX)
        const fpH = Math.max(MS, (m.heightCm || 100) * scaleY)
        const cW = Math.min(fpW, z.x + z.w - m.px)
        const cH = Math.min(fpH, z.y + z.h - m.py)
        drawMIcon(ctx, m, m.px, m.py, () => drawHeatRef.current?.(), cW, cH)
        icx = m.px + cW / 2; icy = m.py + cH / 2
      }
      if (total > 0) {
        const bx = icx, by = icy + MS / 2 + 5
        ctx.globalAlpha = 0.88
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        const tw = mr > 9 ? 7 : 5
        rr(ctx, bx - tw / 2, by - 3.5, tw, 4.5, 1.5)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = bc
        ctx.fillText(`${mr}%`, bx, by)
        ctx.textAlign = 'left'
      }
    }))
    // ── 존 분석 배지 ──
    const mainV = heatMainViewRef.current
    if (mainV === 'heatmap' || mainV === 'zones' || mainV === 'media' || mainV === 'all') {
      const skipD = snap ? snap.skip : skipStats.current
      const maxHeat = Math.max(...sortedHeatZs.map(z => heatData[z.id] || 0), 1)
      sortedHeatZs.forEach(z => {
        const ent  = (snap ? snap.entries : zoneEntriesRef.current)[z.id] || 0
        const eng  = (snap ? snap.engaged : zoneEngagedRef.current)[z.id] || 0
        const wt   = (snap ? snap.wait : zoneWaitAccRef.current)[z.id] || 0
        const conv = ent > 0 ? Math.round(eng / ent * 100) : 0
        const wait = ent > 0 ? Math.round(wt / ent / 1000) : 0
        const zss  = skipD[`z${z.id}`] || { skip: 0, exp: 0 }
        const zsr  = zss.skip + zss.exp > 0 ? Math.round(zss.skip / (zss.skip + zss.exp) * 100) : 0
        const zMedia = z.media.filter(m => (skipD[m.uid]?.skip || 0) + (skipD[m.uid]?.exp || 0) > 0)
        const heatPct = Math.round((heatData[z.id] || 0) / maxHeat * 100)
        const isBottleneck = wait > 20

        const drawBadge = (bx, by, bw, bh, rows) => {
          ctx.globalAlpha = 0.92
          ctx.fillStyle = 'rgba(12,12,12,0.75)'
          rr(ctx, bx, by, bw, bh, 3); ctx.fill()
          ctx.globalAlpha = 1
          rows.forEach((row, ri) => {
            const rowY  = by + 10 + ri * 16
            const rowLY = by + 14 + ri * 16
            if (ri > 0) {
              ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5
              ctx.beginPath(); ctx.moveTo(bx + 3, by + 16 * ri); ctx.lineTo(bx + bw - 3, by + 16 * ri); ctx.stroke()
            }
            const cw = bw / row.length
            row.forEach((col, ci) => {
              const cx = bx + cw * ci + cw / 2
              ctx.font = 'bold 3.5px sans-serif'; ctx.textAlign = 'center'
              ctx.fillStyle = col.c
              ctx.fillText(col.val, cx, rowY)
              ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '2.8px sans-serif'
              ctx.fillText(col.label, cx, rowLY)
            })
          })
          ctx.textAlign = 'left'
        }

        const bw = z.w - 4, bx = z.x + 2

        if (mainV === 'heatmap') {
          const bh = 14
          drawBadge(bx, z.y + z.h - bh - 2, bw, bh, [[
            { label: '밀집도', val: `${heatPct}%`, c: heatPct > 70 ? '#f87171' : heatPct > 40 ? '#fbbf24' : '#93c5fd' },
          ]])
        } else if (mainV === 'zones') {
          const bh = 28
          drawBadge(bx, z.y + z.h - bh - 2, bw, bh, [
            [
              { label: '진입', val: `${ent}명`, c: '#e2e8f0' },
              { label: '체험', val: `${eng}명`, c: conv > 60 ? '#4ade80' : conv > 30 ? '#fbbf24' : '#f87171' },
            ],
            [
              { label: '대기', val: `${wait}초`, c: wait > 20 ? '#f87171' : wait > 10 ? '#fbbf24' : '#4ade80' },
              { label: '병목', val: isBottleneck ? '발생' : '없음', c: isBottleneck ? '#f87171' : '#4ade80' },
            ],
          ])
        } else if (mainV === 'media') {
          const bh = 28
          drawBadge(bx, z.y + z.h - bh - 2, bw, bh, [
            [
              { label: '미디어', val: `${zMedia.length}개`, c: '#93c5fd' },
              { label: '전환율', val: `${conv}%`, c: conv > 60 ? '#4ade80' : conv > 30 ? '#fbbf24' : '#f87171' },
            ],
            [
              { label: '혼잡도', val: `${wait}초`, c: wait > 20 ? '#f87171' : wait > 10 ? '#fbbf24' : '#4ade80' },
              { label: '스킵율', val: `${zsr}%`, c: zsr > 50 ? '#c084fc' : zsr > 20 ? '#fbbf24' : '#4ade80' },
            ],
          ])
        } else {
          const bh = 28
          drawBadge(bx, z.y + z.h - bh - 2, bw, bh, [
            [
              { label: '진입', val: `${ent}명`, c: '#e2e8f0' },
              { label: '전환율', val: `${conv}%`, c: conv > 60 ? '#4ade80' : conv > 30 ? '#fbbf24' : '#f87171' },
            ],
            [
              { label: '미디어', val: `${zMedia.length}개`, c: '#93c5fd' },
              { label: '스킵율', val: `${zsr}%`, c: zsr > 50 ? '#c084fc' : zsr > 20 ? '#fbbf24' : '#4ade80' },
            ],
          ])
        }
      })
    }

    ;(() => {
      const sqm = sz.w * sz.h; const py = (sqm * 0.3025).toFixed(1)
      const lbl = `□  Footprint scale: Area ${viewFloorRef.current + 1} = ${sz.w}m × ${sz.h}m (${sqm}m² · ${py}평)`
      ctx.save()
      ctx.font = '4px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
      ctx.fillText(lbl, 4, dynCH - 4)
      ctx.restore()
    })()
    applyVT(canvas)
  }

  drawHeatRef.current = drawHeat

  return {
    fitCanvasWidth,
    drawDoorIcon,
    drawCircularDoorIcon,
    drawZoneShape,
    drawBuild,
    drawSim,
    drawHeat,
  }
}
