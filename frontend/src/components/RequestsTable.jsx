import { useCallback, useEffect, useState } from 'react'
import { deleteRequest, getRequests } from '../shared/api'
import RequestDrawer from './RequestDrawer'
import RequestRow from './RequestRow'

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Closed']

function exportToCSV(requests) {
  const headers = [
    'ID', 'Requestor', 'Title', 'Vendor', 'VAT ID', 'Department',
    'Commodity Group', 'Total Cost (€)', 'Status', 'Submitted',
  ]
  const rows = requests.map((r) => [
    r.id,
    r.requestor_name,
    r.title,
    r.vendor_name,
    r.vat_id,
    r.department,
    r.commodity_group_name,
    r.total_cost.toFixed(2),
    r.status,
    new Date(r.created_at).toLocaleDateString('en-GB'),
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `procurement-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const fmt = (n) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const SORT_FIELDS = {
  requestor: (r) => r.requestor_name.toLowerCase(),
  vendor:    (r) => r.vendor_name.toLowerCase(),
  category:  (r) => r.commodity_group_name.toLowerCase(),
  total:     (r) => r.total_cost,
  date:      (r) => r.created_at,
  status:    (r) => r.status,
}

export default function RequestsTable({ showToast }) {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [drawerRequest, setDrawerRequest] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setFetchError(null)
    setSelected(new Set())
    getRequests()
      .then((data) => { setRequests(data); setFetchError(null) })
      .catch(() => setFetchError('Could not reach the server. Is the backend running?'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpdated = (updatedRequest, message = 'Updated successfully') => {
    setRequests((prev) => prev.map((r) => (r.id === updatedRequest.id ? updatedRequest : r)))
    setDrawerRequest((prev) => prev?.id === updatedRequest.id ? updatedRequest : prev)
    if (message) showToast(message)
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'date' ? 'desc' : 'asc')
    }
  }

  const handleDelete = async (id) => {
    await deleteRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s })
    showToast('Request deleted')
  }

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    try {
      await Promise.all([...selected].map((id) => deleteRequest(id)))
      setRequests((prev) => prev.filter((r) => !selected.has(r.id)))
      showToast(`${selected.size} request${selected.size !== 1 ? 's' : ''} deleted`)
      setSelected(new Set())
    } catch {
      showToast('Some deletions failed. Please try again.', 'error')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const q = searchQuery.trim().toLowerCase()
  const statusFiltered = statusFilter === 'All' ? requests : requests.filter((r) => r.status === statusFilter)
  const searched = q
    ? statusFiltered.filter((r) =>
        r.requestor_name.toLowerCase().includes(q) ||
        r.vendor_name.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      )
    : statusFiltered

  const getter = SORT_FIELDS[sortField]
  const filtered = [...searched].sort((a, b) => {
    const av = getter(a), bv = getter(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const someFilteredSelected = filtered.some((r) => selected.has(r.id))

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((r) => s.delete(r.id)); return s })
    } else {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((r) => s.add(r.id)); return s })
    }
  }

  const toggleOne = (id) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const kpi = {
    open:       requests.filter((r) => r.status === 'Open').length,
    inProgress: requests.filter((r) => r.status === 'In Progress').length,
    closed:     requests.filter((r) => r.status === 'Closed').length,
    openValue:  requests.filter((r) => r.status === 'Open').reduce((s, r) => s + r.total_cost, 0),
    totalValue: requests.reduce((s, r) => s + r.total_cost, 0),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Loading requests...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-white rounded border border-red-200 shadow-sm p-8 text-center">
        <div className="text-3xl mb-3">⚠</div>
        <p className="text-sm font-medium text-red-700 mb-1">Failed to load requests</p>
        <p className="text-xs text-gray-500 mb-4">{fetchError}</p>
        <button onClick={load} className="px-4 py-2 bg-[#0f1e24] text-white text-sm font-medium rounded hover:bg-[#1a2f38] transition-colors">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* KPI summary */}
      {requests.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded border border-gray-100 shadow-sm pl-4 pr-5 py-4 border-l-2 border-l-teal-400">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Open</p>
            <p className="text-2xl font-semibold text-teal-600 mt-1">{kpi.open}</p>
            <p className="text-xs text-gray-400 mt-0.5">€{fmt(kpi.openValue)} pending</p>
          </div>
          <div className="bg-white rounded border border-gray-100 shadow-sm pl-4 pr-5 py-4 border-l-2 border-l-yellow-400">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">In Progress</p>
            <p className="text-2xl font-semibold text-yellow-500 mt-1">{kpi.inProgress}</p>
            <p className="text-xs text-gray-400 mt-0.5">being processed</p>
          </div>
          <div className="bg-white rounded border border-gray-100 shadow-sm pl-4 pr-5 py-4 border-l-2 border-l-green-400">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Closed</p>
            <p className="text-2xl font-semibold text-green-500 mt-1">{kpi.closed}</p>
            <p className="text-xs text-gray-400 mt-0.5">completed</p>
          </div>
          <div className="bg-white rounded border border-gray-100 shadow-sm pl-4 pr-5 py-4 border-l-2 border-l-gray-300">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Value</p>
            <p className="text-2xl font-semibold text-gray-800 mt-1">€{fmt(kpi.totalValue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => {
                const count = f === 'All' ? requests.length : requests.filter((r) => r.status === f).length
                return (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                      statusFilter === f
                        ? 'bg-teal-50 text-teal-700'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      statusFilter === f ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              {requests.length > 0 && (
                <button
                  onClick={() => exportToCSV(filtered)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  ↓ Export CSV
                </button>
              )}
              <button
                onClick={load}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1.5 rounded hover:bg-gray-50"
                title="Refresh"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by requestor, vendor, title, or department…"
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">
              {requests.length === 0
                ? 'No requests yet'
                : q
                ? `No results for "${searchQuery}"`
                : `No ${statusFilter.toLowerCase()} requests`}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {requests.length === 0
                ? 'Submit your first procurement request to get started'
                : q
                ? 'Try a different search term'
                : 'Try a different filter above'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                    />
                  </th>
                  {[
                    { label: 'Requestor', field: 'requestor' },
                    { label: 'Vendor',    field: 'vendor' },
                    { label: 'Category',  field: 'category' },
                    { label: 'Total',     field: 'total' },
                    { label: 'Date',      field: 'date' },
                    { label: 'Status',    field: 'status' },
                  ].map(({ label, field }) => (
                    <th key={field} className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort(field)}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide hover:text-gray-900 transition-colors"
                      >
                        {label}
                        <span className={`text-[10px] ${sortField === field ? 'text-teal-600' : 'text-gray-300'}`}>
                          {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    onUpdated={handleUpdated}
                    onOpen={() => setDrawerRequest(request)}
                    showToast={showToast}
                    isSelected={selected.has(request.id)}
                    onSelect={toggleOne}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0f1e24] text-white px-5 py-3 rounded shadow-xl z-60">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {isBulkDeleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {drawerRequest && (
        <RequestDrawer
          request={drawerRequest}
          onClose={() => setDrawerRequest(null)}
          onUpdated={handleUpdated}
          showToast={showToast}
        />
      )}

    </div>
  )
}
