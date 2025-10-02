import React from 'react';
import { X, Share, Plus } from 'lucide-react';

interface IOSInstallModalProps {
  onClose: () => void;
  appName?: string;
  appUrl?: string;
}

export function IOSInstallModal({ onClose, appName = 'Marine Group', appUrl = 'mginvoices.com' }: IOSInstallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - iOS style */}
      <div className="relative w-full max-w-lg mx-4 mb-4 bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Install the app</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* App Info */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-[#0C4A6E] rounded-2xl flex items-center justify-center overflow-hidden">
              <img
                src="/icons/icon-192x192.png"
                alt={appName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">{appName}</h3>
              <p className="text-sm text-gray-400">{appUrl}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              1
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-gray-300">
                Press{' '}
                <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-700 rounded mx-1">
                  <span className="text-white text-lg leading-none">⋯</span>
                </span>{' '}
                to open the browser menu
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              2
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-gray-300">
                Tap the{' '}
                <span className="inline-flex items-center justify-center px-2 py-1 bg-gray-700 rounded mx-1">
                  <Share className="h-4 w-4 text-white" />
                  <span className="text-white text-xs ml-1">Share</span>
                </span>{' '}
                button
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              3
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm text-gray-300">
                Scroll down and pick{' '}
                <span className="inline-flex items-center justify-center px-2 py-1 bg-gray-700 rounded mx-1">
                  <Plus className="h-4 w-4 text-white" />
                  <span className="text-white text-xs ml-1">Add to Home Screen</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
