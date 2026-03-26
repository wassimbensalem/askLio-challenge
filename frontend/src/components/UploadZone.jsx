import { useRef, useState } from 'react'
import { extractFromPDF } from '../shared/api'
import LoadingSpinner from '../shared/LoadingSpinner'

export default function UploadZone({ onExtracted }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const data = await extractFromPDF(file)
      if (inputRef.current) inputRef.current.value = ''
      onExtracted(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-teal-400 bg-teal-50'
          : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        handleFile(e.dataTransfer.files[0])
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {isLoading ? (
        <div className="flex justify-center">
          <LoadingSpinner text="Extracting data from your document..." />
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-teal-100' : 'bg-gray-100'}`}>
              <svg className={`w-5 h-5 transition-colors ${isDragging ? 'text-teal-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-700">Drop vendor PDF here, or <span className="text-teal-600">browse</span></p>
          <p className="text-xs text-gray-400 mt-1">
            AI will extract vendor, VAT ID, and line items automatically
          </p>
        </>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-left" onClick={(e) => e.stopPropagation()}>
          <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-xs font-medium text-red-700">Extraction failed</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
