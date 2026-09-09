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

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
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

export type Role = "admin" | "user";

export interface CurrentUser {
  id: number;
  email: string;
  role: Role;
}

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders(token) });
  await throwIfError(response);
  return response.json();
}

export interface UserSummary {
  id: number;
  email: string;
  role: Role;
  created_at: string;
}

export async function listUsers(token: string): Promise<UserSummary[]> {
  const response = await fetch(`${API_BASE_URL}/auth/users`, { headers: authHeaders(token) });
  await throwIfError(response);
  return response.json();
}

export async function updateUserRole(token: string, userId: number, role: Role): Promise<UserSummary> {
  const response = await fetch(`${API_BASE_URL}/auth/users/${userId}/role`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ role }),
  });
  await throwIfError(response);
  return response.json();
}

export interface SourceChunk {
  text: string;
  source: string;
  page: number;
  document_id: number | null;
  file_available: boolean;
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
  workspaceId: number | null
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ query, exploration_id: explorationId, workspace_id: workspaceId }),
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
  workspace_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ExplorationDetail {
  id: number;
  title: string;
  workspace_id: number;
  created_at: string;
  updated_at: string;
  messages: MessageRead[];
}

export async function listExplorations(token: string, workspaceId: number): Promise<ExplorationSummary[]> {
  const response = await fetch(`${API_BASE_URL}/explorations?workspace_id=${workspaceId}`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  return response.json();
}

export async function getExploration(token: string, explorationId: number): Promise<ExplorationDetail> {
  const response = await fetch(`${API_BASE_URL}/explorations/${explorationId}`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  return response.json();
}

export async function renameExploration(
  token: string,
  explorationId: number,
  title: string
): Promise<ExplorationSummary> {
  const response = await fetch(`${API_BASE_URL}/explorations/${explorationId}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ title }),
  });
  await throwIfError(response);
  return response.json();
}

export async function deleteExploration(token: string, explorationId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/explorations/${explorationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await throwIfError(response);
}

export interface UploadResult {
  message: string;
  filename: string;
  document_id: number;
  ocr_used: boolean;
}

/** XMLHttpRequest, not fetch, so onProgress reflects real bytes sent - fetch
 * has no standard way to observe upload progress. Once the last byte is sent
 * (100%), the server still has to extract/chunk/embed the document with no
 * progress signal of its own; the caller should show an indeterminate state
 * for that gap rather than inferring further percentage. */
export function uploadDocument(
  token: string,
  file: File,
  workspaceId: number,
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
    formData.append("workspace_id", String(workspaceId));
    formData.append("file", file);
    xhr.send(formData);
  });
}

export interface DocumentRead {
  id: number;
  filename: string;
  owner_id: number;
  workspace_id: number;
  content_type: string | null;
  size_bytes: number | null;
  ocr_used: boolean;
  uploaded_at: string;
  file_available: boolean;
}

export async function listDocuments(token: string, workspaceId: number): Promise<DocumentRead[]> {
  const response = await fetch(`${API_BASE_URL}/documents?workspace_id=${workspaceId}`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  return response.json();
}

export async function renameDocument(token: string, documentId: number, filename: string): Promise<DocumentRead> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ filename }),
  });
  await throwIfError(response);
  return response.json();
}

export async function deleteDocument(token: string, documentId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await throwIfError(response);
}

async function fetchDocumentBlob(token: string, documentId: number, mode: "view" | "download"): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/${mode}`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  return response.blob();
}

/** Authenticated endpoints can't be opened with a plain `<a href>`/window.open
 * (no way to attach the Bearer header to a top-level navigation), so the file
 * is fetched as a blob first and handed to the browser from there.
 *
 * `page`, when given, is appended as a `#page=N` fragment - the browser's
 * native PDF viewer (Chrome/Edge/Firefox) jumps straight to that page. There's
 * no equivalent fragment for jumping to/highlighting a specific passage of
 * text within the page - that would need an embedded PDF.js viewer instead of
 * the browser's own, so evidence links land on the right page, not the exact
 * highlighted line. */
export async function viewDocument(token: string, documentId: number, page?: number): Promise<void> {
  const blob = await fetchDocumentBlob(token, documentId, "view");
  const url = URL.createObjectURL(blob);
  window.open(page ? `${url}#page=${page}` : url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocument(token: string, documentId: number, filename: string): Promise<void> {
  const blob = await fetchDocumentBlob(token, documentId, "download");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface SearchResult {
  document_id: number;
  filename: string;
  page: number;
  chunk_index: number;
  snippet: string;
  file_available: boolean;
}

export async function searchDocuments(token: string, workspaceId: number, query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ workspace_id: String(workspaceId), query });
  const response = await fetch(`${API_BASE_URL}/search?${params.toString()}`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  const body = (await response.json()) as { results: SearchResult[] };
  return body.results;
}

export interface WorkspaceRead {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  document_count: number;
  member_count: number;
}

export async function listWorkspaces(token: string): Promise<WorkspaceRead[]> {
  const response = await fetch(`${API_BASE_URL}/workspaces`, { headers: authHeaders(token) });
  await throwIfError(response);
  return response.json();
}

export async function createWorkspace(token: string, name: string): Promise<WorkspaceRead> {
  const response = await fetch(`${API_BASE_URL}/workspaces`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ name }),
  });
  await throwIfError(response);
  return response.json();
}

export async function renameWorkspace(token: string, workspaceId: number, name: string): Promise<WorkspaceRead> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ name }),
  });
  await throwIfError(response);
  return response.json();
}

export async function deleteWorkspace(token: string, workspaceId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await throwIfError(response);
}

export interface WorkspaceMember {
  user_id: number;
  email: string;
  role: Role;
}

export async function listWorkspaceMembers(token: string, workspaceId: number): Promise<WorkspaceMember[]> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/members`, {
    headers: authHeaders(token),
  });
  await throwIfError(response);
  return response.json();
}

export async function addWorkspaceMember(
  token: string,
  workspaceId: number,
  userId: number
): Promise<WorkspaceMember> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/members`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ user_id: userId }),
  });
  await throwIfError(response);
  return response.json();
}

export async function removeWorkspaceMember(token: string, workspaceId: number, userId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await throwIfError(response);
}

export interface RagSettings {
  default_top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  ocr_enabled: boolean;
  updated_at: string;
}

export interface RagSettingsUpdate {
  default_top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  ocr_enabled: boolean;
}

export async function getSettings(token: string): Promise<RagSettings> {
  const response = await fetch(`${API_BASE_URL}/admin/settings`, { headers: authHeaders(token) });
  await throwIfError(response);
  return response.json();
}

export async function updateSettings(token: string, payload: RagSettingsUpdate): Promise<RagSettings> {
  const response = await fetch(`${API_BASE_URL}/admin/settings`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
  });
  await throwIfError(response);
  return response.json();
}
