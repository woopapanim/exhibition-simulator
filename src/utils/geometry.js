// Pure geometry helpers extracted from SimulationPage.jsx

// Returns the 6 vertices of the L-shaped polygon
export function getLPoly(z) {
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
export function ptInPoly(pts, px, py) {
  let inside = false
  for (let i=0,j=pts.length-1; i<pts.length; j=i++) {
    const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y
    if (((yi>py)!==(yj>py)) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside
  }
  return inside
}

// Returns the inner corner handle position for the L cutout (the vertex where the two inner edges meet)
export function getLCutHandle(z) {
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
export function shiftSnap(pts, rawX, rawY) {
  if (!pts.length) return {x:rawX, y:rawY}
  const last=pts[pts.length-1]
  return Math.abs(rawX-last.x)>=Math.abs(rawY-last.y)
    ? {x:rawX, y:last.y}   // 수평
    : {x:last.x, y:rawY}   // 수직
}

export function getPolyBounds(verts) {
  const xs=verts.map(v=>v.x), ys=verts.map(v=>v.y)
  const x=Math.min(...xs), y=Math.min(...ys)
  return {x, y, w:Math.max(...xs)-x, h:Math.max(...ys)-y}
}

// 점 → 선분 위의 최근접점 및 거리
export function closestPtOnSeg(px,py,ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy
  if (len2===0) return {x:ax,y:ay,t:0,dist:Math.hypot(px-ax,py-ay)}
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2))
  const cx=ax+t*dx,cy=ay+t*dy
  return {x:cx,y:cy,t,dist:Math.hypot(px-cx,py-cy)}
}

// 존 기준 클램핑: polygon 존이면 polygon 경계 안으로, 아니면 AABB
export function clampToZonePoly(z, px, py) {
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
export function segsIntersect(ax,ay,bx,by,cx,cy,dx,dy) {
  const d1x=bx-ax,d1y=by-ay,d2x=dx-cx,d2y=dy-cy
  const denom=d1x*d2y-d1y*d2x
  if (Math.abs(denom)<1e-10) return false
  const t=((cx-ax)*d2y-(cy-ay)*d2x)/denom
  const u=((cx-ax)*d1y-(cy-ay)*d1x)/denom
  return t>=0&&t<=1&&u>=0&&u<=1
}

// 두 다각형 겹침 여부 (꼭짓점 포함 + 엣지 교차)
export function polysOverlap(a, b) {
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
export function polyRectOverlap(poly, rx,ry,rw,rh) {
  const rect=[{x:rx,y:ry},{x:rx+rw,y:ry},{x:rx+rw,y:ry+rh},{x:rx,y:ry+rh}]
  return polysOverlap(poly, rect)
}

export function ptInZone(z, px, py) {
  if (z.shape === 'ellipse') {
    const dx = (px - (z.x + z.w/2)) / (z.w/2)
    const dy = (py - (z.y + z.h/2)) / (z.h/2)
    return dx*dx + dy*dy <= 1
  }
  if (z.shape === 'L') return ptInPoly(getLPoly(z), px, py)
  if (z.shape === 'polygon') return z.vertices?.length>=3 ? ptInPoly(z.vertices,px,py) : false
  return px >= z.x && px <= z.x+z.w && py >= z.y && py <= z.y+z.h
}
