// Cliente HTTP simples para a API do NOUS Excellence.
// Usa cookie httpOnly para autenticacao (credentials: include).

async function request(method, url, body, isForm = false) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body != null) {
    if (isForm) {
      opts.body = body; // FormData
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    // Sessao expirada -> volta ao login (exceto na propria pagina de login)
    if (!location.pathname.endsWith('/login')) location.href = '/login';
    throw new Error('Nao autenticado');
  }
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  if (!res.ok) throw new Error((data && data.error) || `Erro ${res.status}`);
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
  postForm: (u, fd) => request('POST', u, fd, true),
};
