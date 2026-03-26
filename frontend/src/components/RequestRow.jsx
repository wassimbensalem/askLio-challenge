import { useEffect, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'

export default function RequestRow({ request, onUpdated, onOpen, showToast, isSelected, onSelect, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    if (confirming) {
      clearTimeout(confirmTimer.current)
      setConfirming(false)
      setIsDeleting(true)
      onDelete(request.id).finally(() => setIsDeleting(false))
    } else {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000)
    }
  }

  const rowBg = isSelected ? 'bg-teal-50/60' : confirming ? 'bg-red-50' : 'hover:bg-gray-50/70'

  return (
    <tr className={`cursor-pointer transition-colors ${rowBg}`} onClick={onOpen}>

      <td className="pl-4 pr-2 py-3 w-8" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(request.id)}
          className="w-4 h-4 rounded border-gray-300 text-teal-600 cursor-pointer"
        />
      </td>

      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{request.requestor_name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{request.vendor_name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{request.commodity_group_name}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">€{request.total_cost.toFixed(2)}</td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(request.created_at).toLocaleDateString('en-GB')}
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <StatusBadge
          requestId={request.id}
          currentStatus={request.status}
          onUpdated={onUpdated}
          onError={msg => showToast?.(msg, 'error')}
        />
      </td>

      <td className="pr-3 py-3 text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirming ? 'bg-red-100 text-red-600 font-medium' : 'text-gray-300 hover:text-red-400'
            }`}
            title={confirming ? 'Click again to confirm' : 'Delete request'}
          >
            {isDeleting ? '…' : confirming ? 'Confirm?' : '✕'}
          </button>
          <span className="text-gray-300 text-xs">↗</span>
        </div>
      </td>
    </tr>
  )
}
