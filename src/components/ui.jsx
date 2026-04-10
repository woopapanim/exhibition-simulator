import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ICON_PATHS } from '../constants'

/** overflow 컨테이너를 탈출하는 포탈 기반 툴팁 */
export function PortalTip({ label, children }) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState(null)
  const iconRef = useRef(null)

  function show() {
    if (iconRef.current) setRect(iconRef.current.getBoundingClientRect())
    setVisible(true)
  }
  function hide() { setVisible(false) }

  const TW = 210, MARGIN = 10
  const centerX = rect ? Math.round(rect.left + rect.width / 2) : 0
  const clampedLeft = rect
    ? Math.max(TW / 2 + MARGIN, Math.min(centerX, window.innerWidth - TW / 2 - MARGIN))
    : 0

  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
      {label}
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
          width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.08)',
          fontSize:9,fontWeight:700,color:'#71717a',cursor:'default',flexShrink:0}}
      >i</span>
      {visible && rect && createPortal(
        <div style={{
          position:'fixed',
          left: clampedLeft,
          top: Math.round(rect.top - 8),
          transform:'translate(-50%,-100%)',
          background:'rgba(97,97,97,0.92)', color:'#fff',
          fontSize:'12px', fontWeight:400, lineHeight:1.5,
          padding:'8px 12px', borderRadius:'4px',
          whiteSpace:'normal', width: TW + 'px',
          pointerEvents:'none', zIndex:99999,
          boxShadow:'0 8px 10px rgba(0,0,0,.14), 0 3px 14px rgba(0,0,0,.12), 0 5px 5px rgba(0,0,0,.20)',
          letterSpacing:'0.01786em',
        }}>{children}</div>,
        document.body
      )}
    </span>
  )
}

/** 채움 그라디언트 슬라이더 */
export function SliderInput({ min=0, max=100, step=1, value, onChange, style={}, ...props }) {
  const pct = Math.round(((+value - +min) / (+max - +min)) * 100)
  const bg = `linear-gradient(to right, #18181b 0%, #18181b ${pct}%, #d4d4d8 ${pct}%, #d4d4d8 100%)`
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={onChange}
      style={{background: bg, ...style}}
      {...props}
    />
  )
}

/** 미디어 타입 아이콘 (SVG) */
export function MediaIcon({ id, size=18, color='currentColor' }) {
  const paths = ICON_PATHS[id] || <circle cx="12" cy="12" r="10"/>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{display:'block',flexShrink:0}}>
      {paths}
    </svg>
  )
}

/** 통계 바 셀 */
export function Sbc({ label, value, cls='', tooltip=null }) {
  const [open, setOpen] = useState(false)

  useEffect(()=>{
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="sbc" style={{position:'relative'}}>
      <div className="sbc-l" style={{display:'flex',alignItems:'center',gap:3}}>
        {label}
        {tooltip && (
          <>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={()=>setOpen(o=>!o)}
              style={{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,color:'#a1a1aa',fontSize:11,fontWeight:700}}>
              ⓘ
            </button>
            {open && (
              <div style={{position:'absolute',top:'100%',left:0,zIndex:200,background:'rgba(97,97,97,0.92)',color:'#fff',borderRadius:4,padding:'8px 12px',fontSize:12,lineHeight:1.5,width:220,boxShadow:'0 8px 10px rgba(0,0,0,.14),0 3px 14px rgba(0,0,0,.12)',marginTop:4}}>
                {tooltip}
              </div>
            )}
          </>
        )}
      </div>
      <div className={`sbc-v${cls?' '+cls:''}`}>{value}</div>
    </div>
  )
}
