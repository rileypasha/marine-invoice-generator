import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { useContactsRowActionsStore } from '../state/rowActions.store';

export default function ContactsRowActionsLayer() {
  const { open, pos, rowId, handlers, close } = useContactsRowActionsStore();
  const [armed, setArmed] = useState(false);
  const boxRef = useRef<HTMLDivElement|null>(null);
  const portalRoot = useRef<HTMLDivElement | null>(null);

  // Create and manage a stable portal root
  useEffect(() => {
    if (!portalRoot.current) {
      const div = document.createElement('div');
      div.id = 'contacts-row-actions-portal';
      document.body.appendChild(div);
      portalRoot.current = div;
    }

    return () => {
      if (portalRoot.current && document.body.contains(portalRoot.current)) {
        document.body.removeChild(portalRoot.current);
        portalRoot.current = null;
      }
    };
  }, []);

  useEffect(()=>{ if (open) { setArmed(false); requestAnimationFrame(()=>setArmed(true)); }}, [open]);

  useEffect(()=>{
    if (!open) return;
    const onPD = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (!armed) return;
      if (t.closest('[data-row-actions]') || t.closest('[data-row-actions-trigger]')) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPD, true);
    document.addEventListener('keydown', onKey, true);
    return ()=>{ document.removeEventListener('pointerdown', onPD, true); document.removeEventListener('keydown', onKey, true); };
  }, [open, armed, close]);

  if (!open || !handlers || rowId == null || !portalRoot.current) return null;

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(2px)',
    zIndex: 999,
  };

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
        aria-label={`Contact ${rowId} actions`}
        data-row-actions
        style={sheetStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        {handlers.edit && (
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
            onClick={() => { handlers.edit?.(rowId); close(); }}
          >
            <Edit className="h-5 w-5 text-gray-600" />
            <span>Edit</span>
          </button>
        )}
        {handlers.viewInvoices && (
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
            onClick={() => { handlers.viewInvoices?.(rowId); close(); }}
          >
            <FileText className="h-5 w-5 text-gray-600" />
            <span>View Invoices</span>
          </button>
        )}
        {handlers.newInvoice && (
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
            onClick={() => { handlers.newInvoice?.(rowId); close(); }}
          >
            <Plus className="h-5 w-5 text-gray-600" />
            <span>New Invoice</span>
          </button>
        )}
        {handlers.del && (
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base text-red-600 hover:bg-gray-50 transition-colors"
            onClick={() => { handlers.del?.(rowId); close(); }}
          >
            <Trash2 className="h-5 w-5" />
            <span>Delete</span>
          </button>
        )}
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
    portalRoot.current
  );
}
