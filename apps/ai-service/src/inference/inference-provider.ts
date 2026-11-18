export const INFERENCE_PROVIDER = Symbol('INFERENCE_PROVIDER');

export interface InferenceRequest {
  readonly requestId: string;
  readonly messages: readonly {
    readonly role: 'system' | 'user' | 'assistant';
    readonly content: string;
  }[];
  readonly maxOutputTokens: number;
}

export interface InferenceOptions {
  readonly signal: AbortSignal;
  readonly deadlineAtMs: number;
}

export interface InferenceResult {
  readonly provider: string;
  readonly model: string;
  readonly synthetic: boolean;
  readonly text: string;
  readonly finishReason: 'completed' | 'length';
  readonly usage: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly source: 'synthetic' | 'provider' | 'unknown';
    readonly billing: 'NON_BILLABLE' | 'BILLABLE' | 'UNKNOWN';
  };
}

export interface InferenceProvider {
  generateText(request: InferenceRequest, options: InferenceOptions): Promise<InferenceResult>;
}
