import { InferenceRequest } from './inference-provider';

export const DEMO_DISCLAIMER = 'Scripted WorkPhelo demo. No LLM or live ERP data was used.';
// Repository-backed product descriptions only; product approval is required before demo activation.
export const DEMO_GUIDANCE = Object.freeze({
  'What can this demo do?':
    'You can create a private conversation, choose a sample question, review encrypted history and delete the conversation. This demo cannot inspect or change business records.',
  'How do I get started with WorkPhelo?':
    'Sign in with your tenant account. Your administrator controls module access and permissions. Choose an enabled module from navigation; contact your administrator if access is unavailable.',
  'How are employee records different from user access?':
    'HR employee records and authenticated system accounts are separate. Creating an employee does not automatically grant system access. Authorized administrators explicitly manage access.',
  'Who can read my demo conversation?':
    'Conversation APIs are tenant-scoped and owner-only. Stored message content is encrypted. Expiry is fixed at 720 hours from conversation creation, and physical cleanup is separately controlled.',
});
export function demoGuidance(request: InferenceRequest): string | undefined {
  if (request.messages.length !== 1 || request.messages[0].role !== 'user') return undefined;
  const question = request.messages[0].content;
  if (!Object.hasOwn(DEMO_GUIDANCE, question)) return undefined;
  return `${DEMO_DISCLAIMER}\n\n${DEMO_GUIDANCE[question as keyof typeof DEMO_GUIDANCE]}`;
}
