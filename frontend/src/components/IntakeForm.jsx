import { useState } from 'react'
import CommodityBadge from './CommodityBadge'
import FormFields from './FormFields'
import NaturalLanguageInput from './NaturalLanguageInput'
import OrderLinesTable from './OrderLinesTable'
import UploadZone from './UploadZone'
import LoadingSpinner from '../shared/LoadingSpinner'
import { createRequest } from '../shared/api'

const EMPTY_FORM = {
  requestor_name: '',
  title: '',
  vendor_name: '',
  vat_id: '',
  department: '',
  commodity_group_id: '',
  commodity_group_name: '',
}

const EMPTY_LINE = { description: '', unit_price: 0, quantity: 1, unit: 'units', total_price: 0 }

export default function IntakeForm({ onSubmitSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [orderLines, setOrderLines] = useState([{ ...EMPTY_LINE }])
  const [extracted, setExtracted] = useState(null)
  const [intakeMode, setIntakeMode] = useState('pdf') // 'nl' | 'pdf'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const str = (val) => (val && val !== 'null' && val !== 'N/A' && val !== 'n/a' ? val : null)

  const handleExtracted = (data) => {
    setExtracted(data)
    setForm((prev) => ({
      ...prev,
      title: str(data.title) || prev.title,
      vendor_name: str(data.vendor_name) || '',
      vat_id: str(data.vat_id) || '',
      requestor_name: str(data.requestor_name) || prev.requestor_name,
      department: str(data.department) || prev.department,
      commodity_group_id: str(data.commodity_group_id) || '',
      commodity_group_name: str(data.commodity_group_name) || '',
    }))
    if (data.order_lines?.length > 0) {
      setOrderLines(data.order_lines)
    }
  }

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCommodityChange = (id, name) => {
    setForm((prev) => ({ ...prev, commodity_group_id: id, commodity_group_name: name }))
  }

  const total = orderLines.reduce((sum, l) => sum + (l.total_price || 0), 0)

  const isValid =
    form.requestor_name &&
    form.title &&
    form.vendor_name &&
    form.vat_id &&
    /^DE\d{9}$/.test(form.vat_id) &&
    form.department &&
    form.commodity_group_id &&
    orderLines.length > 0 &&
    orderLines.every((l) => l.description)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createRequest({ ...form, total_cost: total, order_lines: orderLines, intake_method: extracted ? intakeMode : 'manual' })
      setForm(EMPTY_FORM)
      setOrderLines([{ ...EMPTY_LINE }])
      setExtracted(null)
      onSubmitSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">

      {/* Step 1 — Intake */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full bg-[#0f1e24] text-white text-xs font-semibold flex items-center justify-center shrink-0">1</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">What do you need to purchase?</h2>
              <p className="text-xs text-gray-400">AI will extract and pre-fill the form</p>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setIntakeMode('nl')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                intakeMode === 'nl' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ✦ Describe
            </button>
            <button
              type="button"
              onClick={() => setIntakeMode('pdf')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                intakeMode === 'pdf' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload PDF
            </button>
          </div>
        </div>
        <div className="p-6">
          {intakeMode === 'nl'
            ? <NaturalLanguageInput onExtracted={handleExtracted} />
            : <UploadZone onExtracted={handleExtracted} />
          }
        </div>
      </div>

      {/* Step 2 — Request details */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-[#0f1e24] text-white text-xs font-semibold flex items-center justify-center shrink-0">2</span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Request details</h2>
            <p className="text-xs text-gray-400">
              {extracted ? 'Fields pre-filled from document — review and adjust as needed' : 'Fill in the procurement request information'}
            </p>
          </div>
          {extracted && (
            <span className="ml-auto text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
              ✦ AI pre-filled
            </span>
          )}
        </div>
        <div className="p-6 space-y-6">
          <FormFields values={form} onChange={handleFieldChange} extracted={extracted} />
          <div className="border-t border-gray-100 pt-6">
            <OrderLinesTable lines={orderLines} onChange={setOrderLines} extracted={extracted} />
          </div>
          <div className="border-t border-gray-100 pt-6">
            <CommodityBadge
              groupId={form.commodity_group_id}
              groupName={form.commodity_group_name}
              onChange={handleCommodityChange}
              isAI={!!(extracted?.commodity_group_id)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">{error}</p>}

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full bg-[#0f1e24] text-white py-3 px-6 rounded-lg font-medium text-sm hover:bg-[#1a2f38] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isSubmitting ? <LoadingSpinner text="Submitting..." /> : 'Submit Request'}
      </button>
    </form>
  )
}
