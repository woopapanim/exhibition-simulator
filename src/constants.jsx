// ─────────────────────────── 미디어 타입 ───────────────────────────

export const MT = [
  { id:'led',    label:'LED/미디어월',  icon:'📺', color:'#5A8FA8', bg:'#F2F5F3', cap:50, dwell:20, desc:'영상 루프',        widthCm:400, heightCm:250, engagementLevel:3 },
  { id:'touch',  label:'터치 스크린',   icon:'👆', color:'#4A8A72', bg:'#F2F5F3', cap:3,  dwell:30, desc:'멀티터치',        widthCm:80,  heightCm:150, engagementLevel:4 },
  { id:'proj',   label:'프로젝션 맵핑', icon:'🎞', color:'#6B65A8', bg:'#F2F5F3', cap:40, dwell:40, desc:'몰입형 프로젝션',  widthCm:600, heightCm:400, engagementLevel:5 },
  { id:'kiosk',  label:'키오스크',      icon:'🖥', color:'#5A8050', bg:'#F2F5F3', cap:1,  dwell:25, desc:'1인 탐색',         widthCm:60,  heightCm:60,  engagementLevel:3 },
  { id:'arvr',   label:'AR/VR 부스',    icon:'🥽', color:'#8A6050', bg:'#F2F5F3', cap:1,  dwell:45, desc:'가상 체험',        widthCm:150, heightCm:150, engagementLevel:5 },
  { id:'sound',  label:'사운드',     icon:'🔊', color:'#8A7550', bg:'#F2F5F3', cap:30, dwell:15, desc:'음향 체험',        widthCm:500, heightCm:500, engagementLevel:2 },
  { id:'sensor',      label:'피지컬 인터랙션',  icon:'✋', color:'#8A5070', bg:'#F2F5F3', cap:8,  dwell:20, desc:'피지컬 인터랙션',      widthCm:100, heightCm:100, engagementLevel:4 },
  { id:'infographic', label:'인포그래픽 패널',  icon:'📋', color:'#508098', bg:'#F2F5F3', cap:15, dwell:10, desc:'정보 패널',            widthCm:120, heightCm:180, engagementLevel:2 },
  { id:'immersive',   label:'몰입형 미디어룸',  icon:'🌐', color:'#6055A0', bg:'#F2F5F3', cap:30, dwell:60, desc:'몰입형 체험 공간',      widthCm:600, heightCm:500, engagementLevel:5 },
  { id:'mediaart',    label:'미디어 아트',      icon:'🎨', color:'#A05080', bg:'#F2F5F3', cap:20, dwell:25, desc:'인터랙티브 아트',       widthCm:300, heightCm:300, engagementLevel:4 },
  { id:'physical',    label:'실물전시',         icon:'🏺', color:'#708055', bg:'#F2F5F3', cap:10, dwell:20, desc:'오브제 전시',           widthCm:200, heightCm:150, engagementLevel:3 },
]

export const FT = [
  { id:'elevator', label:'엘리베이터',  icon:'🛗', color:'#707898', bg:'#F2F5F3', cap:4,  dwell:60,   desc:'구역 이동 (엘리베이터)', widthCm:200, heightCm:200, engagementLevel:1, isTransit:true },
  { id:'lounge',   label:'휴게공간',    icon:'🛋', color:'#907870', bg:'#F2F5F3', cap:20, dwell:300,  desc:'휴식 공간',              widthCm:400, heightCm:300, engagementLevel:1 },
  { id:'fnb',      label:'F&B',         icon:'🍽', color:'#A06050', bg:'#F2F5F3', cap:30, dwell:1200, desc:'식음료 시설',            widthCm:500, heightCm:400, engagementLevel:1 },
  { id:'greeting', label:'그리팅(등록)',icon:'🎫', color:'#508070', bg:'#F2F5F3', cap:5,  dwell:300,  desc:'입장 등록 데스크',       widthCm:200, heightCm:150, engagementLevel:1 },
  { id:'retail',   label:'판매시설',    icon:'🛍', color:'#806898', bg:'#F2F5F3', cap:15, dwell:600,  desc:'기념품·판매 공간',       widthCm:300, heightCm:250, engagementLevel:1 },
]

export const ALL_MT = [...MT, ...FT]

// ─────────────────────────── 존 초기값 ───────────────────────────

export const INIT_ZONES = [
  { id:0, name:'Lobby', x:14, y:14, w:200, h:120, media:[], defCap:30, defDwell:10, floor:0, order:0, flowType:'guided', entryPos:{x:14+8,y:14+8}, returnPos:null, exitPos:{x:14+200-8,y:14+8} },
]

// ─────────────────────────── 캔버스 & 레이아웃 ───────────────────────────

export const CW = 440
export const CH = 310
export const MS = 10   // media icon size
export const MG = 4    // media gap
export const MP = 6    // media padding
export const ROOM_W = 2000
export const ROOM_H = 1400

// ─────────────────────────── 시간대 & 슬롯 ───────────────────────────

export const SLOTS = ['9시','10시','11시','12시','13시','14시','15시','16시','17시','18시']
export const SLOT_DEF_TOTALS = [30, 50, 80, 70, 60, 90, 100, 80, 50, 20]

export const makeSlotCfg = (total = 80) => ({
  total,
  arrivalRate: 5,
  skipThresh: 15,
  segs: { individual:30, smallGroup:20, studentGroup:20, corpGroup:15, genGroup:15 },
  docent: { enabled:false, interval:30, size:20 },
  visitorTypes: { quick:33, info:34, immersive:33 },
})

// ─────────────────────────── 방문자 세그먼트 ───────────────────────────

export const SEGS = [
  { key:'individual',   label:'개인(1인)',         short:'개인',     color:'#378ADD', r:4 },
  { key:'smallGroup',   label:'소그룹 2~5인',       short:'소그룹',   color:'#18181b', r:5 },
  { key:'studentGroup', label:'단체-학생 10~30인',  short:'단체-학생', color:'#7F77DD', r:8 },
  { key:'corpGroup',    label:'단체-기업 10~50인',  short:'단체-기업', color:'#7c3aed', r:8 },
  { key:'genGroup',     label:'단체-일반 6~20인',   short:'단체-일반', color:'#F07D4A', r:7 },
]

export const DOCENT_COLOR = '#B87D2B'

export const VISITOR_TYPES = [
  { key:'quick',     label:'빠른 관람형', icon:'⚡', color:'#E89B35',
    entryChance: el => el>=5?0.65:el>=4?0.75:el>=3?0.88:el>=2?0.92:0.95,
    dwellMult:   el => el>=5?0.50:el>=4?0.60:el>=3?0.78:el>=2?0.90:1.00,
    waitMult:    el => el>=5?0.35:el>=4?0.45:el>=3?0.70:el>=2?0.90:1.00,
  },
  { key:'info',      label:'정보 탐색형', icon:'🔍', color:'#378ADD',
    entryChance: el => el>=5?0.78:el>=4?0.85:el>=3?0.95:el>=2?0.95:0.88,
    dwellMult:   el => el>=5?0.85:el>=4?0.92:el>=3?1.20:el>=2?1.30:0.90,
    waitMult:    el => el>=5?0.80:el>=4?0.92:el>=3?1.25:el>=2?1.30:0.90,
  },
  { key:'immersive', label:'체험 몰입형', icon:'🎯', color:'#7B4FB8',
    entryChance: el => el>=5?1.00:el>=4?0.97:el>=3?0.92:el>=2?0.82:0.72,
    dwellMult:   el => el>=5?1.60:el>=4?1.40:el>=3?1.10:el>=2?0.90:0.85,
    waitMult:    el => el>=5?2.20:el>=4?1.80:el>=3?1.30:el>=2?0.90:0.80,
  },
]

// ─────────────────────────── SVG 아이콘 (캔버스용) ───────────────────────────

export const ICON_SVG_STR = {
  led:         '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  touch:       '<path d="M9 11V5a2 2 0 1 1 4 0v6"/><path d="M13 9a2 2 0 1 1 4 0v3"/><path d="M5 14a2 2 0 1 1 4 0v-3"/><path d="M9 20c0 1.1.9 2 2 2h3a4 4 0 0 0 4-4v-3"/><path d="M21 4c.6.9 1 2 1 3"/><path d="M19 2c1.3 1.5 2 3.4 2 5.5"/>',
  proj:        '<rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M7 8V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2"/><circle cx="18" cy="5" r="1" fill="currentColor" stroke="none"/>',
  kiosk:       '<rect x="4" y="2" width="16" height="11" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="9.5" x2="13" y2="9.5"/><path d="M10 13v3"/><path d="M14 13v3"/><rect x="3" y="16" width="18" height="6" rx="2"/>',
  arvr:        '<path d="M2 12l2-6h16l2 6"/><rect x="2" y="12" width="8" height="6" rx="2"/><rect x="14" y="12" width="8" height="6" rx="2"/><path d="M10 15h4"/>',
  sound:       '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  sensor:      '<circle cx="12" cy="4" r="2.5"/><path d="M8 9q4 2 8 0L17 22H7z"/><path d="M8 10L3 5"/><path d="M16 10L21 5"/>',
  infographic: '<line x1="2" y1="20" x2="22" y2="20"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/><line x1="3" y1="14" x2="9" y2="14"/><line x1="9" y1="4" x2="15" y2="4"/><line x1="15" y1="10" x2="21" y2="10"/>',
  immersive:   '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  mediaart:    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><circle cx="9" cy="11" r="4"/><circle cx="7.5" cy="11" r="1"/><circle cx="9" cy="9.5" r="1"/><circle cx="10.5" cy="11" r="1"/><line x1="20" y1="5" x2="14" y2="12"/>',
  physical:    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  elevator:    '<rect x="5" y="2" width="14" height="20" rx="2"/><polyline points="9 8 12 5 15 8"/><polyline points="15 16 12 19 9 16"/>',
  lounge:      '<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><path d="M2 9a2 2 0 0 1 2 2v1h16v-1a2 2 0 0 1 4 0v5H2V11a2 2 0 0 1 2-2z"/><line x1="4" y1="17" x2="4" y2="21"/><line x1="20" y1="17" x2="20" y2="21"/>',
  fnb:         '<line x1="8" y1="6" x2="8" y2="2"/><line x1="8" y1="22" x2="8" y2="14"/><path d="M5 2h6v12a3 3 0 0 1-6 0V2z"/><line x1="17" y1="2" x2="17" y2="22"/>',
  greeting:    '<path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2"/><path d="M13 9h6"/><path d="M13 12h4"/><circle cx="7" cy="12" r="3"/>',
  retail:      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
}

// ─────────────────────────── SVG 아이콘 (JSX/UI용) ───────────────────────────

export const ICON_PATHS = {
  led:         <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  touch:       <><path d="M9 11V5a2 2 0 1 1 4 0v6"/><path d="M13 9a2 2 0 1 1 4 0v3"/><path d="M5 14a2 2 0 1 1 4 0v-3"/><path d="M9 20c0 1.1.9 2 2 2h3a4 4 0 0 0 4-4v-3"/><path d="M21 4c.6.9 1 2 1 3"/><path d="M19 2c1.3 1.5 2 3.4 2 5.5"/></>,
  proj:        <><rect x="2" y="8" width="20" height="12" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M7 8V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2"/><circle cx="18" cy="5" r="1" fill="currentColor" stroke="none"/></>,
  kiosk:       <><rect x="4" y="2" width="16" height="11" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="9.5" x2="13" y2="9.5"/><path d="M10 13v3"/><path d="M14 13v3"/><rect x="3" y="16" width="18" height="6" rx="2"/></>,
  arvr:        <><path d="M2 12l2-6h16l2 6"/><rect x="2" y="12" width="8" height="6" rx="2"/><rect x="14" y="12" width="8" height="6" rx="2"/><path d="M10 15h4"/></>,
  sound:       <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>,
  sensor:      <><circle cx="12" cy="4" r="2.5"/><path d="M8 9q4 2 8 0L17 22H7z"/><path d="M8 10L3 5"/><path d="M16 10L21 5"/></>,
  infographic: <><line x1="2" y1="20" x2="22" y2="20"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/><line x1="3" y1="14" x2="9" y2="14"/><line x1="9" y1="4" x2="15" y2="4"/><line x1="15" y1="10" x2="21" y2="10"/></>,
  immersive:   <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  mediaart:    <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><circle cx="9" cy="11" r="4"/><circle cx="7.5" cy="11" r="1"/><circle cx="9" cy="9.5" r="1"/><circle cx="10.5" cy="11" r="1"/><line x1="20" y1="5" x2="14" y2="12"/></>,
  physical:    <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  elevator:    <><rect x="5" y="2" width="14" height="20" rx="2"/><polyline points="9 8 12 5 15 8"/><polyline points="15 16 12 19 9 16"/></>,
  lounge:      <><path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><path d="M2 9a2 2 0 0 1 2 2v1h16v-1a2 2 0 0 1 4 0v5H2V11a2 2 0 0 1 2-2z"/><line x1="4" y1="17" x2="4" y2="21"/><line x1="20" y1="17" x2="20" y2="21"/></>,
  fnb:         <><line x1="8" y1="6" x2="8" y2="2"/><line x1="8" y1="22" x2="8" y2="14"/><path d="M5 2h6v12a3 3 0 0 1-6 0V2z"/><line x1="17" y1="2" x2="17" y2="22"/></>,
  greeting:    <><path d="M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2"/><path d="M13 9h6"/><path d="M13 12h4"/><circle cx="7" cy="12" r="3"/></>,
  retail:      <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
  quick:       <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  info:        <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  immersiveV:  <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
}
