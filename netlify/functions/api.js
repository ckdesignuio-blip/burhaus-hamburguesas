const { getStore } = require('@netlify/blobs')

const hdrs = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }

exports.handler = async (event, context) => {
  const method = event.httpMethod
  const qs = event.queryStringParameters || {}
  try {
    const store = getStore('burhaus')

    // ── GET ───────────────────────────────────────────────────
    if (method === 'GET') {
      if (qs.action === 'get-menu') {
        const data = await store.get('menu')
        if (!data) return { statusCode: 404, headers: hdrs, body: '{"error":"not_found"}' }
        return { statusCode: 200, headers: { ...hdrs, 'Cache-Control': 'max-age=30' }, body: data }
      }
      // Protected reads
      const user = context.clientContext?.user
      if (!user) return { statusCode: 401, headers: hdrs, body: '{"error":"unauthorized"}' }
      if (qs.action === 'get-orders') {
        const raw = (await store.get('orders')) || '[]'
        return { statusCode: 200, headers: hdrs, body: JSON.stringify({ orders: JSON.parse(raw) }) }
      }
    }

    // ── POST ──────────────────────────────────────────────────
    if (method === 'POST') {
      let body
      try { body = JSON.parse(event.body || '{}') }
      catch { return { statusCode: 400, headers: hdrs, body: '{"error":"bad_json"}' } }

      // Public: record order (no auth needed — no sensitive data)
      if (body.action === 'save-order') {
        const raw = (await store.get('orders')) || '[]'
        const orders = JSON.parse(raw)
        orders.push({ ...body.order, ts: Date.now() })
        if (orders.length > 5000) orders.splice(0, orders.length - 5000)
        await store.set('orders', JSON.stringify(orders))
        return { statusCode: 200, headers: hdrs, body: '{"ok":true}' }
      }

      // Protected writes — require Netlify Identity JWT
      const user = context.clientContext?.user
      if (!user) return { statusCode: 401, headers: hdrs, body: '{"error":"unauthorized"}' }

      if (body.action === 'save-menu') {
        await store.set('menu', JSON.stringify(body.data))
        return { statusCode: 200, headers: hdrs, body: '{"ok":true}' }
      }
    }

    return { statusCode: 404, headers: hdrs, body: '{"error":"not_found"}' }
  } catch (e) {
    console.error('[api]', e.message)
    return { statusCode: 500, headers: hdrs, body: JSON.stringify({ error: e.message }) }
  }
}
