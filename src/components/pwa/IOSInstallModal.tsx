import React from 'react';
import { X } from 'lucide-react';

interface IOSInstallModalProps {
  onClose: () => void;
  appName?: string;
  appUrl?: string;
}

export function IOSInstallModal({ onClose, appName = 'Marine Group', appUrl = 'portal.mginvoices.com' }: IOSInstallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal - Exact copy of the example */}
      <div className="relative w-full max-w-2xl bg-[#2c2c2e] rounded-[28px] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-[17px] font-normal text-[#ebebf5]/60">Install the app</h2>
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <X className="h-7 w-7 text-[#8e8e93]" strokeWidth={2} />
          </button>
        </div>

        {/* App Info */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-4 bg-[#3a3a3c] rounded-[20px] p-4">
            <div className="w-[60px] h-[60px] rounded-[13px] overflow-hidden flex-shrink-0">
              <img
                src="/icon-192.png"
                alt={appName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-semibold text-white truncate">{appName}</h3>
              <p className="text-[13px] text-[#8e8e93] mt-0.5 truncate">{appUrl}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-6 pb-8 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-white/90 font-normal text-[15px] flex-shrink-0 w-6">1.</span>
            <p className="text-[15px] text-white/90 leading-snug pt-[1px]">
              Press{' '}
              <span className="inline-flex items-center justify-center w-7 h-6 bg-[#48484a] rounded-md align-middle mx-0.5">
                <span className="text-white text-[15px] font-semibold">⋯</span>
              </span>{' '}
              to open the browser menu
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-white/90 font-normal text-[15px] flex-shrink-0 w-6">2.</span>
            <p className="text-[15px] text-white/90 leading-snug pt-[1px]">
              Tap the{' '}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#48484a] rounded-md align-middle mx-0.5">
                <svg className="w-[13px] h-[13px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="text-white text-[13px] font-normal">Share</span>
              </span>{' '}
              button
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-white/90 font-normal text-[15px] flex-shrink-0 w-6">3.</span>
            <p className="text-[15px] text-white/90 leading-snug pt-[1px]">
              Scroll down and pick{' '}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#48484a] rounded-md align-middle mx-0.5">
                <svg className="w-[13px] h-[13px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-white text-[13px] font-normal">Add to Home Screen</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
