import { useRef, useState } from 'react'
import { updateStatus } from '../shared/api'

const STATUS_COLORS = {
  Open: 'bg-teal-100 text-teal-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  Closed: 'bg-gray-100 text-gray-600',
}

const STATUSES = ['Open', 'In Progress', 'Closed']

export default function StatusBadge({ requestId, currentStatus, onUpdated, onError }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef(null)

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setIsOpen(!isOpen)
  }

  const handleChange = async (newStatus) => {
    if (newStatus === currentStatus) { setIsOpen(false); return }
    setIsLoading(true)
    try {
      const updated = await updateStatus(requestId, newStatus)
      onUpdated(updated, 'Status updated successfully')
    } catch (e) {
      onError?.('Status update failed. Please try again.')
    } finally {
      setIsLoading(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[currentStatus]}`}
      >
        {currentStatus} ▾
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded shadow-lg overflow-hidden min-w-28"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleChange(s)}
                className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${
                  s === currentStatus ? 'font-semibold text-gray-900' : 'text-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
