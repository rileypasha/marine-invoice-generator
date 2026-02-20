import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Edit, FileSpreadsheet, FileText, PlusCircle, Trash2 } from 'lucide-react';
import { useRequestsRowActionsStore } from '../state/rowActions.store';

const prefetchEditRoute = () => import('../../../pages/CreateInvoice');

export default function RequestsRowActionsLayer() {
  const { open, pos, rowId, handlers, close } = useRequestsRowActionsStore();
  const [armed, setArmed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const boxRef = useRef<HTMLDivElement|null>(null);
  const isProcessingActionRef = useRef(false);

  const handleAction = (action: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    isProcessingActionRef.current = true;
    action();
    close();
  };

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(()=>{
    if (open) {
      setArmed(false);
      isProcessingActionRef.current = false;
      requestAnimationFrame(() => setArmed(true));
      prefetchEditRoute().catch(() => {});
    }
  }, [open]);

  useEffect(()=>{
    if (!open) return;
    const onPD = (ev: PointerEvent) => {
      const t = ev.target instanceof Element ? ev.target : null;
      if (!t) return;
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

  // Desktop dropdown style (similar to vessels)
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: pos?.top || 0,
    left: pos?.left || 0,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    background: 'white',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    padding: 6
  };

  // Mobile bottom sheet styles
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

  // Mobile bottom sheet
  if (isMobile) {
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
            onClick={handleAction(() => handlers.view(rowId))}
            type="button"
          >
            <Eye className="h-5 w-5 text-gray-600" />
            <span>View</span>
          </button>
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
            onClick={handleAction(() => handlers.edit(rowId))}
            type="button"
          >
            <Edit className="h-5 w-5 text-gray-600" />
            <span>Edit</span>
          </button>
          {handlers.createInvoice && (
            <button
              role="menuitem"
              className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
              onClick={handleAction(() => handlers.createInvoice!(rowId))}
              type="button"
            >
              <PlusCircle className="h-5 w-5 text-gray-600" />
              <span>Create Invoice</span>
            </button>
          )}
          {handlers.exportPdf && (
            <button
              role="menuitem"
              className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
              onClick={handleAction(() => handlers.exportPdf!(rowId))}
              type="button"
            >
              <FileText className="h-5 w-5 text-gray-600" />
              <span>Export PDF</span>
            </button>
          )}
          {handlers.exportCsv && (
            <button
              role="menuitem"
              className="flex items-center gap-3 w-full text-left px-6 py-3 text-base hover:bg-gray-50 transition-colors"
              onClick={handleAction(() => handlers.exportCsv!(rowId))}
              type="button"
            >
              <FileSpreadsheet className="h-5 w-5 text-gray-600" />
              <span>Export CSV</span>
            </button>
          )}
          <button
            role="menuitem"
            className="flex items-center gap-3 w-full text-left px-6 py-3 text-base text-red-600 hover:bg-gray-50 transition-colors"
            onClick={handleAction(() => handlers.del(rowId))}
            type="button"
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

  // Desktop dropdown menu
  return createPortal(
    <div
      ref={boxRef}
      role="menu"
      aria-label={`Row ${rowId} actions`}
      data-row-actions
      style={dropdownStyle}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        role="menuitem"
        className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
        onClick={handleAction(() => handlers.view(rowId))}
        type="button"
      >
        <Eye className="h-4 w-4 text-gray-600" />
        <span>View</span>
      </button>
      <button
        role="menuitem"
        className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
        onClick={handleAction(() => handlers.edit(rowId))}
        type="button"
      >
        <Edit className="h-4 w-4 text-gray-600" />
        <span>Edit</span>
      </button>
      {handlers.createInvoice && (
        <button
          role="menuitem"
          className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
          onClick={handleAction(() => handlers.createInvoice!(rowId))}
          type="button"
        >
          <PlusCircle className="h-4 w-4 text-gray-600" />
          <span>Create Invoice</span>
        </button>
      )}
      {handlers.exportPdf && (
        <button
          role="menuitem"
          className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
          onClick={handleAction(() => handlers.exportPdf!(rowId))}
          type="button"
        >
          <FileText className="h-4 w-4 text-gray-600" />
          <span>Export PDF</span>
        </button>
      )}
      {handlers.exportCsv && (
        <button
          role="menuitem"
          className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
          onClick={handleAction(() => handlers.exportCsv!(rowId))}
          type="button"
        >
          <FileSpreadsheet className="h-4 w-4 text-gray-600" />
          <span>Export CSV</span>
        </button>
      )}
      <button
        role="menuitem"
        className="flex items-center gap-2 text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap text-red-600"
        onClick={handleAction(() => handlers.del(rowId))}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
        <span>Delete</span>
      </button>
    </div>,
    document.body
  );
}
