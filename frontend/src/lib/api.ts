import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

type RetryConfig = { _retry?: boolean };

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  refreshPromise ??= axios
    .post("/api/auth/refresh", {}, { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & RetryConfig) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";
    const isAuthCall = url.includes("/auth/");

    if (status === 401 && config && !config._retry && !isAuthCall) {
      config._retry = true;
      try {
        await refreshSession();
        return api.request(config);
      } catch {
        // Fall through to the original error; the UI will redirect to /login.
      }
    }
    return Promise.reject(error);
  },
);

export function tenantHeaders(tenantId: string) {
  return { headers: { "X-Tenant-Id": tenantId } };
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { error?: { message?: string; details?: unknown } }
      | undefined;
    const message = payload?.error?.message;
    if (message) {
      const details = payload?.error?.details;
      if (Array.isArray(details) && details.length > 0) {
        const first = details[0] as { message?: string; path?: string };
        return first.message ? `${message}: ${first.message}` : message;
      }
      return message;
    }
    if (error.code === "ERR_NETWORK") return "Cannot reach the API. Is the backend running?";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export function conflictCurrentTask(error: unknown) {
  if (!axios.isAxiosError(error)) return null;
  if (error.response?.status !== 409) return null;
  const payload = error.response.data as { error?: { details?: { currentTask?: unknown } } };
  return payload.error?.details?.currentTask ?? null;
}
