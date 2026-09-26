const OWNER = 'ckdesignuio-blip'
const REPO  = 'burhaus-hamburguesas'
const MENU  = 'data/menu.json'

const hdrs = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }

async function ghGet(path) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'burhaus-admin' }
  })
  if (!r.ok) throw new Error(`GitHub GET ${r.status}`)
  return r.json()
}

async function ghPut(path, content, sha) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'burhaus-admin' },
    body: JSON.stringify({ message: 'Update menu from admin panel', content, sha })
  })
  if (!r.ok) { const e = await r.text(); throw new Error(`GitHub PUT ${r.status}: ${e}`) }
  return r.json()
}

exports.handler = async (event, context) => {
  const method = event.httpMethod
  const qs    = event.queryStringParameters || {}

  try {
    if (method === 'GET') {
      if (qs.action === 'get-menu') {
        try {
          const file = await ghGet(MENU)
          const body = Buffer.from(file.content, 'base64').toString('utf-8')
          return { statusCode: 200, headers: { ...hdrs, 'Cache-Control': 'max-age=30' }, body }
        } catch {
          return { statusCode: 404, headers: hdrs, body: '{"error":"not_found"}' }
        }
      }
      const user = context.clientContext?.user
      if (!user) return { statusCode: 401, headers: hdrs, body: '{"error":"unauthorized"}' }
      if (qs.action === 'get-orders') {
        return { statusCode: 200, headers: hdrs, body: '{"orders":[]}' }
      }
    }

    if (method === 'POST') {
      let body
      try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers: hdrs, body: '{"error":"bad_json"}' } }

      if (body.action === 'save-order') {
        return { statusCode: 200, headers: hdrs, body: '{"ok":true}' }
      }

      const user = context.clientContext?.user
      if (!user) return { statusCode: 401, headers: hdrs, body: '{"error":"unauthorized"}' }

      if (body.action === 'save-menu') {
        const file    = await ghGet(MENU)
        const content = Buffer.from(JSON.stringify(body.data, null, 2)).toString('base64')
        await ghPut(MENU, content, file.sha)
        return { statusCode: 200, headers: hdrs, body: '{"ok":true}' }
      }
    }

    return { statusCode: 404, headers: hdrs, body: '{"error":"not_found"}' }
  } catch (e) {
    console.error('[api]', e.message)
    return { statusCode: 500, headers: hdrs, body: JSON.stringify({ error: e.message }) }
  }
}
