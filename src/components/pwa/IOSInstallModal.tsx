import React from 'react';
import { X } from 'lucide-react';

interface IOSInstallModalProps {
  onClose: () => void;
  appName?: string;
  appUrl?: string;
}

export function IOSInstallModal({ onClose, appName = 'Marine Group', appUrl = 'portal.mginvoices.com' }: IOSInstallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - iOS style with black background */}
      <div className="relative w-full max-w-lg mx-4 mb-4 bg-[#2a2a2e] rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600/30">
          <h2 className="text-xl font-medium text-white/90">Install the app</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700/50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* App Info */}
        <div className="p-5 border-b border-gray-600/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden bg-white">
              <img
                src="/icon-192.png"
                alt={appName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-white">{appName}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{appUrl}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-white/90 font-medium text-lg">
              1.
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Press{' '}
                <span className="inline-flex items-center justify-center px-2 py-0.5 bg-gray-700/60 rounded mx-1 align-middle">
                  <span className="text-white text-base font-medium">⋯</span>
                </span>{' '}
                to open the browser menu
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-white/90 font-medium text-lg">
              2.
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Tap the{' '}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/60 rounded mx-1 align-middle">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-white text-sm font-medium">Share</span>
                </span>{' '}
                button
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-white/90 font-medium text-lg">
              3.
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-[15px] text-gray-300 leading-relaxed">
                Scroll down and pick{' '}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/60 rounded mx-1 align-middle">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-white text-sm font-medium">Add to Home Screen</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
