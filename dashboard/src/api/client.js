const BASE_URL = import.meta.env.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("guardiao_token");
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    localStorage.removeItem("guardiao_token");
    window.location.href = "/login";
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro ?? `Erro ${res.status}`);
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path)
};
