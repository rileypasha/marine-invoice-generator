/**
 * Conflict Resolution UI
 *
 * Shows conflicts between local and server data and allows user to resolve them.
 */

import { useState, useEffect } from 'react'
import { AlertCircle, X, Check, ArrowRight } from 'lucide-react'
import { getConflicts, resolveConflict } from '../db/queue'

interface Conflict {
  id: string
  queuedRequest: {
    url: string
    method: string
    body?: any
  }
  serverResponse: any
  timestamp: number
  resolved: boolean
}

export function ConflictResolutionModal() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Load conflicts
  useEffect(() => {
    loadConflicts()

    // Poll for new conflicts
    const interval = setInterval(loadConflicts, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadConflicts = async () => {
    const unresolvedConflicts = await getConflicts()
    setConflicts(unresolvedConflicts)

    if (unresolvedConflicts.length > 0 && !isOpen) {
      setIsOpen(true)
    }
  }

  const handleResolve = async (
    conflictId: string,
    resolution: 'keep-local' | 'keep-server' | 'merge',
    mergedData?: any
  ) => {
    await resolveConflict(conflictId, resolution, mergedData)
    await loadConflicts()

    if (conflicts.length === 1) {
      setIsOpen(false)
    }
  }

  if (conflicts.length === 0 || !isOpen) return null

  const conflict = selectedConflict || conflicts[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6" />
            <div>
              <h2 className="text-xl font-semibold">Data Conflict Detected</h2>
              <p className="text-sm opacity-90">
                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} need resolution
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <p className="text-gray-600 mb-6">
            Your local changes conflict with changes on the server. Choose which version to keep:
          </p>

          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Local Version */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs">
                  LOCAL
                </span>
                Your Changes
              </h3>
              <pre className="text-sm bg-white p-3 rounded border border-blue-100 overflow-x-auto">
                {JSON.stringify(conflict.queuedRequest.body, null, 2)}
              </pre>
              <p className="text-xs text-gray-500 mt-2">
                Modified: {new Date(conflict.timestamp).toLocaleString()}
              </p>
            </div>

            {/* Server Version */}
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs">
                  SERVER
                </span>
                Server Changes
              </h3>
              <pre className="text-sm bg-white p-3 rounded border border-green-100 overflow-x-auto">
                {JSON.stringify(conflict.serverResponse, null, 2)}
              </pre>
              <p className="text-xs text-gray-500 mt-2">Last synced from server</p>
            </div>
          </div>

          {/* Differences */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-yellow-900 mb-2">Conflicting Fields</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              {getConflictingFields(conflict.queuedRequest.body, conflict.serverResponse).map(
                (field, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-medium">{field}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleResolve(conflict.id, 'keep-local')}
              className="
                flex-1 px-4 py-2.5 rounded-lg font-medium
                bg-blue-500 hover:bg-blue-600 text-white
                transition-colors duration-200
                flex items-center justify-center gap-2
              "
            >
              <Check className="h-5 w-5" />
              Keep My Changes
            </button>

            <button
              onClick={() => handleResolve(conflict.id, 'keep-server')}
              className="
                flex-1 px-4 py-2.5 rounded-lg font-medium
                bg-green-500 hover:bg-green-600 text-white
                transition-colors duration-200
                flex items-center justify-center gap-2
              "
            >
              <Check className="h-5 w-5" />
              Use Server Version
            </button>

            <button
              onClick={() => {
                // Open merge UI (simplified here)
                const merged = { ...conflict.serverResponse, ...conflict.queuedRequest.body }
                handleResolve(conflict.id, 'merge', merged)
              }}
              className="
                flex-1 px-4 py-2.5 rounded-lg font-medium
                bg-purple-500 hover:bg-purple-600 text-white
                transition-colors duration-200
                flex items-center justify-center gap-2
              "
            >
              <ArrowRight className="h-5 w-5" />
              Merge Both
            </button>
          </div>

          {conflicts.length > 1 && (
            <p className="text-sm text-gray-600 mt-3 text-center">
              {conflicts.length - 1} more conflict{conflicts.length - 1 > 1 ? 's' : ''} after this
              one
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Get fields that differ between local and server
 */
function getConflictingFields(local: any, server: any): string[] {
  const fields = new Set<string>()

  // Compare all keys from both objects
  const allKeys = new Set([...Object.keys(local || {}), ...Object.keys(server || {})])

  for (const key of allKeys) {
    if (JSON.stringify(local?.[key]) !== JSON.stringify(server?.[key])) {
      fields.add(key)
    }
  }

  return Array.from(fields)
}

/**
 * Compact conflict indicator badge (for toolbar)
 */
export function ConflictBadge() {
  const [conflictCount, setConflictCount] = useState(0)

  useEffect(() => {
    const updateCount = async () => {
      const conflicts = await getConflicts()
      setConflictCount(conflicts.length)
    }

    updateCount()
    const interval = setInterval(updateCount, 10000)
    return () => clearInterval(interval)
  }, [])

  if (conflictCount === 0) return null

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
      <AlertCircle className="h-3 w-3" />
      <span>{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</span>
    </div>
  )
}
