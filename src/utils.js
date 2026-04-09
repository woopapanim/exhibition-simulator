import { CW, MS, MG, MP, ICON_SVG_STR } from './constants'

// ─────────────────────────── 기본 유틸 ───────────────────────────

export function clone(x) { return JSON.parse(JSON.stringify(x)) }
export function uid(p)   { return `${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }

// ─────────────────────────── 존 유틸 ───────────────────────────

export function zCap(z)   { return z.media.length ? z.media.reduce((s,m)=>s+m.cap,0) : z.defCap }
export function zDwell(z) { return z.media.length ? Math.round(z.media.reduce((s,m)=>s+m.dwell,0)/z.media.length) : z.defDwell }

function _getLPoly(z) {
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

function _ptInPoly(pts, px, py) {
  let inside = false
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y
    if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside
  }
  return inside
}

function _ptInZone(z, px, py) {
  if (z.shape === 'ellipse') {
    const dx = (px - (z.x + z.w/2)) / (z.w/2)
    const dy = (py - (z.y + z.h/2)) / (z.h/2)
    return dx*dx + dy*dy <= 1
  }
  if (z.shape === 'L') return _ptInPoly(_getLPoly(z), px, py)
  if (z.shape === 'polygon' && z.vertices?.length >= 3) return _ptInPoly(z.vertices, px, py)
  return px >= z.x && px <= z.x+z.w && py >= z.y && py <= z.y+z.h
}

export function zoneAt(zones, cx, cy) {
  const sorted = [...zones].sort((a,b)=>(b.order??0)-(a.order??0))
  for (const z of sorted) {
    if (_ptInZone(z, cx, cy)) return z
  }
  return null
}

export function ptInPoly(pts, px, py) {
  let inside = false
  for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
    const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y
    if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside
  }
  return inside
}

export function mediaAt(zones, cx, cy, scaleX, scaleY) {
  for (let zi=zones.length-1; zi>=0; zi--) {
    const z = zones[zi]
    for (let mi=z.media.length-1; mi>=0; mi--) {
      const m = z.media[mi]
      // 다각형 미디어 히트 테스트
      if (m.polyVerts?.length >= 3) {
        if (ptInPoly(m.polyVerts, cx, cy)) return {z, m}
        continue
      }
      if (m.px==null) continue
      const fpW = scaleX ? Math.max(MS,(m.widthCm||100)*scaleX) : MS
      const fpH = scaleY ? Math.max(MS,(m.heightCm||100)*scaleY) : MS
      if (cx>=m.px && cx<=m.px+fpW && cy>=m.py && cy<=m.py+fpH) return {z,m}
    }
  }
  return null
}

export function layoutAll(zones) {
  zones.forEach(z=>{
    const cols = Math.max(1, Math.floor((z.w-MP*2)/(MS+MG)))
    // L자/다각형 존은 실제 형태 안의 유효 위치만 수집
    const needsShapeCheck = z.shape === 'L' || z.shape === 'polygon'
    let validSlots = null
    if (needsShapeCheck) {
      validSlots = []
      const maxRows = Math.ceil(z.h / (MS+MG)) + 2
      for (let row = 0; row < maxRows && validSlots.length < z.media.length + 5; row++) {
        for (let col = 0; col < cols; col++) {
          const px = z.x+MP+col*(MS+MG)
          const py = z.y+18+row*(MS+MG)
          const cx = px + MS/2, cy = py + MS/2
          if (_ptInZone(z, cx, cy)) validSlots.push({px, py})
        }
      }
    }
    let slotIdx = 0
    z.media.forEach((m,i)=>{
      if (m.px==null || !inZone(z,m) || (needsShapeCheck && !_ptInZone(z, m.px+MS/2, m.py+MS/2))) {
        if (validSlots) {
          if (slotIdx < validSlots.length) {
            m.px = validSlots[slotIdx].px
            m.py = validSlots[slotIdx].py
            slotIdx++
          }
        } else {
          m.px = z.x+MP+(i%cols)*(MS+MG)
          m.py = z.y+18+Math.floor(i/cols)*(MS+MG)
        }
      } else if (!validSlots) {
        // rect/ellipse: 슬롯 순서 유지를 위해 slotIdx 증가
        slotIdx++
      }
    })
  })
}

export function inZone(z, m) {
  return m.px>=z.x && m.px+MS<=z.x+z.w && m.py>=z.y && m.py+MS<=z.y+z.h
}

// ─────────────────────────── 기하 유틸 ───────────────────────────

export function dist2(ax,ay,bx,by) { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy }

export function pickNearest(list, fx, fy) {
  if (!list.length) return null
  return list.slice().sort((a,b)=>{
    const ax=a.px!=null?a.px+MS/2:0, ay=a.py!=null?a.py+MS/2:0
    const bx=b.px!=null?b.px+MS/2:0, by=b.py!=null?b.py+MS/2:0
    return dist2(fx,fy,ax,ay)-dist2(fx,fy,bx,by)
  })[0]
}

/** canvas CSS 좌표 → 논리 좌표 변환 */
export function sc2(canvas, e) {
  const rect = canvas.getBoundingClientRect()
  const s = CW / rect.width
  return { x:(e.clientX-rect.left)*s, y:(e.clientY-rect.top)*s }
}

// ─────────────────────────── 에이전트 유틸 ───────────────────────────

export function busyCount(mUid, agents) {
  return agents
    .filter(a=>!a.exited && a.phase==='experiencing' && a.curMedia?.uid===mUid)
    .reduce((s,a)=>s+(a.isDocent ? Math.min(a.size,2) : a.size), 0)
}

// ─────────────────────────── 캔버스 드로잉 ───────────────────────────

/** 둥근 사각형 path */
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y)
  ctx.closePath()
}

const _iconImgCache = {}
export function getIconImg(id, color, size) {
  const key = `${id}-${color}-${size}`
  if (_iconImgCache[key]) return _iconImgCache[key]
  const body = ICON_SVG_STR[id] || '<circle cx="12" cy="12" r="9"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  const img = new window.Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  _iconImgCache[key] = img
  return img
}

export function drawMIcon(ctx, m, px, py, redraw, fpW, fpH) {
  const w = fpW||MS, h = fpH||MS
  // 아이콘 배경 = 물리적 풋프린트 사이즈
  ctx.beginPath(); rr(ctx, px, py, w, h, Math.min(w,h)*0.12)
  ctx.fillStyle = m.bg; ctx.fill()
  ctx.strokeStyle = m.color + '55'; ctx.lineWidth = 0.5; ctx.stroke()

  // 심볼은 풋프린트 중앙에
  const iconSize = Math.round(MS * 0.62)
  const ix = px + (w - iconSize) / 2
  const iy = py + (h - iconSize) / 2
  const img = getIconImg(m.id, m.color, 128)
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, ix, iy, iconSize, iconSize)
  } else {
    img.onload = () => { if (redraw) redraw() }
  }
}
