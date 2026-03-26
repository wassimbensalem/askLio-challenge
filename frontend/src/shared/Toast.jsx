export function Toast({ message, type = 'success' }) {
  const styles = {
    success: 'bg-[#0f1e24] text-white border-white/10',
    error: 'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded border text-sm font-medium shadow-lg z-50 ${styles[type]}`}>
      {message}
    </div>
  )
}
