import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function isPasswordChangeRequired(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("response" in error)) return false;
  const response = (error as { response?: { status?: number; data?: unknown } }).response;
  if (response?.status !== 403) return false;
  const data = response.data;
  if (!data || typeof data !== "object") return false;
  const errorField = (data as { error?: unknown }).error;
  if (typeof errorField === "string") {
    return errorField.toLowerCase().includes("password change required");
  }
  if (errorField && typeof errorField === "object") {
    const record = errorField as { code?: string; message?: string };
    if (record.code === "PASSWORD_CHANGE_REQUIRED") return true;
    if (typeof record.message === "string") {
      return record.message.toLowerCase().includes("password change required");
    }
  }
  return false;
}

function isAuthBootstrapUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("/auth/me") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/login") ||
    url.includes("/auth/logout")
  );
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  useAuthStore.getState().clear();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as RetriableConfig | undefined;

    if (status === 403 && isPasswordChangeRequired(error)) {
      const { isAuthenticated, mustChangePassword } = useAuthStore.getState();
      if (isAuthenticated) {
        if (!mustChangePassword) {
          useAuthStore.setState({ mustChangePassword: true });
        }
        if (window.location.pathname !== "/change-password") {
          window.location.href = "/change-password";
        }
        return Promise.reject(error);
      }
    }

    if (status === 401 && config && !config._retry && !isAuthBootstrapUrl(config.url)) {
      config._retry = true;
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return api.request(config);
      }
      redirectToLogin();
      return Promise.reject(error);
    }

    if (
      (status === 401 || status === 403) &&
      !isAuthBootstrapUrl(config?.url) &&
      window.location.pathname !== "/login"
    ) {
      if (status === 401) {
        redirectToLogin();
      }
    }

    return Promise.reject(error);
  }
);
