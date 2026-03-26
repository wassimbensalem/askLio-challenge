// frontend/src/components/AgentPanel.jsx
import { useState } from 'react'
import { runAgent, updateStatus } from '../shared/api'

const RECOMMENDATION_CONFIG = {
  approve: {
    label: 'Recommend Approval',
    icon: '✓',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    confirmStatus: 'Closed',
    confirmLabel: 'Confirm Approval',
    confirmStyle: 'bg-green-600 hover:bg-green-700 text-white',
  },
  review: {
    label: 'Recommend Review',
    icon: '⚠',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    confirmStatus: 'In Progress',
    confirmLabel: 'Send for Review',
    confirmStyle: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  reject: {
    label: 'Recommend Rejection',
    icon: '✕',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    confirmStatus: 'Closed',
    confirmLabel: 'Confirm Rejection',
    confirmStyle: 'bg-red-600 hover:bg-red-700 text-white',
  },
}

export default function AgentPanel({ requestId, onUpdated, showToast }) {
  const [state, setState] = useState('idle') // idle | running | done | confirmed
  const [steps, setSteps] = useState([])
  const [result, setResult] = useState(null) // { recommendation, note }
  const [isConfirming, setIsConfirming] = useState(false)

  const handleRun = () => {
    setState('running')
    setSteps([])
    setResult(null)

    runAgent(
      requestId,
      (stepText) => setSteps((prev) => [...prev, stepText]),
      (doneEvent) => {
        setResult({ recommendation: doneEvent.recommendation, note: doneEvent.note })
        setState('done')
      },
      (errText) => {
        showToast?.(errText, 'error')
        setState('idle')
      },
    )
  }

  const handleConfirm = async () => {
    const cfg = RECOMMENDATION_CONFIG[result.recommendation]
    if (!cfg) return
    setIsConfirming(true)
    try {
      await updateStatus(requestId, cfg.confirmStatus)
      setState('confirmed')
      onUpdated?.()
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleOverride = () => {
    setState('idle')
    setResult(null)
    setSteps([])
  }

  if (state === 'idle') {
    return (
      <div className="mt-6 pt-5 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">AI Agent</p>
        </div>
        <button
          onClick={handleRun}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span>Run Agent</span>
          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-semibold tracking-wide">BETA</span>
        </button>
      </div>
    )
  }

  if (state === 'running') {
    return (
      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">AI Agent</p>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-indigo-700">Agent running...</span>
        </div>
        <ul className="space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-2">
              <span className="text-gray-400 shrink-0">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (state === 'done' && result) {
    const cfg = RECOMMENDATION_CONFIG[result.recommendation] || RECOMMENDATION_CONFIG.review
    return (
      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">AI Agent</p>
        {steps.length > 0 && (
          <ul className="space-y-1 mb-4">
            {steps.map((step, i) => (
              <li key={i} className="text-xs text-gray-600 flex gap-2">
                <span className="text-gray-400 shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        )}
        <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
          <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${cfg.text}`}>
            <span>{cfg.icon}</span>
            <span>{cfg.label}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.note}</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${cfg.confirmStyle}`}
            >
              {isConfirming ? 'Applying...' : cfg.confirmLabel}
            </button>
            <button
              onClick={handleOverride}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Override
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'confirmed') {
    return (
      <div className="mt-6 pt-5 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">AI Agent</p>
        <p className="text-sm text-gray-500 italic">Agent recommendation applied.</p>
        <button
          onClick={handleRun}
          className="mt-2 text-xs text-indigo-600 hover:underline"
        >
          Re-run agent
        </button>
      </div>
    )
  }

  return null
}
