// Thin fetch wrapper. All requests send the session cookie (credentials).
const API = (() => {
  async function req(method, url, body, isForm = false) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body && !isForm) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (isForm) {
      opts.body = body; // FormData
    }
    const res = await fetch('/api' + url, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  return {
    get:  (u) => req('GET', u),
    post: (u, b) => req('POST', u, b),
    put:  (u, b) => req('PUT', u, b),
    del:  (u) => req('DELETE', u),
    upload: (u, formData) => req('POST', u, formData, true),
  };
})();
