import { COMMODITY_GROUPS } from '../shared/commodityGroups'

export default function CommodityBadge({ groupId, groupName, onChange, isAI }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        Commodity Group{' '}
        {isAI && (
          <span className="ml-1 text-xs font-normal text-teal-600 normal-case">
            ✦ AI classified
          </span>
        )}
      </label>
      {isAI && groupName && (
        <div className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 text-xs font-medium px-2.5 py-1 rounded-full mb-2 border border-teal-200">
          <span>✦</span> {groupName}
        </div>
      )}
      <select
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        value={groupId}
        onChange={(e) => {
          const selected = COMMODITY_GROUPS.find((g) => g.id === e.target.value)
          onChange(e.target.value, selected?.name || '')
        }}
      >
        <option value="">Select commodity group...</option>
        {COMMODITY_GROUPS.map((group) => (
          <option key={group.id} value={group.id}>
            {group.id} — {group.name}
          </option>
        ))}
      </select>
    </div>
  )
}
