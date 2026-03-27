import { useState } from 'react'

export default function FormFields({ values, onChange, extracted }) {
  const [touched, setTouched] = useState({})

  const isExtracted = (field) => extracted && extracted[field] != null
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }))

  const vatError =
    values.vat_id && !/^DE\d{9}$/.test(values.vat_id)
      ? 'Must be DE followed by 9 digits (e.g. DE123456789)'
      : null

  const fieldError = (field) => (!touched[field] ? null : !values[field] ? 'Required' : null)

  const inputClass = (field, extra = false) => {
    const err = fieldError(field) || extra
    return `w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      err
        ? 'border-red-300 focus:ring-red-400'
        : isExtracted(field)
        ? 'bg-teal-50 border-teal-200 focus:ring-teal-400'
        : 'border-gray-200 focus:ring-teal-400'
    }`
  }

  const AIBadge = ({ field }) =>
    isExtracted(field) ? (
      <span className="ml-1 text-teal-600 font-normal normal-case">✦</span>
    ) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Requestor Name <span className="text-red-400">*</span>
            <AIBadge field="requestor_name" />
          </label>
          <input
            className={inputClass('requestor_name')}
            value={values.requestor_name}
            onChange={(e) => onChange('requestor_name', e.target.value)}
            onBlur={() => touch('requestor_name')}
            placeholder="John Doe"
          />
          {fieldError('requestor_name') && (
            <p className="text-xs text-red-500 mt-1">{fieldError('requestor_name')}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Department <span className="text-red-400">*</span>
            <AIBadge field="department" />
          </label>
          <input
            className={inputClass('department')}
            value={values.department}
            onChange={(e) => onChange('department', e.target.value)}
            onBlur={() => touch('department')}
            placeholder="Marketing"
          />
          {fieldError('department') && (
            <p className="text-xs text-red-500 mt-1">{fieldError('department')}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Title / Short Description <span className="text-red-400">*</span>
          <AIBadge field="title" />
        </label>
        <input
          className={inputClass('title')}
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          onBlur={() => touch('title')}
          placeholder="Adobe Creative Cloud Subscription"
        />
        {fieldError('title') && (
          <p className="text-xs text-red-500 mt-1">{fieldError('title')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Vendor Name <span className="text-red-400">*</span>
            <AIBadge field="vendor_name" />
          </label>
          <input
            className={inputClass('vendor_name')}
            value={values.vendor_name}
            onChange={(e) => onChange('vendor_name', e.target.value)}
            onBlur={() => touch('vendor_name')}
            placeholder="Adobe Systems"
          />
          {fieldError('vendor_name') && (
            <p className="text-xs text-red-500 mt-1">{fieldError('vendor_name')}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            VAT ID (Umsatzsteuer-ID) <span className="text-red-400">*</span>
            <AIBadge field="vat_id" />
          </label>
          <input
            className={inputClass('vat_id', !!vatError)}
            value={values.vat_id}
            onChange={(e) => onChange('vat_id', e.target.value)}
            onBlur={() => touch('vat_id')}
            placeholder="DE123456789"
          />
          {(vatError || fieldError('vat_id')) && (
            <p className="text-xs text-red-500 mt-1">{vatError || fieldError('vat_id')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
