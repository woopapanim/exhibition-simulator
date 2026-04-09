import ReportView from './ReportView'
import SimLogCard from './SimLogCard'

/**
 * ResultPanel — Report 탭 UI
 */
export default function ResultPanel({
  reportData,
  slotResults,
  simLogs,
  setSimLogs,
  saveReport,
  tab,
}) {
  return (
    <div style={{display: tab==='report' ? '' : 'none'}}>
      {/* 헤더 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <span style={{fontSize:14,fontWeight:700,color:'#111'}}>분석 리포트</span>
          {reportData&&<span style={{fontSize:11,color:'#888',marginLeft:8}}>{reportData.range.label}</span>}
        </div>
        <button className="btn-s" onClick={saveReport}
          disabled={!reportData&&slotResults.length===0}
          title="시뮬레이션 결과를 엑셀 파일로 저장">
          ⬇ 엑셀 저장
        </button>
      </div>

      {!reportData&&slotResults.length===0
        ? <div className="rpt-warn caution"><span>●</span><span>시뮬레이션을 실행하면 분석 결과가 표시됩니다.</span></div>
        : <ReportView data={reportData||{slotResults,zones:[],rangeLabel:''}} visible={tab==='report'}/>
      }

      {/* 실행 히스토리 */}
      <div style={{marginTop:18}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:700,color:'#222'}}>📋 실행 히스토리</span>
          {simLogs.length>0&&(
            <button className="btn-s" style={{fontSize:10,color:'#e55',borderColor:'#fcc'}}
              onClick={()=>{
                if (!window.confirm('모든 히스토리를 삭제할까요?')) return
                setSimLogs([])
                try { localStorage.removeItem('exsim_logs') } catch {}
              }}>전체 삭제</button>
          )}
        </div>
        {simLogs.length===0
          ? <div style={{fontSize:11,color:'#aaa',padding:'12px 0',textAlign:'center'}}>저장된 실행 기록이 없습니다.</div>
          : simLogs.map(log=>(
            <SimLogCard key={log.id} log={log} onDelete={id=>{
              setSimLogs(prev=>{
                const next=prev.filter(l=>l.id!==id)
                try { localStorage.setItem('exsim_logs', JSON.stringify(next)) } catch {}
                return next
              })
            }}/>
          ))
        }
      </div>
    </div>
  )
}
