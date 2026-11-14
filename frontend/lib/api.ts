/**
 * Centralized API configuration for ResearchGraph frontend.
 * Resolves NEXT_PUBLIC_BACKEND_URL, strips trailing slashes, and restricts localhost fallback to development.
 */

const RAW_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Returns the normalized backend origin.
 * In development, defaults to "http://localhost:8000" if unconfigured.
 * In production, does NOT silently fallback to localhost; returns empty string if missing.
 */
export function getBackendUrl(): string {
  if (RAW_BACKEND_URL.trim()) {
    return RAW_BACKEND_URL.trim().replace(/\/+$/, "");
  }

  if (!IS_PRODUCTION) {
    return "http://localhost:8000";
  }

  return "";
}

/**
 * Checks whether a backend URL is properly configured.
 */
export function isBackendConfigured(): boolean {
  return Boolean(getBackendUrl());
}

/**
 * Constructs a fully qualified API URL.
 * Throws a human-readable configuration error if unconfigured in production.
 */
export function buildApiUrl(path: string): string {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error(
      "Backend URL is not configured. Please set NEXT_PUBLIC_BACKEND_URL in your deployment environment."
    );
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${backendUrl}${cleanPath}`;
}

export interface CapabilityItem {
  available: boolean;
  message: string;
  [key: string]: any;
}

export interface BackendCapabilities {
  status: string;
  environment: string;
  capabilities: {
    discovery: CapabilityItem & { providers?: string[] };
    persistence: CapabilityItem;
    pdf_processing: CapabilityItem;
    ollama_inference: CapabilityItem & { model?: string; base_url?: string };
    embeddings: CapabilityItem & { model?: string };
    experiment_generation: CapabilityItem;
    experiment_execution: CapabilityItem & { enabled: boolean };
  };
  timestamp: string;
}

export interface BackendHealth {
  status: string;
  environment: string;
  timestamp: string;
}

/**
 * Lightweight fetch helper that handles unconfigured backend and network errors.
 */
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = buildApiUrl(path);

  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errorMsg = `Server responded with ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorMsg = typeof errorJson.detail === "string" ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch {
        // Fall back to status text
      }
      throw new Error(errorMsg);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(
        `Unable to connect to backend at ${getBackendUrl()}. Please verify the backend service is running and accessible.`
      );
    }
    throw err;
  }
}

/**
 * Probes the backend capabilities endpoint.
 */
export async function fetchBackendCapabilities(): Promise<BackendCapabilities | null> {
  if (!isBackendConfigured()) return null;
  try {
    return await apiFetch<BackendCapabilities>("/api/capabilities");
  } catch (err) {
    console.warn("Failed to fetch backend capabilities:", err);
    return null;
  }
}

/**
 * Checks backend /health.
 */
export async function checkBackendHealth(): Promise<BackendHealth | null> {
  if (!isBackendConfigured()) return null;
  try {
    return await apiFetch<BackendHealth>("/health");
  } catch (err) {
    return null;
  }
}
