import { InferenceRequest } from './inference-provider';

export const DEMO_DISCLAIMER = 'Scripted WorkPhelo demo. No LLM or live ERP data was used.';
const reviewPending = Object.freeze({
  status: 'pending-product-review',
  approvedBy: null,
  approvedAt: null,
} as const);

function reviewCandidate(id: string, question: string, answer: string) {
  return Object.freeze({ id, question, answer, approval: reviewPending });
}

export const PRODUCT_GUIDANCE_CATALOG = Object.freeze({
  version: 'workphelo-product-guidance-v1',
  entries: Object.freeze([
    reviewCandidate(
      'demo-capabilities',
      'What can this demo do?',
      'You can create a private conversation, choose a sample question, review encrypted history and delete the conversation. This demo cannot inspect or change business records.',
    ),
    reviewCandidate(
      'getting-started',
      'How do I get started with WorkPhelo?',
      'Sign in with your tenant account. Your administrator controls module access and permissions. Choose an enabled module from navigation; contact your administrator if access is unavailable.',
    ),
    reviewCandidate(
      'employee-records-and-access',
      'How are employee records different from user access?',
      'HR employee records and authenticated system accounts are separate. Creating an employee does not automatically grant system access. Authorized administrators explicitly manage access.',
    ),
    reviewCandidate(
      'conversation-privacy',
      'Who can read my demo conversation?',
      'Conversation APIs are tenant-scoped and owner-only. Stored message content is encrypted. Expiry is fixed at 720 hours from conversation creation, and physical cleanup is separately controlled.',
    ),
  ]),
});

// Preserve the isolated demo's discovery contract.
export const DEMO_GUIDANCE = Object.freeze(
  Object.fromEntries(
    PRODUCT_GUIDANCE_CATALOG.entries.map(({ question, answer }) => [question, answer]),
  ),
);

export function matchGuidanceCandidate(content: string) {
  const matches = PRODUCT_GUIDANCE_CATALOG.entries.filter(({ question }) => question === content);
  return matches.length === 1 ? matches[0] : undefined;
}

export function demoGuidance(request: InferenceRequest): string | undefined {
  if (request.messages.length !== 1 || request.messages[0].role !== 'user') return undefined;
  const candidate = matchGuidanceCandidate(request.messages[0].content);
  if (!candidate) return undefined;
  return `${DEMO_DISCLAIMER}\n\n${candidate.answer}`;
}
