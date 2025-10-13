import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { useRequestsRowActionsStore } from '../state/rowActions.store';

export default function RequestsRowActionsLayer() {
  const { open, pos, rowId, handlers, close } = useRequestsRowActionsStore();
  const [armed, setArmed] = useState(false);
  const boxRef = useRef<HTMLDivElement|null>(null);
  const isProcessingActionRef = useRef(false);

  useEffect(()=>{
    if (open) {
      setArmed(false);
      isProcessingActionRef.current = false;
      requestAnimationFrame(()=>setArmed(true));
    }
  }, [open]);

  useEffect(()=>{
    if (!open) return;
    const onPD = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (!armed) return; // ignore the opening click
      if (isProcessingActionRef.current) return; // Don't close while processing an action
      if (t.closest('[data-row-actions]') || t.closest('[data-row-actions-trigger]')) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPD, true);
    document.addEventListener('keydown', onKey, true);
    return ()=>{ document.removeEventListener('pointerdown', onPD, true); document.removeEventListener('keydown', onKey, true); };
  }, [open, armed, close]);

  if (!open || !handlers || rowId == null) return null;

  // Backdrop blur style
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(2px)',
    zIndex: 999,
  };

  // Bottom sheet style
  const sheetStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
    padding: '8px 0 24px 0',
    animation: 'slideUp 0.2s ease-out',
  };

  return createPortal(
    <>
      <div
        style={backdropStyle}
        onClick={close}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div
        ref={boxRef}
        role="menu"
        aria-label={`Row ${rowId} actions`}
        data-row-actions
        style={sheetStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <button
          role="menuitem"
          className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
          onClick={() => {
            isProcessingActionRef.current = true;
            handlers.view(rowId);
            setTimeout(() => close(), 50);
          }}
        >
          <Eye className="h-5 w-5 text-gray-600" />
          <span>View</span>
        </button>
        <button
          role="menuitem"
          className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
          onClick={() => {
            isProcessingActionRef.current = true;
            handlers.edit(rowId);
            setTimeout(() => close(), 50);
          }}
        >
          <Edit className="h-5 w-5 text-gray-600" />
          <span>Edit</span>
        </button>
        <button
          role="menuitem"
          className="flex items-center gap-3 w-full text-left px-6 py-3 text-base text-red-600 hover:bg-gray-50 transition-colors"
          onClick={() => {
            isProcessingActionRef.current = true;
            handlers.del(rowId);
            setTimeout(() => close(), 50);
          }}
        >
          <Trash2 className="h-5 w-5" />
          <span>Delete</span>
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>,
    document.body
  );
}