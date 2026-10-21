// The static preview build sets <html data-demo>: everything runs in the browser (see demo-api.js).
const DEMO = document.documentElement.hasAttribute('data-demo');
let demo;

export async function api(method, path, body) {
  if (DEMO) {
    demo ??= await import('./demo-api.js');
    return demo.handle(method, path, body);
  }
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || 'Something went wrong. Please try again.'), {
      status: res.status,
      fields: data?.fields || {},
    });
  }
  return data;
}

export const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null && !(Array.isArray(v) && !v.length)) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};
