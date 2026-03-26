import { useEffect, useRef, useState } from 'react'
import { addComment, updateRequest } from '../shared/api'
import { COMMODITY_GROUPS } from '../shared/commodityGroups'
import StatusBadge from './StatusBadge'
import AgentPanel from './AgentPanel'

const INTAKE_LABELS = {
  pdf:    { label: 'PDF Upload',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  nl:     { label: 'AI Describe', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  manual: { label: 'Manual',      color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function IntakeBadge({ method }) {
  if (!method) return null
  const cfg = INTAKE_LABELS[method] || INTAKE_LABELS.manual
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function TimelineEntry({ entry }) {
  const time = new Date(entry.timestamp).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  if (entry.type === 'status') {
    return (
      <div className="flex gap-3 items-start">
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{time}</p>
          <p className="text-xs text-gray-700 mt-0.5">
            Status changed: <span className="font-medium">{entry.payload.old_status}</span>
            <span className="text-gray-400 mx-1">→</span>
            <span className="font-medium">{entry.payload.new_status}</span>
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5 text-teal-600 text-[10px] font-bold">
        {entry.payload.author.slice(0, 1).toUpperCase()}
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">{entry.payload.author}</span>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{entry.payload.text}</p>
      </div>
    </div>
  )
}

export default function RequestDrawer({ request, onClose, onUpdated, showToast }) {
  const [fields, setFields] = useState({
    title: request.title,
    vendor_name: request.vendor_name,
    vat_id: request.vat_id,
    commodity_group_id: request.commodity_group_id,
    commodity_group_name: request.commodity_group_name,
  })
  const [lines, setLines] = useState(request.order_lines.map(l => ({ ...l })))
  const [isSaving, setIsSaving] = useState(false)
  const [commentAuthor, setCommentAuthor] = useState('')
  const [commentText, setCommentText] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const timelineBottomRef = useRef(null)

  const isDirty =
    fields.title !== request.title ||
    fields.vendor_name !== request.vendor_name ||
    fields.vat_id !== request.vat_id ||
    fields.commodity_group_id !== request.commodity_group_id ||
    JSON.stringify(lines.map(l => ({ description: l.description, unit_price: l.unit_price, quantity: l.quantity, unit: l.unit, total_price: l.total_price })))
    !== JSON.stringify(request.order_lines.map(l => ({ description: l.description, unit_price: l.unit_price, quantity: l.quantity, unit: l.unit, total_price: l.total_price })))

  const vatError = fields.vat_id && !/^DE\d{9}$/.test(fields.vat_id)
    ? 'Must be DE + 9 digits' : null

  // Esc to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Sync state when request prop changes (e.g. after status update)
  useEffect(() => {
    setFields({
      title: request.title,
      vendor_name: request.vendor_name,
      vat_id: request.vat_id,
      commodity_group_id: request.commodity_group_id,
      commodity_group_name: request.commodity_group_name,
    })
    setLines(request.order_lines.map(l => ({ ...l })))
  }, [request.id])

  const updateLine = (i, field, value) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, [field]: value }
      if (field === 'unit_price' || field === 'quantity') {
        updated.total_price = parseFloat(field === 'unit_price' ? value : updated.unit_price) *
          parseFloat(field === 'quantity' ? value : updated.quantity) || 0
      }
      return updated
    }))
  }

  const handleSave = async () => {
    if (vatError) return
    setIsSaving(true)
    try {
      const updated = await updateRequest(request.id, { ...fields, order_lines: lines })
      onUpdated(updated, 'Changes saved')
    } catch (e) {
      showToast?.(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentAuthor.trim() || !commentText.trim()) return
    setIsPosting(true)
    try {
      const comment = await addComment(request.id, commentAuthor.trim(), commentText.trim())
      // Optimistically append comment to request
      onUpdated({ ...request, comments: [...(request.comments || []), comment] }, null)
      setCommentText('')
      setTimeout(() => timelineBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      showToast?.(e.message, 'error')
    } finally {
      setIsPosting(false)
    }
  }

  // Build combined timeline
  const timeline = [
    ...(request.status_history || []).map(h => ({ type: 'status', timestamp: h.changed_at, payload: h })),
    ...(request.comments || []).map(c => ({ type: 'comment', timestamp: c.created_at, payload: c })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const total = lines.reduce((s, l) => s + (l.total_price || 0), 0)

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-900 truncate">{request.title}</h2>
                <IntakeBadge method={request.intake_method} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {request.requestor_name} · {request.department} · {new Date(request.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <StatusBadge
              requestId={request.id}
              currentStatus={request.status}
              onUpdated={onUpdated}
              onError={(msg) => showToast?.(msg, 'error')}
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — editable fields */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 border-r border-gray-100">

            {/* Read-only */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Requestor</label>
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-2">{request.requestor_name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Department</label>
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-2">{request.department}</p>
              </div>
            </div>

            {/* Editable */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Title</label>
              <input
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={fields.title}
                onChange={e => setFields(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Vendor</label>
                <input
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={fields.vendor_name}
                  onChange={e => setFields(f => ({ ...f, vendor_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">VAT ID</label>
                <input
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${vatError ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-teal-400'}`}
                  value={fields.vat_id}
                  onChange={e => setFields(f => ({ ...f, vat_id: e.target.value }))}
                />
                {vatError && <p className="text-xs text-red-500 mt-1">{vatError}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Commodity Group</label>
              <select
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={fields.commodity_group_id}
                onChange={e => {
                  const g = COMMODITY_GROUPS.find(g => g.id === e.target.value)
                  setFields(f => ({ ...f, commodity_group_id: e.target.value, commodity_group_name: g?.name || '' }))
                }}
              >
                {COMMODITY_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>{g.id} — {g.name}</option>
                ))}
              </select>
            </div>

            {/* Order lines */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Order Lines</label>
              <table className="w-full text-xs border border-gray-100 rounded overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="text-gray-400">
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2 w-16">Qty</th>
                    <th className="text-right px-3 py-2 w-24">Unit Price</th>
                    <th className="text-right px-3 py-2 w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                          value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400"
                          value={line.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-400"
                          value={line.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-gray-700">€{line.total_price.toFixed(2)}</td>
                      <td className="px-2 py-1.5">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-2">
                <button type="button"
                  onClick={() => setLines(prev => [...prev, { description: '', unit_price: 0, quantity: 1, unit: 'units', total_price: 0 }])}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  + Add line
                </button>
                <span className="text-xs font-semibold text-gray-700">Total: €{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || !!vatError}
              className="w-full bg-[#0f1e24] text-white py-2.5 rounded text-sm font-medium hover:bg-[#1a2f38] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>

            <AgentPanel
              requestId={request.id}
              onUpdated={onUpdated}
              showToast={showToast}
            />
          </div>

          {/* Right — timeline + comments */}
          <div className="w-80 shrink-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity</p>

              {timeline.length === 0 ? (
                <p className="text-xs text-gray-400">No activity yet</p>
              ) : (
                timeline.map((entry, i) => <TimelineEntry key={i} entry={entry} />)
              )}
              <div ref={timelineBottomRef} />
            </div>

            {/* Comment input */}
            <div className="border-t border-gray-100 px-4 py-4 space-y-2 shrink-0">
              <input
                className="w-full border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Your name"
                value={commentAuthor}
                onChange={e => setCommentAuthor(e.target.value)}
              />
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-gray-300"
                placeholder="Add a comment…"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handlePostComment() }}
              />
              <button
                type="button"
                onClick={handlePostComment}
                disabled={!commentAuthor.trim() || !commentText.trim() || isPosting}
                className="w-full bg-[#0f1e24] text-white py-2 rounded text-xs font-medium hover:bg-[#1a2f38] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPosting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
