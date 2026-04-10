import { Sbc } from '../ui'
import useSimStore from '../../store/simulationStore'

export default function StatBar({ tab }) {
  const { dispStats } = useSimStore()
  const d = dispStats

  // ── Analyze 탭: 스냅샷 시점 분석 지표 ──
  if (tab === 'heat') {
    return (
      <div className="stat-bar">
        <Sbc label="관람객" value={d.totalVisitors > 0 ? d.totalVisitors+'명' : '-'}/>
        <Sbc label="체험인원" value={d.totalEngaged > 0 ? d.totalEngaged+'명' : '-'}/>
        <Sbc label="도달률" value={d.flowEff ?? '-'}
          cls={d.flowEffNum>70?'ok':d.flowEffNum>0&&d.flowEffNum<40?'warn':''}
          tooltip={<>
            <strong>도달률 (Zone Reach Rate)</strong><br/>
            방문된 존 수 / 전체 존 수<br/><br/>
            낮으면 → 동선 설계 또는 흥미 문제<br/>
            70% 이상 → 우수
          </>}/>
        <Sbc label="체험 전환율" value={d.engRate ?? '-'}
          cls={d.engRateNum>60?'ok':d.engRateNum>0&&d.engRateNum<30?'warn':''}
          tooltip={<>
            <strong>체험 전환율 (Engagement Rate)</strong><br/>
            체험 시작한 방문자 / 존 진입 방문자<br/><br/>
            30% 미만 → 대기 과다 또는 콘텐츠 문제<br/>
            60% 이상 → 우수
          </>}/>
        <Sbc label="평균 혼잡도" value={d.congestion ?? '-'}
          cls={d.congestionSec>20?'warn':d.congestionSec>10?'':''}
          tooltip={<>
            <strong>평균 혼잡도 (Congestion)</strong><br/>
            평균 대기시간 (진입 방문자 기준)<br/><br/>
            20초 초과 → 병목 발생<br/>
            0~5초 → 원활
          </>}/>
        <Sbc label="병목구간" value={d.bottlenecks ?? '-'}
          cls={d.bottlenecksNum>0?'warn':''}
          tooltip={<>
            <strong>병목구간</strong><br/>
            평균 대기시간이 20초를 초과한 구역 수입니다.
          </>}/>
        <Sbc label="평균 스킵율" value={d.skipRate ?? '-'}
          cls={d.skipRateNum>30?'warn':d.skipRateNum<10&&d.skipRateNum>0?'ok':''}/>
      </div>
    )
  }

  // ── Simulate / Insights 탭: 실시간 현황 ──
  return (
    <div className="stat-bar" style={{display:(tab==='build'||tab==='report'||tab==='sim')?'none':undefined}}>
      {/* 공간 관점 */}
      <Sbc label="현재 관람객" value={d.curVisitors ?? '-'}/>
      <Sbc label="밀집도" value={d.density ?? '-'}
        cls={d.densityNum>0.5?'warn':d.densityNum>0.2?'':''}
        tooltip={<>
          <strong>밀집도 (Density)</strong><br/>
          현재 관람객 수 / 전시 면적 (명/㎡)<br/><br/>
          0.5명/㎡ 초과 → 혼잡 우려<br/>
          0.2명/㎡ 이하 → 여유
        </>}/>
      {/* 구분선 */}
      <div className="stat-divider"/>
      {/* 미디어 관점 */}
      <Sbc label="체험 중" value={d.experiencingCount != null ? d.experiencingCount+'명' : '-'}
        cls={d.experiencingCount>0?'ok':''}/>
      <Sbc label="대기 중" value={d.waitingCount != null ? d.waitingCount+'명' : '-'}
        cls={d.waitingCount>5?'warn':''}/>
      <Sbc label="혼잡도" value={d.congestion ?? '-'}
        cls={d.congestionSec>20?'warn':d.congestionSec>10?'':''}
        tooltip={<>
          <strong>혼잡도 (Congestion)</strong><br/>
          평균 대기시간 (진입 방문자 기준)<br/><br/>
          20초 초과 → 병목 발생<br/>
          0~5초 → 원활
        </>}/>
      <Sbc label="병목" value={d.bottlenecks ?? '-'}
        cls={d.bottlenecksNum>0?'warn':''}
        tooltip={<>
          <strong>병목 발생</strong><br/>
          동시 대기 인원이 수용 인원을 초과한<br/>미디어/구역의 누적 횟수입니다.
        </>}/>
      <Sbc label="스킵율" value={d.skipRate ?? '-'}
        cls={d.skipRateNum>30?'warn':d.skipRateNum<10&&d.skipRateNum>0?'ok':''}/>
    </div>
  )
}
