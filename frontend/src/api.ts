const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

/** AuthProvider registers this once so a 401 from any authenticated call -
 * including one firing well after login, e.g. the token expiring server-side -
 * clears the session and lets the existing ProtectedRoute redirect to /login,
 * instead of leaving the user stuck on a page with silently failing requests. */
export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

/** Shared response check for authenticated endpoints. Login/register deliberately
 * don't use this - a failed login attempt returning 401 must not clear an existing
 * session or trigger a redirect, it's just a rejected credentials check. */
async function throwIfError(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) unauthorizedListener?.();
  throw new ApiError(await parseErrorDetail(response), response.status);
}

export async function login(email: string, password: string): Promise<string> {
  const params = new URLSearchParams({ username: email, password });
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response), response.status);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function register(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new ApiError(await parseErrorDetail(response), response.status);
}

export interface SourceChunk {
  text: string;
  source: string;
  page: number;
}

export interface ChatResponse {
  exploration_id: number | null;
  exploration_title: string | null;
  message_id: number | null;
  answer: string | null;
  sources: SourceChunk[];
  follow_up_questions: string[];
  generation_failed: boolean;
}

export async function askQuestion(
  token: string,
  query: string,
  explorationId: number | null,
  k = 3
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, k, exploration_id: explorationId }),
  });
  await throwIfError(response);
  return (await response.json()) as ChatResponse;
}

export interface MessageRead {
  id: number;
  question: string;
  answer: string;
  sources: SourceChunk[];
  follow_up_questions: string[];
  created_at: string;
}

export interface ExplorationSummary {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ExplorationDetail {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: MessageRead[];
}

export async function listExplorations(token: string): Promise<ExplorationSummary[]> {
  const response = await fetch(`${API_BASE_URL}/explorations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfError(response);
  return response.json();
}

export async function getExploration(token: string, explorationId: number): Promise<ExplorationDetail> {
  const response = await fetch(`${API_BASE_URL}/explorations/${explorationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfError(response);
  return response.json();
}

export interface UploadResult {
  message: string;
  filename: string;
  document_id: number;
}

/** XMLHttpRequest, not fetch, so onProgress reflects real bytes sent - fetch
 * has no standard way to observe upload progress. Once the last byte is sent
 * (100%), the server still has to extract/chunk/embed the document with no
 * progress signal of its own; the caller should show an indeterminate state
 * for that gap rather than inferring further percentage. */
export function uploadDocument(
  token: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new ApiError("Unexpected response from server", xhr.status));
        }
        return;
      }
      if (xhr.status === 401) unauthorizedListener?.();
      let detail = `Request failed with status ${xhr.status}`;
      try {
        const body = JSON.parse(xhr.responseText) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // Non-JSON error body - keep the generic message.
      }
      reject(new ApiError(detail, xhr.status));
    };

    xhr.onerror = () => reject(new ApiError("Network error", 0));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
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
  await throwIfError(response);
  return response.json();
}

export async function deleteDocument(token: string, documentId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfError(response);
}
