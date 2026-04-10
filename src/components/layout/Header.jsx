export default function Header({ projectName, setProjectName, scenarioName, setScenarioName, tab, setTab, saveSettings, loadSettings }) {
  return (
    <div className="app-header">
      {/* 로고 + 프로젝트 > 시나리오 breadcrumb */}
      <div className="hdr-logo">
        <h1>AION mark1</h1>
        {projectName && (
          <div className="hdr-breadcrumb">
            <div className="hdr-project-name">
              <span>{projectName}</span>
              <button className="hdr-project-change" onClick={() => {
                const newName = window.prompt('프로젝트 이름 변경', projectName)
                if (newName && newName.trim()) {
                  const trimmed = newName.trim()
                  setProjectName(trimmed)
                  localStorage.setItem('exsim_projectName', trimmed)
                }
              }} title="프로젝트 이름 변경">
                <span className="material-icons mi-sm">edit</span>
              </button>
            </div>
            <span className="hdr-breadcrumb-sep">
              <span className="material-icons mi-sm" style={{opacity:0.38,fontSize:16}}>chevron_right</span>
            </span>
            <div className="hdr-scenario-name">
              <span>{scenarioName}</span>
              <button className="hdr-project-change" onClick={() => {
                const newName = window.prompt('시나리오 이름 변경', scenarioName)
                if (newName && newName.trim()) {
                  const trimmed = newName.trim()
                  setScenarioName(trimmed)
                  localStorage.setItem('exsim_scenarioName', trimmed)
                }
              }} title="시나리오 이름 변경">
                <span className="material-icons mi-sm">edit</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 탭 내비게이션 */}
      <nav className="hdr-nav">
        {[
          ['build',  'Build'],
          ['sim',    'Simulate'],
          ['heat',   'Analyze'],
          ['report', 'Insights'],
        ].map(([id, label]) => (
          <button key={id} className={`hdr-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* 우측 버튼 영역 */}
      <div className="hdr-btns">
        {/* 새 프로젝트 */}
        <div className="hdr-tooltip-wrap">
          <button className="hdr-icon-btn" onClick={() => {
            if (window.confirm('현재 프로젝트를 닫고 새 프로젝트를 만드시겠어요?\n저장되지 않은 변경사항은 사라집니다.')) {
              localStorage.removeItem('exsim_data')
              localStorage.removeItem('exsim_projectName')
              localStorage.removeItem('exsim_scenarioName')
              setScenarioName('시나리오 1')
              setProjectName('')
            }
          }}>
            <span className="material-icons">add</span>
          </button>
          <span className="hdr-tooltip">새 프로젝트</span>
        </div>

        {/* 저장 */}
        <div className="hdr-tooltip-wrap">
          <button className="hdr-icon-btn" onClick={saveSettings}>
            <span className="material-icons">download</span>
          </button>
          <span className="hdr-tooltip">저장</span>
        </div>

        {/* 불러오기 */}
        <div className="hdr-tooltip-wrap">
          <label className="hdr-icon-btn" htmlFor="exsim-load-input" style={{ cursor:'pointer' }}>
            <span className="material-icons">upload</span>
          </label>
          <span className="hdr-tooltip">불러오기</span>
        </div>
        <input
          id="exsim-load-input"
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={loadSettings}
          onClick={e => { e.target.value = '' }}
        />

        <div className="hdr-divider" />
        <button className="hdr-login-btn">Log in</button>
        <button className="hdr-signup-btn">Sign up</button>
      </div>
    </div>
  )
}
