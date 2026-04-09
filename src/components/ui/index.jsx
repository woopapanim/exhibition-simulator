import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ICON_PATHS } from '../../constants'

// overflow 컨테이너를 탈출하는 포탈 기반 툴팁
export function PortalTip({ label, children }) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState(null)
  const iconRef = useRef(null)

  function show() {
    if (iconRef.current) {
      setRect(iconRef.current.getBoundingClientRect())
    }
    setVisible(true)
  }
  function hide() { setVisible(false) }

  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
      {label}
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
          width:13,height:13,borderRadius:'50%',background:'rgba(0,0,0,0.08)',
          fontSize:9,fontWeight:700,color:'#6b7b74',cursor:'default',flexShrink:0}}
      >i</span>
      {visible && rect && createPortal(
        <div style={{
          position:'fixed',
          left: Math.round(rect.left + rect.width/2),
          top: Math.round(rect.top - 8),
          transform:'translate(-50%,-100%)',
          background:'#1a2a24', color:'#e8f0ec',
          fontSize:'10.5px', fontWeight:400, lineHeight:1.55,
          padding:'8px 11px', borderRadius:'7px',
          whiteSpace:'normal', width:'210px',
          pointerEvents:'none', zIndex:99999,
          boxShadow:'0 3px 14px rgba(0,0,0,0.22)',
        }}>{children}</div>,
        document.body
      )}
    </span>
  )
}

export function SliderInput({ min=0, max=100, step=1, value, onChange, style={}, ...props }) {
  const pct = Math.round(((+value - +min) / (+max - +min)) * 100)
  const bg = `linear-gradient(to right, #00c896 0%, #00c896 ${pct}%, #d8e4de ${pct}%, #d8e4de 100%)`
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={onChange}
      style={{background: bg, ...style}}
      {...props}
    />
  )
}

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
              style={{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:1,color:'#888',fontSize:11,fontWeight:700}}>
              ⓘ
            </button>
            {open && (
              <div
                style={{position:'absolute',top:'100%',left:0,zIndex:200,background:'#111',color:'#fff',borderRadius:8,padding:'10px 12px',fontSize:11,lineHeight:1.6,width:220,boxShadow:'0 4px 16px rgba(0,0,0,0.2)',marginTop:4}}>
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
