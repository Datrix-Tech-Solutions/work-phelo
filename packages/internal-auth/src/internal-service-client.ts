import { buildAuthHeaders, isUsableSecret } from './signing';

export class InternalServiceClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'InternalServiceClientError';
  }
}

export interface InternalServiceClientOptions {
  /** Name this service is registered under in the receiver's INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES. */
  serviceName: string;
  /** Label of the target, used in error messages (e.g. "hr-service"). */
  targetName: string;
  baseUrl: string | undefined;
  secret?: string;
  timeoutMs?: number;
}

export interface InternalRequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Signs and sends service-to-service HTTP calls. Each service wraps this in a
 * thin typed client; the signing scheme itself lives only here and in the guard.
 */
export class InternalServiceClient {
  private readonly baseUrl: string | undefined;
  private readonly secret: string | undefined;
  private readonly timeoutMs: number;

  constructor(private readonly options: InternalServiceClientOptions) {
    this.baseUrl = options.baseUrl?.trim().replace(/\/+$/, '') || undefined;
    this.secret = options.secret?.trim() || process.env.INTERNAL_SERVICE_AUTH_SECRET?.trim();
    const timeout = Number(options.timeoutMs);
    this.timeoutMs = Number.isSafeInteger(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && isUsableSecret(this.secret));
  }

  get<T>(path: string, options?: InternalRequestOptions) {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, options?: InternalRequestOptions) {
    return this.request<T>('POST', path, options);
  }

  patch<T>(path: string, options?: InternalRequestOptions) {
    return this.request<T>('PATCH', path, options);
  }

  delete<T>(path: string, options?: InternalRequestOptions) {
    return this.request<T>('DELETE', path, options);
  }

  async request<T>(method: string, path: string, options: InternalRequestOptions = {}): Promise<T> {
    const { targetName, serviceName } = this.options;
    if (!this.baseUrl) {
      throw new InternalServiceClientError(`${targetName} URL is not configured`, false);
    }
    try {
      new URL(this.baseUrl);
    } catch {
      throw new InternalServiceClientError(`${targetName} URL is invalid`, false);
    }
    if (!isUsableSecret(this.secret)) {
      throw new InternalServiceClientError(
        'INTERNAL_SERVICE_AUTH_SECRET is not configured or shorter than 32 characters',
        false,
      );
    }

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
    const queryString = query.toString();
    const hasBody = options.body !== undefined;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...buildAuthHeaders({
            secret: this.secret,
            serviceName,
            method,
            path,
          }),
        },
        body: hasBody ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new InternalServiceClientError(
        `${targetName} request ${method} ${path} failed: ${reason}`,
        true,
      );
    }

    const body = await this.readJson(response);
    if (!response.ok) {
      throw new InternalServiceClientError(
        this.errorMessage(body, response.status),
        response.status >= 500 || response.status === 408 || response.status === 429,
        response.status,
      );
    }
    return body as T;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private errorMessage(body: unknown, statusCode: number): string {
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
    return `${this.options.targetName} responded with status ${statusCode}`;
  }
}
