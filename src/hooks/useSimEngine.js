import { useRef, useCallback } from 'react'
import {
  SLOTS, SEGS, SLOT_DEF_TOTALS, DOCENT_COLOR, ALL_MT,
  VISITOR_TYPES, CW, MS,
} from '../constants'
import { zCap, zDwell, busyCount, layoutAll } from '../utils'
import { ptInZone, clampToZonePoly, getPolyBounds } from '../utils/geometry'

export function useSimEngine({
  // refs
  agentsRef,
  simTimeRef,
  spawnTimer,
  tourTimer,
  docentCfgRef,
  slotCfgsRef,
  simRangeRef,
  runningSlotRef,
  totalSpawnedRef,
  cumulativeVisitorsRef,
  heatAcc,
  skipStats,
  engAcc,
  bnRef,
  dwellTotal,
  exitedCnt,
  runRef,
  pausedRef,
  lastTRef,
  rafRef,
  flashRef,
  heatSnapshotsRef,
  lastSnapIdxRef,
  speedRef,
  slotRef,
  flowRef,
  circularFlowRef,
  cfgRef,
  zonesRef,
  zoneEntriesRef,
  zoneEngagedRef,
  zoneWaitAccRef,
  floorSizesRef,
  dynCHRef,
  heatScrubSnapRef,
  // callbacks
  drawSim,
  setSimStatus,
  setSlotResults,
  setDispStats,
  setSkipTable,
  setRunningSlot,
  setSlot,
  setHeatTimeline,
  setHeatScrubIdx,
  setReportData,
  setSimLogs,
  // store values (for stopSim report)
  projectName,
  scenarioName,
}) {
  // ── 시뮬레이션 루프 ref (항상 최신 버전 유지) ──
  const simLoopFn = useRef(null)

  function initSkipStats() {
    skipStats.current = {}; engAcc.current = {}
    zoneEntriesRef.current = {}
    zoneEngagedRef.current = {}
    zoneWaitAccRef.current = {}
    zonesRef.current.forEach(z => {
      skipStats.current[`z${z.id}`] = { skip: 0, exp: 0 }
      engAcc.current[`z${z.id}`] = { score: 0, count: 0 }
      zoneEntriesRef.current[z.id] = 0
      zoneEngagedRef.current[z.id] = 0
      zoneWaitAccRef.current[z.id] = 0
      z.media.forEach(m => {
        skipStats.current[m.uid] = { skip: 0, exp: 0 }
        engAcc.current[m.uid] = { score: 0, count: 0 }
      })
    })
  }

  function initHeat() {
    heatAcc.current = {}
    zonesRef.current.forEach(z => { heatAcc.current[z.id] = 0 })
  }

  function recordSlotResult(slotIdx) {
    const allSS = Object.values(skipStats.current)
    const totSkip = allSS.reduce((s, v) => s + v.skip, 0)
    const totExp = allSS.reduce((s, v) => s + v.exp, 0)
    const skipRate = totSkip + totExp > 0 ? Math.round(totSkip / (totSkip + totExp) * 100) : 0
    const avgDw = exitedCnt.current ? Math.round(dwellTotal.current / exitedCnt.current / 1000) : 0
    const allEng = Object.values(engAcc.current)
    const engTot = allEng.reduce((s, e) => s + e.count, 0)
    const engScore = engTot > 0 ? (allEng.reduce((s, e) => s + e.score, 0) / engTot).toFixed(1) : '-'
    cumulativeVisitorsRef.current += totalSpawnedRef.current
    setSlotResults(prev => [...prev, {
      slot: slotIdx, label: SLOTS[slotIdx],
      visitors: totalSpawnedRef.current, skipRate,
      avgDwell: avgDw, engIdx: engScore,
      bottlenecks: bnRef.current,
    }])
  }

  function resetSlotState() {
    agentsRef.current = []; spawnTimer.current = 0; tourTimer.current = 0
    bnRef.current = 0; dwellTotal.current = 0; exitedCnt.current = 0; flashRef.current = []
    totalSpawnedRef.current = 0; simTimeRef.current = 0
    zoneEntriesRef.current = {}
    zoneEngagedRef.current = {}
    zoneWaitAccRef.current = {}
    zonesRef.current.forEach(z => {
      zoneEntriesRef.current[z.id] = 0
      zoneEngagedRef.current[z.id] = 0
      zoneWaitAccRef.current[z.id] = 0
    })
  }

  function getNextZone(zoneId, visited) {
    const ft = flowRef.current
    const sorted = zonesRef.current.slice().sort((a, b) => {
      const fa = (a.floor || 0), fb = (b.floor || 0)
      return fa !== fb ? fa - fb : (a.order ?? 0) - (b.order ?? 0)
    })
    const GP = sorted.map(z => z.id)
    if (ft === 'guided') {
      const i = GP.indexOf(zoneId)
      return i >= 0 && i < GP.length - 1 ? GP[i + 1] : -1
    }
    if (ft === 'free') {
      const av = sorted.filter(z => !visited.includes(z.id))
      return av.length ? av[Math.floor(Math.random() * av.length)].id : -1
    }
    const fixedIdxs = [0, Math.floor((GP.length - 1) / 2), GP.length - 1]
    const fixedIds = new Set(fixedIdxs.map(i => GP[i]))
    if (fixedIds.has(zoneId)) { const i = GP.indexOf(zoneId); return i < GP.length - 1 ? GP[i + 1] : -1 }
    const av = sorted.filter(z => !visited.includes(z.id) && !fixedIds.has(z.id))
    if (av.length) return av[Math.floor(Math.random() * av.length)].id
    const i = GP.indexOf(zoneId); return i < GP.length - 1 ? GP[i + 1] : -1
  }

  function getEntryZoneId() {
    const z = zonesRef.current.filter(z => (z.floor || 0) === 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]
    return z ? z.id : (zonesRef.current[0]?.id ?? 0)
  }

  function getExitZoneId() {
    if (circularFlowRef.current) return getEntryZoneId()
    return null
  }

  function decideNext(a) {
    const dZone = zonesRef.current.find(z => z.id === a.zoneId)
    const isFree = (dZone?.flowType || 'guided') === 'free'
    let next = null
    if (a.mediaRemaining.length > 0) {
      next = isFree
        ? a.mediaRemaining[Math.floor(Math.random() * a.mediaRemaining.length)]
        : a.mediaRemaining[0]   // guided: 순서대로
    }
    if (next) {
      a.mediaRemaining = a.mediaRemaining.filter(m => m !== next)
      a.curMedia = next; a.waitTime = 0; a.phase = 'moving_to_media'; a._wanderAngle = undefined; a._wanderDir = undefined
    } else {
      const nxt = getNextZone(a.zoneId, a.visited)
      a.curMedia = null; a.waitTime = 0
      if (nxt < 0) {
        if (circularFlowRef.current && !a.returnedToEntry) {
          const entryId = getEntryZoneId()
          a.returnedToEntry = true
          if (a.zoneId === entryId) {
            a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime
          } else {
            const curZone2 = zonesRef.current.find(z => z.id === a.zoneId)
            const entryZone = zonesRef.current.find(z => z.id === entryId)
            a.nextZoneId = entryId
            if (curZone2?.exitPos) {
              a.phase = 'moving_to_exit'
              a.exitTargetX = curZone2.exitPos.x
              a.exitTargetY = curZone2.exitPos.y
            } else {
              a.phase = 'moving_to_zone'
            }
            // Use returnPos as the entry target for the first zone when returning
            if (entryZone?.returnPos) {
              a._returnTargetPos = entryZone.returnPos
            }
          }
        } else {
          a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime
        }
      } else {
        const curZone = zonesRef.current.find(z => z.id === a.zoneId)
        a.nextZoneId = nxt
        if (curZone?.exitPos) {
          a.phase = 'moving_to_exit'
          a.exitTargetX = curZone.exitPos.x
          a.exitTargetY = curZone.exitPos.y
        } else {
          a.phase = 'moving_to_zone'
        }
      }
    }
  }

  function enterZone(a, zoneId) {
    const zn = zonesRef.current.find(z => z.id === zoneId)
    if (!zn) { a.exited = true; exitedCnt.current++; return }
    if (a.returnedToEntry) {
      a.zoneId = zoneId
      // ENTRY(returnPos)에 도착 → ENTRY/EXIT(entryPos)까지 걸어가서 퇴장
      if (zn.entryPos) {
        a.phase = 'moving_to_exit'
        a.exitTargetX = zn.entryPos.x
        a.exitTargetY = zn.entryPos.y
        a._circularFinalExit = true
      } else {
        a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime
      }
      return
    }
    a.zoneId = zoneId; a.visited.push(zoneId)
    // 존 진입 추적
    if (zoneEntriesRef.current[zoneId] !== undefined) {
      zoneEntriesRef.current[zoneId] += a.size
    }
    const isFreeZone = (zn.flowType || 'guided') === 'free'
    let meds = [...zn.media]
    if (isFreeZone) {
      // 자유 동선: 미디어 순서 셔플
      for (let i = meds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [meds[i], meds[j]] = [meds[j], meds[i]] }
    }
    const first = meds[0] || null
    a.mediaRemaining = meds.slice(1)
    a.curMedia = first || null; a.waitTime = 0
    if (first) { a.phase = 'moving_to_media' }
    else {
      const nxt = getNextZone(zoneId, a.visited)
      if (nxt < 0) { a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime }
      else { a.phase = 'moving_to_zone'; a.nextZoneId = nxt }
    }
  }

  function spawn() {
    const cfg = cfgRef.current
    const segs = cfg.segs
    const totalPct = Object.values(segs).reduce((s, v) => s + v, 0) || 1
    let roll = Math.random() * totalPct
    let segKey = 'individual'
    for (const s of SEGS) { roll -= (segs[s.key] || 0); if (roll <= 0) { segKey = s.key; break } }
    const seg = SEGS.find(s => s.key === segKey)
    let size
    switch (segKey) {
      case 'smallGroup':   size = Math.floor(Math.random() * 4) + 2; break
      case 'studentGroup': size = Math.floor(Math.random() * 21) + 10; break
      case 'corpGroup':    size = Math.floor(Math.random() * 41) + 10; break
      case 'genGroup':     size = Math.floor(Math.random() * 15) + 6; break
      default: size = 1
    }
    const vtDist = cfg.visitorTypes || { quick: 33, info: 34, immersive: 33 }
    const vtTotal = Object.values(vtDist).reduce((s, v) => s + v, 0) || 1
    let vtRoll = Math.random() * vtTotal, vtKey = 'info'
    for (const vt of VISITOR_TYPES) { vtRoll -= (vtDist[vt.key] || 0); if (vtRoll <= 0) { vtKey = vt.key; break } }
    const entryZ = zonesRef.current.filter(z => (z.floor || 0) === 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] || zonesRef.current[0]
    const spawnX = entryZ.entryPos ? entryZ.entryPos.x + (Math.random() * 8 - 4) : entryZ.x + entryZ.w / 2 + (Math.random() * 14 - 7)
    const spawnY = entryZ.entryPos ? entryZ.entryPos.y + (Math.random() * 6 - 3) : entryZ.y + entryZ.h / 2 + (Math.random() * 10 - 5)
    const a = {
      uid: `a_${Date.now()}_${Math.random()}`, x: spawnX, y: spawnY,
      zoneId: -1, visited: [], segKey, size, color: seg.color, r: seg.r,
      phase: 'moving_to_media', curMedia: null, mediaRemaining: [], nextZoneId: -1,
      waitTime: 0, dwellLeft: 0, dwellTotal: 0, exited: false, spawnTime: simTimeRef.current,
      isDocent: false, visitorType: vtKey, _lastX: null, _lastY: null, _stuckTime: 0, returnedToEntry: false,
      exitTargetX: 0, exitTargetY: 0,
      engagedZones: new Set()
    }
    totalSpawnedRef.current += size
    enterZone(a, entryZ.id); agentsRef.current.push(a)
  }

  function spawnTour() {
    const dc = docentCfgRef.current
    if (!dc.enabled) return
    const size = dc.size
    const entryZ = zonesRef.current.filter(z => (z.floor || 0) === 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] || zonesRef.current[0]
    const spawnX = entryZ.entryPos ? entryZ.entryPos.x + (Math.random() * 8 - 4) : entryZ.x + entryZ.w / 2 + (Math.random() * 14 - 7)
    const spawnY = entryZ.entryPos ? entryZ.entryPos.y + (Math.random() * 6 - 3) : entryZ.y + entryZ.h / 2 + (Math.random() * 10 - 5)
    const a = {
      uid: `a_${Date.now()}_${Math.random()}`, x: spawnX, y: spawnY,
      zoneId: -1, visited: [], segKey: 'docent', size, color: DOCENT_COLOR, r: 9,
      phase: 'moving_to_media', curMedia: null, mediaRemaining: [], nextZoneId: -1,
      waitTime: 0, dwellLeft: 0, dwellTotal: 0, exited: false, spawnTime: simTimeRef.current,
      isDocent: true, visitorType: 'immersive', _lastX: null, _lastY: null, _stuckTime: 0, returnedToEntry: false,
      exitTargetX: 0, exitTargetY: 0,
      engagedZones: new Set()
    }
    totalSpawnedRef.current += size
    enterZone(a, entryZ.id); agentsRef.current.push(a)
  }

  // ── 미디어 장애물 헬퍼 (rect / circle / polygon 공통 처리) ──
  function getMediaObs(om, sX, sY) {
    if (om.polyVerts?.length >= 3) {
      const cx = om.polyVerts.reduce((s, v) => s + v.x, 0) / om.polyVerts.length
      const cy = om.polyVerts.reduce((s, v) => s + v.y, 0) / om.polyVerts.length
      if (om.circleShape) {
        const r = Math.hypot(om.polyVerts[0].x - cx, om.polyVerts[0].y - cy)
        return { type: 'circle', cx, cy, r }
      }
      const xs = om.polyVerts.map(v => v.x), ys = om.polyVerts.map(v => v.y)
      const px2 = Math.min(...xs), py2 = Math.min(...ys), w = Math.max(...xs) - px2, h = Math.max(...ys) - py2
      return { type: 'rect', px: px2, py: py2, w, h, cx: px2 + w / 2, cy: py2 + h / 2 }
    }
    if (om.px == null) return null
    const w = Math.max(MS, (om.widthCm || 100) * sX), h = Math.max(MS, (om.heightCm || 100) * sY)
    return { type: 'rect', px: om.px, py: om.py, w, h, cx: om.px + w / 2, cy: om.py + h / 2 }
  }

  function ptInObs(obs, px2, py2) {
    if (!obs) return false
    if (obs.type === 'circle') return Math.hypot(px2 - obs.cx, py2 - obs.cy) < obs.r
    return px2 >= obs.px && px2 <= obs.px + obs.w && py2 >= obs.py && py2 <= obs.py + obs.h
  }

  function pushOutObs(a, obs) {
    if (!obs || !ptInObs(obs, a.x, a.y)) return
    if (obs.type === 'circle') {
      let ang = Math.atan2(a.y - obs.cy, a.x - obs.cx)
      if (!isFinite(ang)) ang = Math.random() * Math.PI * 2
      a.x = obs.cx + Math.cos(ang) * (obs.r + 0.8); a.y = obs.cy + Math.sin(ang) * (obs.r + 0.8)
    } else {
      const dl = a.x - obs.px, dr = obs.px + obs.w - a.x, dt2 = a.y - obs.py, db = obs.py + obs.h - a.y
      const mn = Math.min(dl, dr, dt2, db)
      if (mn === dl) a.x = obs.px - 0.5
      else if (mn === dr) a.x = obs.px + obs.w + 0.5
      else if (mn === dt2) a.y = obs.py - 0.5
      else a.y = obs.py + obs.h + 0.5
    }
  }

  function stepAgents(dt) {
    const skipThresh = cfgRef.current.skipThresh * 1000
    const spd = speedRef.current
    let bn = 0
    agentsRef.current.forEach(a => {
      if (a.exited) return
      heatAcc.current[a.zoneId] += a.size * dt * 0.004
      if (a.phase === 'moving_to_media') {
        if (!a.curMedia) { decideNext(a); return }
        // polyVerts 미디어는 centroid를 타깃으로, px==null이어도 정상 진행
        if (a.curMedia.px == null && !(a.curMedia.polyVerts?.length >= 3)) { decideNext(a); return }
        const _tZone = zonesRef.current.find(z => z.id === a.zoneId)
        const _tFi = _tZone?.floor || 0
        const _tSz = floorSizesRef.current[_tFi] || { w: 20, h: 14 }
        const _tSX = CW / (_tSz.w * 100) * 0.5, _tSY = dynCHRef.current / (_tSz.h * 100) * 0.5
        const _tFpW = Math.max(MS, (a.curMedia.widthCm || 100) * _tSX)
        const _tFpH = Math.max(MS, (a.curMedia.heightCm || 100) * _tSY)
        // polyVerts 미디어는 centroid를 타깃으로 사용
        const _hasPoly = a.curMedia.polyVerts?.length >= 3
        const _polyCx = _hasPoly ? a.curMedia.polyVerts.reduce((s, v) => s + v.x, 0) / a.curMedia.polyVerts.length : null
        const _polyCy = _hasPoly ? a.curMedia.polyVerts.reduce((s, v) => s + v.y, 0) / a.curMedia.polyVerts.length : null
        const tx = _hasPoly ? _polyCx : a.curMedia.px + _tFpW / 2
        const ty = _hasPoly ? _polyCy : a.curMedia.py + _tFpH / 2
        const dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy)
        const busy = busyCount(a.curMedia.uid, agentsRef.current)
        const el = a.curMedia.engagementLevel || 3
        const vt = VISITOR_TYPES.find(v => v.key === a.visitorType)
        const effSkipThresh = skipThresh * (vt ? vt.waitMult(el) : 1)
        if (busy >= a.curMedia.cap) {
          a.waitTime += dt * spd
          if (zoneWaitAccRef.current[a.zoneId] !== undefined) {
            zoneWaitAccRef.current[a.zoneId] += dt * spd * a.size
          }
          // 대기 중에 mediaRemaining에 현재 여유있는 미디어가 있으면 즉시 이동
          const freeNext = a.mediaRemaining.find(m => {
            if (m.px == null && !(m.polyVerts?.length >= 3)) return false
            return busyCount(m.uid, agentsRef.current) < m.cap
          })
          if (freeNext) {
            a._wanderAngle = undefined; a._wanderDir = undefined
            a.mediaRemaining = a.mediaRemaining.filter(m => m !== freeNext)
            a.curMedia = freeNext; a.waitTime = 0; a.phase = 'moving_to_media'; return
          }
          if (a.waitTime >= effSkipThresh) {
            if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].skip += a.size
            if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].skip += a.size
            flashRef.current.push({ x: tx, y: ty, t: performance.now() })
            a._wanderAngle = undefined; decideNext(a)
          } else {
            // 미디어 풋프린트 외부 고정 궤도에서 대기
            const wZone = zonesRef.current.find(z => z.id === a.zoneId)
            const floorIdx = wZone?.floor || 0
            const sz2 = floorSizesRef.current[floorIdx] || { w: 20, h: 14 }
            const sX = CW / (sz2.w * 100) * 0.5, sY = dynCHRef.current / (sz2.h * 100) * 0.5
            const fpW = wZone ? Math.min(Math.max(MS, (a.curMedia.widthCm || 100) * sX), wZone.w) : MS
            const fpH = wZone ? Math.min(Math.max(MS, (a.curMedia.heightCm || 100) * sY), wZone.h) : MS
            const _wHasPoly = a.curMedia.polyVerts?.length >= 3
            const cx = _wHasPoly
              ? a.curMedia.polyVerts.reduce((s, v) => s + v.x, 0) / a.curMedia.polyVerts.length
              : a.curMedia.px + fpW / 2
            const cy = _wHasPoly
              ? a.curMedia.polyVerts.reduce((s, v) => s + v.y, 0) / a.curMedia.polyVerts.length
              : a.curMedia.py + fpH / 2
            // 처음 대기 시작 시: 기존 대기자들과 겹치지 않는 각도 슬롯 배정
            if (a._wanderAngle === undefined) {
              const waiters = agentsRef.current.filter(ag =>
                !ag.exited && ag._wanderAngle !== undefined &&
                ag.curMedia?.uid === a.curMedia.uid
              )
              if (waiters.length === 0) {
                a._wanderAngle = Math.random() * Math.PI * 2
              } else {
                const used = waiters.map(ag => ag._wanderAngle)
                let bestAngle = 0, maxGap = -1
                const sorted = [...used].sort((a, b) => a - b)
                sorted.push(sorted[0] + Math.PI * 2)
                for (let i = 0; i < sorted.length - 1; i++) {
                  const mid = (sorted[i] + sorted[i + 1]) / 2
                  const gap = sorted[i + 1] - sorted[i]
                  if (gap > maxGap) { maxGap = gap; bestAngle = mid % (Math.PI * 2) }
                }
                a._wanderAngle = bestAngle
              }
              a._wanderDir = Math.random() < 0.5 ? 1 : -1  // 각자 공전 방향 배정
            }
            // 궤도 반경: 실제 미디어 형태 기준 (원형은 polyVerts 반경, 사각형은 대각선)
            a._wanderAngle += 0.004 * spd * (a._wanderDir || 1)
            const wSX = CW / (sz2.w * 100) * 0.5, wSY = dynCHRef.current / (sz2.h * 100) * 0.5
            const wObs = getMediaObs(a.curMedia, wSX, wSY)
            const outerR = wObs
              ? (wObs.type === 'circle'
                ? wObs.r + MS * 1.5
                : Math.sqrt(wObs.w * wObs.w + wObs.h * wObs.h) / 2 + MS * 1.5)
              : Math.sqrt(fpW * fpW + fpH * fpH) / 2 + MS * 1.5
            const wx = cx + Math.cos(a._wanderAngle) * outerR
            const wy = cy + Math.sin(a._wanderAngle) * outerR
            const wdx = wx - a.x, wdy = wy - a.y, wd = Math.sqrt(wdx * wdx + wdy * wdy)
            const ws = 0.18 * spd
            if (wd > 0.5) { a.x += wdx / wd * Math.min(wd, ws); a.y += wdy / wd * Math.min(wd, ws) }
            // 미디어 장애물 밖으로 밀어내기 (현재 대기 미디어 포함, 내부 진입 방지)
            if (wZone) {
              const wFi2 = wZone.floor || 0
              const wSz2 = floorSizesRef.current[wFi2] || { w: 20, h: 14 }
              const wSX2 = CW / (wSz2.w * 100) * 0.5, wSY2 = dynCHRef.current / (wSz2.h * 100) * 0.5
              for (const om of wZone.media) {
                pushOutObs(a, getMediaObs(om, wSX2, wSY2))
              }
              // 존 경계 클램프
              a.x = Math.max(wZone.x + 0.5, Math.min(wZone.x + wZone.w - 0.5, a.x))
              a.y = Math.max(wZone.y + 0.5, Math.min(wZone.y + wZone.h - 0.5, a.y))
            }
            bn++
          }
          return
        }
        a.waitTime = 0
        if (d > 2) {
          const mv = Math.min(d, (a.size > 5 ? 0.22 : 0.38) * spd)
          let mvx = dx / d * mv, mvy = dy / d * mv
          // 미디어 풋프린트 장애물 우회 (rect + circle 모두 처리, 목적지는 허용)
          const mZone = zonesRef.current.find(z => z.id === a.zoneId)
          if (mZone) {
            const mFi = mZone.floor || 0
            const mSz = floorSizesRef.current[mFi] || { w: 20, h: 14 }
            const mSX = CW / (mSz.w * 100) * 0.5, mSY = dynCHRef.current / (mSz.h * 100) * 0.5
            for (const om of mZone.media) {
              if (om.uid === a.curMedia.uid) continue  // 목적지는 통과 허용
              const obs = getMediaObs(om, mSX, mSY)
              if (!obs) continue
              // 이미 장애물 안에 있으면(직전 미디어 탈출 중) 밀어내기만
              if (ptInObs(obs, a.x, a.y)) { pushOutObs(a, obs); continue }
              const nx = a.x + mvx, ny = a.y + mvy
              if (!ptInObs(obs, nx, ny)) continue
              if (obs.type === 'circle') {
                // 원형: 접선 방향으로 슬라이드
                const ang = Math.atan2(ny - obs.cy, nx - obs.cx)
                const tang = { x: -Math.sin(ang), y: Math.cos(ang) }
                const dot = mvx * tang.x + mvy * tang.y
                mvx = tang.x * dot * 0.7; mvy = tang.y * dot * 0.7
              } else {
                const xOk = !ptInObs(obs, a.x + mvx, a.y)
                const yOk = !ptInObs(obs, a.x, a.y + mvy)
                if (xOk) mvy = 0
                else if (yOk) mvx = 0
                else { mvx = 0; mvy = 0 }
              }
            }
          }
          a.x += mvx; a.y += mvy
        } else {
          const entryP = vt ? vt.entryChance(el) : 1
          if (!a._entryChecked) {
            a._entryChecked = true
            if (Math.random() > entryP) {
              if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].skip += a.size
              if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].skip += a.size
              flashRef.current.push({ x: tx, y: ty, t: performance.now() })
              a._entryChecked = false; decideNext(a); return
            }
          }
          a.x = tx; a.y = ty; a.phase = 'experiencing'; a._entryChecked = false
          const baseMult = a.isDocent ? 0.55 * (0.85 + Math.random() * 0.3) : (0.85 + Math.random() * 0.3)
          const vtMult = vt ? vt.dwellMult(el) : 1
          a.dwellTotal = a.curMedia.dwell * 1000 * baseMult * vtMult
          a.dwellLeft = a.dwellTotal
          // 체험 전환 추적 (zone당 최초 1회)
          if (a.engagedZones && !a.engagedZones.has(a.zoneId)) {
            a.engagedZones.add(a.zoneId)
            if (zoneEngagedRef.current[a.zoneId] !== undefined) {
              zoneEngagedRef.current[a.zoneId] += a.size
            }
          }
          if (skipStats.current[a.curMedia.uid]) skipStats.current[a.curMedia.uid].exp += a.size
          if (skipStats.current[`z${a.zoneId}`]) skipStats.current[`z${a.zoneId}`].exp += a.size
        }
      } else if (a.phase === 'experiencing') {
        a.dwellLeft -= dt * spd
        if (a.dwellLeft <= 0) {
          if (a.curMedia?.isTransit && a.curMedia.linkedZoneId != null) {
            enterZone(a, a.curMedia.linkedZoneId)
          } else {
            const ek = `z${a.zoneId}`
            if (!engAcc.current[ek]) engAcc.current[ek] = { score: 0, count: 0 }
            const lvl = a.curMedia ? (a.curMedia.engagementLevel || 3) : 3
            engAcc.current[ek].score += lvl * a.size
            engAcc.current[ek].count += a.size
            if (a.curMedia) {
              const mk = a.curMedia.uid
              if (!engAcc.current[mk]) engAcc.current[mk] = { score: 0, count: 0 }
              engAcc.current[mk].score += lvl * a.size
              engAcc.current[mk].count += a.size
              // 체험 완료 후 미디어 풋프린트 밖으로 탈출 (이후 이동 시 갇힘 방지)
              const expZone = zonesRef.current.find(z => z.id === a.zoneId)
              if (expZone) {
                const eFi = expZone.floor || 0
                const eSz = floorSizesRef.current[eFi] || { w: 20, h: 14 }
                const eSX = CW / (eSz.w * 100) * 0.5, eSY = dynCHRef.current / (eSz.h * 100) * 0.5
                const expObs = getMediaObs(a.curMedia, eSX, eSY)
                if (expObs) {
                  let escAng = Math.atan2(a.y - expObs.cy, a.x - expObs.cx)
                  if (!isFinite(escAng)) escAng = Math.random() * Math.PI * 2
                  const escR = (expObs.type === 'circle' ? expObs.r : Math.sqrt(expObs.w * expObs.w + expObs.h * expObs.h) / 2) + 1.5
                  a.x = expObs.cx + Math.cos(escAng) * escR
                  a.y = expObs.cy + Math.sin(escAng) * escR
                }
              }
            }
            decideNext(a)
          }
        }
      } else if (a.phase === 'moving_to_zone') {
        const nid = a.nextZoneId
        if (nid < 0) { a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime; return }
        const nz = zonesRef.current.find(z => z.id === nid)
        if (!nz) { a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime; return }
        const rtp = a._returnTargetPos
        const tx = rtp ? rtp.x : (nz.entryPos ? nz.entryPos.x : nz.x + nz.w / 2)
        const ty = rtp ? rtp.y : (nz.entryPos ? nz.entryPos.y : nz.y + nz.h / 2)
        const dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy)
        if (d > 3) { const mv = Math.min(d, (a.size > 5 ? 0.22 : 0.38) * spd); a.x += dx / d * mv; a.y += dy / d * mv }
        else { a._returnTargetPos = undefined; enterZone(a, nid) }
      }
      else if (a.phase === 'moving_to_exit') {
        const tx = a.exitTargetX, ty = a.exitTargetY
        const dx = tx - a.x, dy = ty - a.y, d = Math.sqrt(dx * dx + dy * dy)
        if (d > 3) { const mv = Math.min(d, (a.size > 5 ? 0.22 : 0.38) * spd); a.x += dx / d * mv; a.y += dy / d * mv }
        else if (a._circularFinalExit) {
          // ENTRY/EXIT 도착 → 퇴장
          a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime
        } else {
          a.phase = 'moving_to_zone'
        }
      }
      // 존 경계 클램프 — 이동 중(이존→다음존) 페이즈 제외
      if (!a.exited && a.phase !== 'moving_to_zone' && a.phase !== 'moving_to_exit') {
        const az = zonesRef.current.find(z => z.id === a.zoneId)
        if (az) {
          if (az.shape === 'ellipse') {
            const cx = az.x + az.w / 2, cy = az.y + az.h / 2, rx = az.w / 2 - 0.5, ry = az.h / 2 - 0.5
            const ddx = a.x - cx, ddy = a.y - cy
            const dist = Math.sqrt((ddx / rx) * (ddx / rx) + (ddy / ry) * (ddy / ry))
            if (dist > 1) { a.x = cx + ddx / dist * rx; a.y = cy + ddy / dist * ry }
          } else {
            a.x = Math.max(az.x + 0.5, Math.min(az.x + az.w - 0.5, a.x))
            a.y = Math.max(az.y + 0.5, Math.min(az.y + az.h - 0.5, a.y))
            if (az.shape === 'L') {
              const r = a.r ?? 0.5
              const corner = az.cutCorner ?? 'NE'
              const cw = Math.min(az.cutW ?? az.w * 0.4, az.w - 20)
              const ch = Math.min(az.cutH ?? az.h * 0.4, az.h - 20)
              let inCut = false
              switch (corner) {
                case 'NE': inCut = a.x > az.x + az.w - cw && a.y < az.y + ch; if (inCut) { const dL = a.x - (az.x + az.w - cw), dD = (az.y + ch) - a.y; if (dL < dD) a.x = az.x + az.w - cw - r; else a.y = az.y + ch + r }; break
                case 'NW': inCut = a.x < az.x + cw && a.y < az.y + ch; if (inCut) { const dR = (az.x + cw) - a.x, dD = (az.y + ch) - a.y; if (dR < dD) a.x = az.x + cw + r; else a.y = az.y + ch + r }; break
                case 'SE': inCut = a.x > az.x + az.w - cw && a.y > az.y + az.h - ch; if (inCut) { const dL = a.x - (az.x + az.w - cw), dU = a.y - (az.y + az.h - ch); if (dL < dU) a.x = az.x + az.w - cw - r; else a.y = az.y + az.h - ch - r }; break
                case 'SW': inCut = a.x < az.x + cw && a.y > az.y + az.h - ch; if (inCut) { const dR = (az.x + cw) - a.x, dU = a.y - (az.y + az.h - ch); if (dR < dU) a.x = az.x + cw + r; else a.y = az.y + az.h - ch - r }; break
              }
            }
          }
          // 미디어 풋프린트 장애물 처리 (체험 중 관람객 제외)
          if (a.phase !== 'experiencing') {
            const fi = az.floor || 0
            const szM = floorSizesRef.current[fi] || { w: 20, h: 14 }
            const sXM = CW / (szM.w * 100) * 0.5, sYM = dynCHRef.current / (szM.h * 100) * 0.5
            for (const m of az.media) {
              if (m.px == null) continue
              if (a.curMedia?.uid === m.uid) continue  // 이동 중인 목적지 미디어는 제외
              const fpW = Math.max(MS, (m.widthCm || 100) * sXM)
              const fpH = Math.max(MS, (m.heightCm || 100) * sYM)
              if (a.x >= m.px && a.x <= m.px + fpW && a.y >= m.py && a.y <= m.py + fpH) {
                const dl = a.x - m.px, dr = m.px + fpW - a.x, dt2 = a.y - m.py, db = m.py + fpH - a.y
                const mn = Math.min(dl, dr, dt2, db)
                if (mn === dl) a.x = m.px - 0.5
                else if (mn === dr) a.x = m.px + fpW + 0.5
                else if (mn === dt2) a.y = m.py - 0.5
                else a.y = m.py + fpH + 0.5
              }
            }
          }
        }
      }
    })
    agentsRef.current.forEach(a => {
      if (a.exited) return
      if (!a._lastX) { a._lastX = a.x; a._lastY = a.y; a._stuckTime = 0 }
      const moved = Math.abs(a.x - a._lastX) + Math.abs(a.y - a._lastY)
      const isWaiting = a.phase === 'moving_to_media' && a.waitTime > 0
      if (!isWaiting && moved < 0.5 && a.phase !== 'experiencing') {
        a._stuckTime = (a._stuckTime || 0) + dt * speedRef.current
        if (a._stuckTime > 8000) { a.exited = true; exitedCnt.current++; dwellTotal.current += simTimeRef.current - a.spawnTime }
      } else { a._lastX = a.x; a._lastY = a.y; a._stuckTime = 0 }
    })
    bnRef.current = Math.max(0, bn)
  }

  function updateDispStats() {
    const agents = agentsRef.current
    const liveAgents = agents.filter(a => !a.exited)
    const active = liveAgents.reduce((s, a) => s + a.size, 0)
    const avgDw = exitedCnt.current ? Math.round(dwellTotal.current / exitedCnt.current / 1000) : 0

    // 실시간 상태별 인원
    const experiencingCount = liveAgents.filter(a => a.phase === 'experiencing').reduce((s, a) => s + a.size, 0)
    const waitingCount = liveAgents.filter(a => a.phase === 'moving_to_media' && a.waitTime > 0).reduce((s, a) => s + a.size, 0)

    // ① 관람 효율: 방문된 존 / 전체 존
    const totalZones = zonesRef.current.length
    const visitedZoneCount = Object.entries(heatAcc.current).filter(([, v]) => v > 0).length
    const flowEffNum = totalZones > 0 ? Math.round(visitedZoneCount / totalZones * 100) : 0
    const flowEff = totalZones > 0 ? flowEffNum + '%' : '-'

    // ② 체험 전환율: 체험 전환 수 / 존 진입 수
    const totalEntries = Object.values(zoneEntriesRef.current).reduce((s, v) => s + v, 0)
    const totalEngaged = Object.values(zoneEngagedRef.current).reduce((s, v) => s + v, 0)
    const engRateNum = totalEntries > 0 ? Math.round(totalEngaged / totalEntries * 100) : 0
    const engRate = totalEntries > 0 ? engRateNum + '%' : '-'

    // ③ 혼잡도: 평균 대기시간 (ms→sec, 진입 수 기준)
    const totalWait = Object.values(zoneWaitAccRef.current).reduce((s, v) => s + v, 0)
    const congestionSec = totalEntries > 0 ? Math.round(totalWait / totalEntries / 1000) : 0
    const congestion = congestionSec > 0 ? congestionSec + '초' : '0초'

    // 보조: 스킵율 · 몰입 강도
    const allSS = Object.values(skipStats.current)
    const totSkip = allSS.reduce((s, v) => s + v.skip, 0)
    const totExp = allSS.reduce((s, v) => s + v.exp, 0)
    const skipRate = totSkip + totExp > 0 ? Math.round(totSkip / (totSkip + totExp) * 100) : 0
    const allEng = Object.values(engAcc.current)
    const ts2 = allEng.reduce((s, ea) => s + ea.score, 0)
    const tc2 = allEng.reduce((s, ea) => s + ea.count, 0)
    const engIdx = tc2 > 0 ? (ts2 / tc2).toFixed(1) : '-'

    // 전시 클록: spawnTimer는 spawn마다 차감되므로, 총 경과 sim 시간 = spawned×interval + 잔여
    const _slotStartHour = 9 + runningSlotRef.current
    const _spawnInterval = 60000 / (cfgRef.current.arrivalRate || 5)
    const _simElapsedMs = totalSpawnedRef.current * _spawnInterval + spawnTimer.current
    const _simElapsedSec = Math.floor(_simElapsedMs / 1000)
    const _simElapsedMin = Math.floor(_simElapsedSec / 60)
    const _simElapsedSecRem = _simElapsedSec % 60
    const _exhibMinTotal = _slotStartHour * 60 + _simElapsedMin
    const _exhibHour = Math.floor(_exhibMinTotal / 60)
    const _exhibMin = _exhibMinTotal % 60
    const simTimeDisplay = `${String(_exhibHour).padStart(2, '0')}:${String(_exhibMin).padStart(2, '0')}:${String(_simElapsedSecRem).padStart(2, '0')}`

    const slotTotal = cfgRef.current.total
    // spawn 완료 후에도 관람 중인 방문자가 있으므로 퇴장 기준으로 진행률 계산
    const _denominator = Math.max(totalSpawnedRef.current, slotTotal)
    const slotProgress = _denominator > 0 ? Math.min(100, Math.round(exitedCnt.current / _denominator * 100)) : 0
    const cumVisitors = cumulativeVisitorsRef.current + totalSpawnedRef.current

    const _totalArea = floorSizesRef.current.reduce((s, f) => s + f.w * f.h, 0)
    const densityNum = _totalArea > 0 ? +(active / _totalArea).toFixed(2) : 0
    const density = _totalArea > 0 ? densityNum.toFixed(2) + '명/㎡' : '-'

    setDispStats(p => ({
      ...p,
      curVisitors: active + '명', curVisitorsNum: active,
      experiencingCount, waitingCount,
      avgDwell: avgDw ? avgDw + '초' : '-',
      flowEff, flowEffNum,
      engRate, engRateNum,
      congestion, congestionSec,
      bottlenecks: bnRef.current + '건', bottlenecksNum: bnRef.current,
      skipRate: skipRate + '%', skipRateNum: skipRate, engIdx,
      density, densityNum,
      simTimeDisplay,
      slotProgress,
      slotVisitors: active,
      slotTotal,
      cumVisitors,
    }))

    const table = zonesRef.current.map(z => {
      const zs = skipStats.current[`z${z.id}`] || { skip: 0, exp: 0 }
      const tot = zs.skip + zs.exp, rate = tot > 0 ? Math.round(zs.skip / tot * 100) : 0
      const ea = engAcc.current[`z${z.id}`]
      const zEng = ea && ea.count > 0 ? (ea.score / ea.count).toFixed(1) : '-'
      const entries = zoneEntriesRef.current[z.id] || 0
      const engaged = zoneEngagedRef.current[z.id] || 0
      const convRate = entries > 0 ? Math.round(engaged / entries * 100) : 0
      const waitMs = zoneWaitAccRef.current[z.id] || 0
      const avgWait = entries > 0 ? Math.round(waitMs / entries / 1000) : 0
      return {
        zone: z, zs, rate, zEng, entries, engaged, convRate, avgWait,
        media: z.media.map(m => {
          const ms = skipStats.current[m.uid] || { skip: 0, exp: 0 }
          const mt = ms.skip + ms.exp, mr = mt > 0 ? Math.round(ms.skip / mt * 100) : 0
          const me = engAcc.current[m.uid]
          const mEng = me && me.count > 0 ? (me.score / me.count).toFixed(1) : '-'
          return { m, ms, mr, mEng }
        })
      }
    })
    setSkipTable(table)
  }

  function simLoop(ts) {
    if (!lastTRef.current) lastTRef.current = ts
    const dt = Math.min(ts - lastTRef.current, 50); lastTRef.current = ts
    simTimeRef.current += dt
    const cfg = cfgRef.current
    const total = cfg.total
    spawnTimer.current += dt * speedRef.current
    const spawnInterval = 60000 / (cfg.arrivalRate || 5)
    while (spawnTimer.current > spawnInterval && totalSpawnedRef.current < total) {
      spawn(); spawnTimer.current -= spawnInterval
    }
    const dc = docentCfgRef.current
    if (dc.enabled) {
      tourTimer.current += dt * speedRef.current
      const tourIntervalMs = dc.interval * 60 * 1000
      if (tourTimer.current >= tourIntervalMs) {
        spawnTour(); tourTimer.current = 0
      }
    }
    for (let i = 0; i < speedRef.current; i++) stepAgents(dt / speedRef.current)
    drawSim()
    updateDispStats()

    const _slotTotal = cfgRef.current.total
    if (_slotTotal > 0) {
      const _snapEvery = Math.max(1, Math.floor(_slotTotal / 20))
      const _snapIdx = Math.floor(totalSpawnedRef.current / _snapEvery)
      if (_snapIdx > lastSnapIdxRef.current && totalSpawnedRef.current > 0) {
        lastSnapIdxRef.current = _snapIdx
        heatSnapshotsRef.current.push({
          slotIdx: runningSlotRef.current,
          slotLabel: SLOTS[runningSlotRef.current],
          pct: Math.min(100, Math.round(totalSpawnedRef.current / _slotTotal * 100)),
          heat: { ...heatAcc.current },
          skip: Object.fromEntries(Object.entries(skipStats.current).map(([k, v]) => [k, { ...v }])),
          entries: { ...zoneEntriesRef.current },
          engaged: { ...zoneEngagedRef.current },
          wait: { ...zoneWaitAccRef.current },
        })
      }
    }

    const slotCfgNow = cfgRef.current
    const allSpawned = totalSpawnedRef.current >= slotCfgNow.total
    const allExited = agentsRef.current.length > 0 && agentsRef.current.every(a => a.exited)
    if (slotCfgNow.total > 0 && allSpawned && allExited) {
      const cur = runningSlotRef.current
      recordSlotResult(cur)
      const next = cur + 1
      if (next > simRangeRef.current.end) {
        stopSim(true)
        return
      } else {
        runningSlotRef.current = next
        cfgRef.current = slotCfgsRef.current[next]
        docentCfgRef.current = slotCfgsRef.current[next].docent
        setRunningSlot(next); setSlot(next)
        lastSnapIdxRef.current = -1
        resetSlotState()
      }
    }

    if (runRef.current && !pausedRef.current) rafRef.current = requestAnimationFrame(ts => simLoopFn.current(ts))
  }
  simLoopFn.current = simLoop

  function startSim() {
    if (runRef.current) return
    const r = simRangeRef.current
    runningSlotRef.current = r.start
    cfgRef.current = slotCfgsRef.current[r.start]
    docentCfgRef.current = slotCfgsRef.current[r.start].docent
    setRunningSlot(r.start)
    setSlot(r.start)
    setSlotResults([])
    cumulativeVisitorsRef.current = 0
    initHeat(); initSkipStats()
    resetSlotState()
    heatSnapshotsRef.current = []; lastSnapIdxRef.current = -1
    heatScrubSnapRef.current = null
    setHeatTimeline([]); setHeatScrubIdx(0)
    runRef.current = true; pausedRef.current = false; lastTRef.current = null
    setSimStatus('running')
    rafRef.current = requestAnimationFrame(ts => simLoopFn.current(ts))
  }

  function pauseSim() {
    if (!runRef.current) return
    pausedRef.current = !pausedRef.current
    setSimStatus(pausedRef.current ? 'paused' : 'running')
    if (!pausedRef.current) { lastTRef.current = null; rafRef.current = requestAnimationFrame(ts => simLoopFn.current(ts)) }
    else cancelAnimationFrame(rafRef.current)
  }

  function stopSim(finished = false) {
    cancelAnimationFrame(rafRef.current)
    runRef.current = false; pausedRef.current = false
    if (finished) {
      agentsRef.current = []; flashRef.current = []
      drawSim()
      heatSnapshotsRef.current.push({
        slotIdx: simRangeRef.current.end,
        slotLabel: SLOTS[simRangeRef.current.end],
        pct: 100,
        isFinal: true,
        heat: { ...heatAcc.current },
        skip: Object.fromEntries(Object.entries(skipStats.current).map(([k, v]) => [k, { ...v }])),
        entries: { ...zoneEntriesRef.current },
        engaged: { ...zoneEngagedRef.current },
        wait: { ...zoneWaitAccRef.current },
      })
      const tl = [...heatSnapshotsRef.current]
      heatScrubSnapRef.current = null
      setHeatTimeline(tl)
      setHeatScrubIdx(tl.length - 1)
      const _capturedZones = zonesRef.current.map(z => {
        const zss = skipStats.current[`z${z.id}`] || { skip: 0, exp: 0 }
        const ea = engAcc.current[`z${z.id}`]
        const zSR = zss.skip + zss.exp > 0 ? Math.round(zss.skip / (zss.skip + zss.exp) * 100) : 0
        const zEntries = zoneEntriesRef.current[z.id] || 0
        const zEngaged = zoneEngagedRef.current[z.id] || 0
        const zConvRate = zEntries > 0 ? Math.round(zEngaged / zEntries * 100) : 0
        const zWaitMs = zoneWaitAccRef.current[z.id] || 0
        const zAvgWait = zEntries > 0 ? Math.round(zWaitMs / zEntries / 1000) : 0
        return {
          id: z.id, name: z.name, floor: z.floor || 0,
          skipRate: zSR, skipCount: zss.skip, expCount: zss.exp,
          engIdx: ea && ea.count > 0 ? parseFloat((ea.score / ea.count).toFixed(1)) : null,
          heatVal: Math.round(heatAcc.current[z.id] || 0),
          entries: zEntries, engaged: zEngaged, convRate: zConvRate, avgWait: zAvgWait,
          media: z.media.map(m => {
            const ms = skipStats.current[m.uid] || { skip: 0, exp: 0 }
            const me = engAcc.current[m.uid]
            return {
              uid: m.uid, name: m.label || m.name || m.id, type: m.id, color: m.color, bg: m.bg,
              skipRate: ms.skip + ms.exp > 0 ? Math.round(ms.skip / (ms.skip + ms.exp) * 100) : 0,
              exposure: ms.skip + ms.exp, skipCount: ms.skip,
              engIdx: me && me.count > 0 ? parseFloat((me.score / me.count).toFixed(1)) : null,
            }
          }),
        }
      })
      const _totalEntries = _capturedZones.reduce((s, z) => s + z.entries, 0)
      const _totalEngaged = _capturedZones.reduce((s, z) => s + z.engaged, 0)
      const _overallFlowEff = _capturedZones.length > 0 ? Math.round(_capturedZones.filter(z => z.entries > 0).length / _capturedZones.length * 100) : 0
      const _overallEngRate = _totalEntries > 0 ? Math.round(_totalEngaged / _totalEntries * 100) : 0
      const _totalWait = _capturedZones.reduce((s, z) => s + (z.avgWait * z.entries), 0)
      const _overallAvgWait = _totalEntries > 0 ? Math.round(_totalWait / _totalEntries) : 0
      const _capturedRange = {
        start: simRangeRef.current.start, end: simRangeRef.current.end,
        label: simRangeRef.current.start === simRangeRef.current.end
          ? SLOTS[simRangeRef.current.start]
          : `${SLOTS[simRangeRef.current.start]} ~ ${SLOTS[simRangeRef.current.end]}`,
      }
      setSlotResults(prev => {
        const _entryId = Date.now()
        const _ts = new Date().toLocaleString('ko-KR')
        const _project = projectName || '(프로젝트)'
        const _scenario = scenarioName || '시나리오 1'
        setReportData({
          zones: _capturedZones, range: _capturedRange, slotResults: prev,
          flowEff: _overallFlowEff, engRate: _overallEngRate, avgWait: _overallAvgWait,
          _logId: _entryId, _project, _scenario, _ts, _rangeLabel: _capturedRange.label, _runNo: null
        })
        const entry = {
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
        setSimLogs(logs => {
          const updated = [entry, ...logs].slice(0, 30)
          try { localStorage.setItem('exsim_logs', JSON.stringify(updated)) } catch { }
          return updated
        })
        return prev
      })
    } else {
      resetSlotState(); initHeat(); initSkipStats()
      heatSnapshotsRef.current = []; lastSnapIdxRef.current = -1
      heatScrubSnapRef.current = null
      setHeatTimeline([]); setHeatScrubIdx(0)
      setReportData(null)
      drawSim()
    }
    setSimStatus(finished ? 'done' : 'idle')
    if (!finished) setSlotResults([])
    setDispStats(p => ({
      ...p,
      curVisitors: '0명', curVisitorsNum: 0,
      density: '-', densityNum: 0,
      experiencingCount: 0, waitingCount: 0,
      congestion: '-', congestionSec: 0,
      bottlenecks: '-', bottlenecksNum: 0,
      skipRate: '-', skipRateNum: 0,
      avgDwell: '-', engIdx: '-',
      simTimeDisplay: '00:00:00',
      slotProgress: 0, slotVisitors: 0,
    }))
    setSkipTable([])
  }

  return {
    initSkipStats,
    initHeat,
    recordSlotResult,
    resetSlotState,
    getNextZone,
    getEntryZoneId,
    getExitZoneId,
    decideNext,
    enterZone,
    spawn,
    spawnTour,
    getMediaObs,
    ptInObs,
    pushOutObs,
    stepAgents,
    updateDispStats,
    simLoop,
    startSim,
    pauseSim,
    stopSim,
  }
}
