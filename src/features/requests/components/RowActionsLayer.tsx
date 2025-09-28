import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRequestsRowActionsStore } from '../state/rowActions.store';

export default function RequestsRowActionsLayer() {
  const { open, pos, rowId, handlers, close } = useRequestsRowActionsStore();
  const [armed, setArmed] = useState(false);
  const boxRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{ if (open) { setArmed(false); requestAnimationFrame(()=>setArmed(true)); }}, [open]);

  useEffect(()=>{
    if (!open) return;
    const onPD = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (!armed) return; // ignore the opening click
      if (t.closest('[data-row-actions]') || t.closest('[data-row-actions-trigger]')) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPD, true);
    document.addEventListener('keydown', onKey, true);
    return ()=>{ document.removeEventListener('pointerdown', onPD, true); document.removeEventListener('keydown', onKey, true); };
  }, [open, armed, close]);

  if (!open || !pos || !handlers || rowId == null) return null;

  const style: React.CSSProperties = {
    position:'absolute', top: pos.top, left: pos.left, zIndex: 1000,
    display: 'flex', flexDirection: 'column', background:'white', border:'1px solid rgba(0,0,0,0.08)',
    borderRadius: 8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding: 6
  };

  return createPortal(
    <div ref={boxRef} role="menu" aria-label={`Row ${rowId} actions`} data-row-actions style={style}
         onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
      <button role="menuitem" className="block text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
              onClick={()=>{ handlers.view(rowId); close(); }}>View</button>
      <button role="menuitem" className="block text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
              onClick={()=>{ handlers.edit(rowId); close(); }}>Edit</button>
      <button role="menuitem" className="block text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
              onClick={()=>{ handlers.print(rowId); close(); }}>Print</button>
      <button role="menuitem" className="block text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap text-red-600"
              onClick={()=>{ handlers.del(rowId); close(); }}>Delete</button>
    </div>,
    document.body
  );
}