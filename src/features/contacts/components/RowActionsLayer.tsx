import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileText, Edit, Trash2 } from 'lucide-react';
import { useContactsRowActionsStore } from '../state/rowActions.store';

export default function ContactsRowActionsLayer() {
  const { open, pos, rowId, handlers, close } = useContactsRowActionsStore();
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
    borderRadius: 8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding: 0
  };

  return createPortal(
    <div ref={boxRef} role="menu" aria-label={`Row ${rowId} actions`} data-row-actions style={style}
         onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
      <div className="w-[180px]">
        <div className="px-3 pt-2.5 pb-2">
          <span className="text-[13px] font-semibold text-gray-900">Actions</span>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="px-1.5 py-1.5 space-y-0.5">
          <button role="menuitem" className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                  onClick={()=>{ handlers.newInvoice(rowId); close(); }}>
            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
            New invoice
          </button>
          <button role="menuitem" className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                  onClick={()=>{ handlers.viewInvoices(rowId); close(); }}>
            <Eye className="h-4 w-4 text-gray-400 flex-shrink-0" />
            View invoices
          </button>
          <button role="menuitem" className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-gray-600 hover:bg-gray-50"
                  onClick={()=>{ handlers.edit(rowId); close(); }}>
            <Edit className="h-4 w-4 text-gray-400 flex-shrink-0" />
            Edit contact
          </button>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="px-1.5 py-1.5">
          <button role="menuitem" className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md transition-colors text-red-600 hover:bg-red-50"
                  onClick={()=>{ handlers.del(rowId); close(); }}>
            <Trash2 className="h-4 w-4 flex-shrink-0" />
            Delete contact
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}