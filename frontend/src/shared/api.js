const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8002'

export async function extractFromText(text) {
  const response = await fetch(`${API_BASE}/extract/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Parsing failed')
  }
  return response.json()
}

export async function extractFromPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Extraction failed')
  }
  return response.json()
}

export async function createRequest(requestData) {
  const response = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create request')
  }
  return response.json()
}

export async function getRequests() {
  const response = await fetch(`${API_BASE}/requests`)
  if (!response.ok) throw new Error('Failed to fetch requests')
  return response.json()
}

export async function deleteRequest(requestId) {
  const response = await fetch(`${API_BASE}/requests/${requestId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to delete request')
  }
}

export async function updateRequest(requestId, data) {
  const response = await fetch(`${API_BASE}/requests/${requestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update request')
  }
  return response.json()
}

export async function addComment(requestId, author, text) {
  const response = await fetch(`${API_BASE}/requests/${requestId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, text }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to post comment')
  }
  return response.json()
}

export async function updateNote(requestId, note) {
  const response = await fetch(`${API_BASE}/requests/${requestId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to save note')
  }
  return response.json()
}

export async function updateStatus(requestId, status) {
  const response = await fetch(`${API_BASE}/requests/${requestId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to update status')
  }
  return response.json()
}

export async function runAgent(requestId, onStep, onDone, onError) {
  let response
  try {
    response = await fetch(`${API_BASE}/requests/${requestId}/agent`, {
      method: 'POST',
    })
  } catch (err) {
    onError('Agent unavailable — check backend connection.')
    return
  }

  if (!response.ok) {
    onError(`Agent error: ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop()

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'step') onStep(event.text)
        if (event.type === 'done') onDone(event)
        if (event.type === 'error') onError(event.text)
      } catch {
        // malformed event — skip
      }
    }
  }
}
