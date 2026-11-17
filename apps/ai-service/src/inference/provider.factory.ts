import { InferenceProvider } from './inference-provider';
import { MockExecutionConfig, MockInferenceProvider } from './mock.provider';

export function createInferenceProvider(config: MockExecutionConfig): InferenceProvider {
  // Construction is inert; disabled runtimes may boot but cannot generate.
  return new MockInferenceProvider(config);
}
