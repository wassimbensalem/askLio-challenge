export default function OrderLinesTable({ lines, onChange, extracted }) {
  const isExtracted = extracted && extracted.order_lines?.length > 0

  const addLine = () => {
    onChange([...lines, { description: '', unit_price: 0, quantity: 1, unit: 'units', total_price: 0 }])
  }

  const removeLine = (index) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const updateLine = (index, field, value) => {
    const updated = lines.map((line, i) => {
      if (i !== index) return line
      const newLine = { ...line, [field]: value }
      if (field === 'unit_price' || field === 'quantity') {
        newLine.total_price =
          parseFloat(field === 'unit_price' ? value : newLine.unit_price) *
          parseFloat(field === 'quantity' ? value : newLine.quantity) || 0
      }
      return newLine
    })
    onChange(updated)
  }

  const grandTotal = lines.reduce((sum, l) => sum + (l.total_price || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Order Lines <span className="text-red-400">*</span>
        </label>
        <button
          type="button"
          onClick={addLine}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium"
        >
          + Add line
        </button>
      </div>

      <div
        className={`rounded border overflow-hidden ${
          isExtracted ? 'border-teal-200' : 'border-gray-200'
        }`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Description</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-28">Unit Price €</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-16">Qty</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">Unit</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-24">Total €</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className={isExtracted ? 'bg-teal-50' : ''}>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-2">
                  <input
                    className="w-full bg-transparent focus:outline-none text-sm"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-transparent focus:outline-none text-sm"
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-transparent focus:outline-none text-sm"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full bg-transparent focus:outline-none text-sm"
                    value={line.unit}
                    onChange={(e) => updateLine(i, 'unit', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-gray-600 text-sm">
                  {line.total_price.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-gray-300 hover:text-red-400 text-xs leading-none"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-right text-sm font-semibold text-gray-800 mt-2">
        Total: €{grandTotal.toFixed(2)}
      </div>
    </div>
  )
}
