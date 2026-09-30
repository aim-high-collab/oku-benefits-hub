export async function api(method, path, body) {
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
