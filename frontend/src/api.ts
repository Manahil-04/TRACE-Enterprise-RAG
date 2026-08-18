const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function login(email: string, password: string): Promise<string> {
  const params = new URLSearchParams({ username: email, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function register(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
}

export interface SourceChunk {
  text: string;
  source: string;
  page: number;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
}

export async function askQuestion(token: string, query: string, k = 3): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, k }),
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
  return (await response.json()) as ChatResponse;
}

export async function uploadDocument(
  token: string,
  file: File
): Promise<{ message: string; filename: string; document_id: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
  return response.json();
}

export interface DocumentRead {
  id: number;
  filename: string;
  owner_id: number;
  uploaded_at: string;
}

export async function listDocuments(token: string): Promise<DocumentRead[]> {
  const response = await fetch(`${API_BASE_URL}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
  return response.json();
}

export async function deleteDocument(token: string, documentId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response));
}
