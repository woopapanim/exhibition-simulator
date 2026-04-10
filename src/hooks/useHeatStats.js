export function useHeatStats({
  zonesRef, floorSizesRef,
  zoneEntriesRef, zoneEngagedRef, zoneWaitAccRef,
  heatAcc, skipStats,
  setHeatZoneStats, setDispStats,
}) {
  function computeHeatZoneStats(snap) {
    const entriesData=snap?(snap.entries||{}):zoneEntriesRef.current
    const engagedData=snap?(snap.engaged||{}):zoneEngagedRef.current
    const waitData=snap?(snap.wait||{}):zoneWaitAccRef.current
    const heatData=snap?snap.heat:heatAcc.current
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

  function updateDispStatsFromSnap(snap) {
    const entriesData = snap ? (snap.entries||{}) : zoneEntriesRef.current
    const engagedData = snap ? (snap.engaged||{}) : zoneEngagedRef.current
    const waitData    = snap ? (snap.wait||{})    : zoneWaitAccRef.current
    const heatData    = snap ? snap.heat          : heatAcc.current
    const skipData    = snap ? snap.skip          : skipStats.current

    const totalZones = zonesRef.current.length
    const visitedZones = Object.entries(heatData).filter(([,v])=>v>0).length
    const flowEffNum = totalZones>0 ? Math.round(visitedZones/totalZones*100) : 0
    const flowEff    = totalZones>0 ? flowEffNum+'%' : '-'

    const totalEntries  = Object.values(entriesData).reduce((s,v)=>s+v,0)
    const totalEngaged  = Object.values(engagedData).reduce((s,v)=>s+v,0)
    const engRateNum    = totalEntries>0 ? Math.round(totalEngaged/totalEntries*100) : 0
    const engRate       = totalEntries>0 ? engRateNum+'%' : '-'

    const totalWait     = Object.values(waitData).reduce((s,v)=>s+v,0)
    const congestionSec = totalEntries>0 ? Math.round(totalWait/totalEntries/1000) : 0
    const congestion    = congestionSec>0 ? congestionSec+'초' : '0초'

    const allSS  = Object.values(skipData)
    const totSkip= allSS.reduce((s,v)=>s+v.skip,0)
    const totExp = allSS.reduce((s,v)=>s+v.exp,0)
    const skipRateNum = totSkip+totExp>0 ? Math.round(totSkip/(totSkip+totExp)*100) : 0
    const skipRate    = skipRateNum+'%'

    const bottlenecksNum = zonesRef.current.filter(z=>{
      const e=entriesData[z.id]||0
      const w=waitData[z.id]||0
      return e>0 && Math.round(w/e/1000)>20
    }).length

    const _snapArea = floorSizesRef.current.reduce((s,f)=>s+f.w*f.h, 0)
    const _peakDens = zonesRef.current.reduce((max, z) => {
      const d = (entriesData[z.id]||0) / Math.max(z.w*z.h, 1)
      return d > max ? d : max
    }, 0)
    const densityNum = _snapArea>0 ? +(_peakDens).toFixed(2) : 0
    const density = densityNum>0 ? densityNum.toFixed(2)+'명/㎡' : '-'

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

  return { computeHeatZoneStats, updateDispStatsFromSnap }
}
