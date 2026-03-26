import { useState } from 'react'
import IntakeForm from './components/IntakeForm'
import RequestsTable from './components/RequestsTable'
import { Toast } from './shared/Toast'
import ErrorBoundary from './shared/ErrorBoundary'

function LioLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2C8.5 2 7.1 2.5 6 3.4C8.8 3.9 11 6.4 11 9.5C11 12.6 8.8 15.1 6 15.6C7.1 16.5 8.5 17 10 17C13.9 17 17 13.9 17 10C17 6.1 13.9 2 10 2Z" fill="white" opacity="0.95"/>
        <path d="M6 15.6C4.2 14.4 3 12.4 3 10C3 7.6 4.2 5.6 6 4.4C8.8 4.9 11 7.4 11 10.5C11 12.8 9.8 14.8 8 15.8C7.4 15.8 6.7 15.7 6 15.6Z" fill="white" opacity="0.45"/>
      </svg>
      <div>
        <span className="text-white font-semibold text-sm tracking-tight">Lio</span>
        <span className="text-white/30 text-sm font-normal ml-2">Procurement</span>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('form')
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmitSuccess = () => {
    showToast('Request submitted successfully!')
    setActiveTab('requests')
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-50">

      {/* Header — Lio dark style */}
      <div className="bg-[#0f1e24] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <LioLogo />
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  activeTab === 'form'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                New Request
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  activeTab === 'requests'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                All Requests
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'form' ? (
          <IntakeForm onSubmitSuccess={handleSubmitSuccess} />
        ) : (
          <RequestsTable showToast={showToast} />
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
    </ErrorBoundary>
  )
}
