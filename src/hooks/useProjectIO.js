import * as XLSX from 'xlsx'
import { clone, layoutAll } from '../utils'
import { SLOTS } from '../constants'

export function useProjectIO({
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
}) {
  async function saveSettings() {
    const data=JSON.stringify({
      version:2,
      projectName: projectName||'',
      scenarioName: scenarioName||'',
      zones:zonesRef.current,
      slotCfgs:slotCfgsRef.current,
      floorCount: floorCountRef.current,
      floorSizes: floorSizesRef.current,
      simLogs,
    },null,2)
    const fileName=`${projectName||'exhibition'}-${new Date().toISOString().slice(0,10)}.json`
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
        if (e.name==='AbortError') return
      }
    }
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
        zonesRef.current=d.zones
        setZones(clone(d.zones))
        const fc=d.floorCount||1
        setFloorCount(fc); setViewFloor(0); viewFloorRef.current=0
        const fs=d.floorSizes||Array.from({length:fc},()=>({w:20,h:14}))
        setFloorSizes(fs); floorSizesRef.current=fs
        if (d.slotCfgs) {
          setSlotCfgs(d.slotCfgs)
          slotCfgsRef.current=d.slotCfgs
        }
        if (d.projectName) {
          setProjectName(d.projectName)
          localStorage.setItem('exsim_projectName', d.projectName)
        } else {
          const nameFromFile=file.name.replace(/-\d{4}-\d{2}-\d{2}\.json$/, '').replace(/\.json$/, '')
          if (nameFromFile) { setProjectName(nameFromFile); localStorage.setItem('exsim_projectName', nameFromFile) }
        }
        if (d.scenarioName) {
          setScenarioName(d.scenarioName)
          localStorage.setItem('exsim_scenarioName', d.scenarioName)
        }
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

  function onAnalyzeLog(log) {
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
    const tl = log.heatTimeline || []
    heatSnapshotsRef.current = tl
    heatScrubSnapRef.current = null
    setHeatTimeline(tl)
    setHeatScrubIdx(tl.length > 0 ? tl.length - 1 : 0)
    setTimeout(() => {
      computeHeatZoneStats(null)
      updateDispStatsFromSnap(null)
      drawHeat()
    }, 0)
    setTab('heat')
  }

  return { saveSettings, loadSettings, saveReport, onAnalyzeLog }
}
