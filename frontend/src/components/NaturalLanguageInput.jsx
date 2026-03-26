import { useState } from 'react'
import { extractFromText } from '../shared/api'
import LoadingSpinner from '../shared/LoadingSpinner'

const EXAMPLES = [
  'I need 5 MacBook Pros for the new engineering hires, budget around €12,000',
  '3 ergonomic office chairs for the marketing team, ~€400 each',
  'Adobe Creative Cloud licenses for 10 designers, annual subscription',
]

export default function NaturalLanguageInput({ onExtracted }) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setError(null)
    setIsLoading(true)
    try {
      const data = await extractFromText(text)
      onExtracted(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'Describe what you need to purchase…\ne.g. "I need 5 MacBook Pros for the new engineering hires, budget around €12,000"'}
          rows={4}
          disabled={isLoading}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-gray-300 disabled:opacity-50 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1e24] text-white text-xs font-medium rounded-md hover:bg-[#1a2f38] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <LoadingSpinner text="Parsing…" />
          ) : (
            <>
              Parse request
              <span className="text-white/40 text-[10px]">⌘↵</span>
            </>
          )}
        </button>
      </div>

      {/* Example prompts */}
      {!text && !isLoading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="text-xs text-gray-400 hover:text-teal-600 border border-gray-200 hover:border-teal-300 rounded-full px-3 py-1 transition-colors truncate max-w-xs"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded px-3 py-2">
          <span className="text-red-400 shrink-0">⚠</span>
          <div>
            <p className="text-xs font-medium text-red-700">Parsing failed</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
