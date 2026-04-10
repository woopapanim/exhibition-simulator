import { useRef } from 'react'
import { clone } from '../utils'
import { layoutAll } from '../utils'

export function useUndoRedo({
  zonesRef, floorCountRef, floorSizesRef, selRef,
  undoStackRef, redoStackRef,
  setZones, setFloorCount, setFloorSizes, setSelZoneId,
  setCanUndo, setCanRedo,
  drawBuild,
}) {
  function snapshotUndo() {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-49),
      {
        zones: clone(zonesRef.current),
        floorCount: floorCountRef.current,
        floorSizes: floorSizesRef.current.map(s=>({...s})),
      }
    ]
    redoStackRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }
  function performUndo() {
    if (undoStackRef.current.length === 0) return
    const snap = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current.slice(-49), {
      zones: clone(zonesRef.current),
      floorCount: floorCountRef.current,
      floorSizes: floorSizesRef.current.map(s=>({...s})),
    }]
    zonesRef.current = clone(snap.zones)
    setZones(clone(snap.zones))
    setFloorCount(snap.floorCount)
    setFloorSizes([...snap.floorSizes])
    selRef.current = null; setSelZoneId(null)
    layoutAll(zonesRef.current)
    drawBuild()
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
  }
  function performRedo() {
    if (redoStackRef.current.length === 0) return
    const snap = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current.slice(-49), {
      zones: clone(zonesRef.current),
      floorCount: floorCountRef.current,
      floorSizes: floorSizesRef.current.map(s=>({...s})),
    }]
    zonesRef.current = clone(snap.zones)
    setZones(clone(snap.zones))
    setFloorCount(snap.floorCount)
    setFloorSizes([...snap.floorSizes])
    selRef.current = null; setSelZoneId(null)
    layoutAll(zonesRef.current)
    drawBuild()
    setCanRedo(redoStackRef.current.length > 0)
    setCanUndo(true)
  }

  const performUndoRef  = useRef(null); performUndoRef.current  = performUndo
  const performRedoRef  = useRef(null); performRedoRef.current  = performRedo
  const snapshotUndoRef = useRef(null); snapshotUndoRef.current = snapshotUndo

  return { snapshotUndo, performUndo, performRedo, performUndoRef, performRedoRef, snapshotUndoRef }
}
