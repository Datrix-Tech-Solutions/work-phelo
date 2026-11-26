import { OpenAPIObject } from '@nestjs/swagger';
import {
  OperationObject,
  ParameterObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const AI_DEMO_QUESTIONS = [
  'What can this demo do?',
  'How do I get started with WorkPhelo?',
  'How are employee records different from user access?',
  'Who can read my demo conversation?',
] as const;

const ref = (name: string): ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});
const object = (
  properties: Record<string, SchemaObject | ReferenceObject>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const uuid: SchemaObject = {
  type: 'string',
  format: 'uuid',
  pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
  example: '11111111-1111-4111-8111-111111111111',
};
const date: SchemaObject = {
  type: 'string',
  format: 'date-time',
  example: '2026-11-26T12:00:00.000Z',
};
const cursor: SchemaObject = {
  type: 'string',
  nullable: true,
  maxLength: 256,
  pattern: '^[A-Za-z0-9_-]+$',
  example: null,
  description:
    'Opaque endpoint-specific cursor; null when no next page. Do not construct or reuse across endpoint types.',
};
const sequence: SchemaObject = {
  type: 'integer',
  minimum: 1,
  maximum: 2147483647,
  example: 1,
};
const userProperties = {
  id: uuid,
  conversationId: uuid,
  sequence,
  role: { type: 'string', enum: ['USER'] } as SchemaObject,
  createdAt: date,
};
const conversationProperties = {
  id: uuid,
  createdAt: date,
  updatedAt: date,
  expiresAt: {
    ...date,
    example: '2026-12-26T12:00:00.000Z',
    description:
      'Fixed createdAt + 720 hours. Reads/appends do not extend expiry; physical cleanup is separately controlled.',
  },
};
const text: SchemaObject = {
  type: 'string',
  minLength: 1,
  maxLength: 16384,
  'x-max-utf8-bytes': 16384,
  description:
    'Valid UTF-8, at most 16 KiB. In scripted-demo mode only the exact four catalog questions are accepted.',
} as SchemaObject;

const schemas: Record<string, SchemaObject> = {
  AiDemoQuestion: {
    type: 'string',
    enum: [...AI_DEMO_QUESTIONS],
    example: AI_DEMO_QUESTIONS[0],
  },
  AiDemoConfiguration: object({
    configured: { type: 'boolean', enum: [true] },
    mode: { type: 'string', enum: ['scripted-demo'] },
    disclaimer: {
      type: 'string',
      enum: ['Scripted WorkPhelo demo. No LLM or live ERP data was used.'],
    },
    questions: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      uniqueItems: true,
      items: ref('AiDemoQuestion'),
    },
  }),
  AiEligibility: object(
    {
      eligible: { type: 'boolean', enum: [true] },
      inferenceAvailable: { type: 'boolean', enum: [false] },
      demo: ref('AiDemoConfiguration'),
    },
    ['eligible', 'inferenceAvailable'],
  ),
  AiCreateConversationRequest: {
    type: 'object',
    additionalProperties: false,
    maxProperties: 0,
    example: {},
  },
  AiCreatedConversation: object({
    id: uuid,
    createdAt: date,
    expiresAt: conversationProperties.expiresAt,
  }),
  AiConversation: object(conversationProperties),
  AiConversationList: object({
    items: {
      type: 'array',
      maxItems: 100,
      items: ref('AiConversation'),
      description:
        'Newest createdAt first, then ID descending; only owned, unexpired conversations.',
    },
    nextCursor: cursor,
  }),
  AiMessageRole: {
    type: 'string',
    enum: ['USER', 'DEMO_ASSISTANT'],
    description:
      'DEMO_ASSISTANT means scripted output, never real LLM inference.',
  },
  AiUserMessageMetadata: object(userProperties),
  AiMessage: object({
    ...userProperties,
    role: ref('AiMessageRole'),
    content: text,
  }),
  AiDemoReply: object({
    ...userProperties,
    sequence: { ...sequence, example: 2 },
    role: { type: 'string', enum: ['DEMO_ASSISTANT'] },
    content: {
      ...text,
      example:
        'Scripted WorkPhelo demo. No LLM or live ERP data was used.\n\nYou can create a private conversation, choose a sample question, review encrypted history and delete the conversation. This demo cannot inspect or change business records.',
    },
  }),
  AiConversationDetail: object({
    conversation: ref('AiConversation'),
    messages: object({
      items: {
        type: 'array',
        maxItems: 100,
        items: ref('AiMessage'),
        description:
          'Sequence ascending. Pages may split a turn; merge by message ID/sequence. Response also has a bounded byte budget.',
      },
      nextCursor: cursor,
    }),
  }),
  AiAppendMessageRequest: object({
    content: { ...text, example: AI_DEMO_QUESTIONS[0] },
  }),
  AiDemoAppendMessageRequest: object({ content: ref('AiDemoQuestion') }),
  AiDemoTurn: object({
    ...userProperties,
    demo: object({
      mode: { type: 'string', enum: ['scripted-demo'] },
      synthetic: { type: 'boolean', enum: [true] },
      reply: ref('AiDemoReply'),
    }),
  }),
  AiSanitizedError: object({
    statusCode: { type: 'integer', minimum: 400, maximum: 599 },
    code: {
      type: 'string',
      enum: [
        'INVALID_REQUEST',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'AI_STORAGE_QUOTA_EXCEEDED',
        'REQUEST_TOO_LARGE',
        'UNSUPPORTED_MEDIA_TYPE',
        'RATE_LIMITED',
        'SERVICE_UNAVAILABLE',
        'GATEWAY_TIMEOUT',
      ],
    },
    message: {
      type: 'string',
      description: 'Safe summary, not raw provider/database diagnostics.',
    },
    requestId: { type: 'string', format: 'uuid' },
  }),
  AiGatewayError: {
    type: 'object',
    required: ['statusCode', 'message'],
    properties: {
      statusCode: { type: 'integer', minimum: 400, maximum: 599 },
      message: { type: 'string' },
      error: { type: 'string' },
      availableServices: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: true,
    description:
      'Existing generic Gateway/global HTTP error shape, including early eligibility rejection. It does not guarantee code or requestId.',
  },
};

const rates =
  'Conversation limits when enabled: reads 600/minute per tenant (burst 100) and 60/minute per owner (burst 10). Writes and deletes have separate buckets: 100/minute per tenant (burst 20), 10/minute per owner (burst 2). Execution permits: 10 per tenant, 2 per owner. Global Gateway throttling also applies.';
const auth =
  "Active, fully authenticated tenant users only. Gateway revalidates current Auth state; restricted/careers sessions are rejected. Bearer token OR access_token session cookie; do not send conflicting credentials. Cookies require credentials: include and configured CORS origins. Tenant/owner scope is server-derived; administrator role does not grant access to another owner's conversations.";
const demo =
  'Scripted demo, NOT a real LLM. No live ERP records or ERP mutations. Display the demo disclaimer. Only four exact catalog questions are accepted when demo mode is enabled. Demo configuration is default-off and requires separately authorized isolated runtime setup. This documentation does not enable functionality.';
const idempotency: ParameterObject = {
  in: 'header',
  name: 'Idempotency-Key',
  required: true,
  description:
    'Choose a durable key for each new operation. Retry unchanged body/key after timeout or response loss: a commit may already have succeeded. Committed replay returns original IDs/timestamps/content without calling the provider. Changed input with the same retained key conflicts. Never construct internal proofs or replay nonce headers.',
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$',
  },
  example: 'demo-turn-001',
};
const origin: ParameterObject = {
  in: 'header',
  name: 'Origin',
  required: false,
  description:
    'Required for POST/DELETE using an access_token cookie, even with matching Bearer auth. Browser supplies this automatically; it must exactly match Gateway ALLOWED_ORIGINS. Localhost and 127.0.0.1 differ. Bearer-only clients do not require Origin.',
  schema: { type: 'string', format: 'uri' },
  example: 'http://localhost:3000',
};
const id: ParameterObject = {
  in: 'path',
  name: 'id',
  required: true,
  description: 'Canonical lowercase conversation UUID.',
  schema: uuid,
};
const page: ParameterObject[] = [
  {
    in: 'query',
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'No duplicate parameters or other query fields.',
  },
  {
    in: 'query',
    name: 'cursor',
    required: false,
    schema: { type: 'string', maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' },
    description:
      'Pass the previous nextCursor unchanged. Omit rather than sending null or an empty string.',
  },
];
const json = (schema: SchemaObject | ReferenceObject) => ({
  'application/json': { schema },
});
const success = (description: string, name: string): ResponseObject => ({
  description,
  content: json(ref(name)),
});
const errors = (statuses: number[]): Record<string, ResponseObject> =>
  Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        description: (
          {
            400: 'Invalid payload/query/auth representation; non-catalog demo input is rejected.',
            401: 'Missing/invalid access token or rejected trusted request.',
            403: 'Restricted session, origin or authorization rejected.',
            404: 'Missing, expired or out-of-scope conversation; non-disclosing.',
            409: 'Idempotency conflict or storage/message quota exceeded. Do not blindly create replacement conversations.',
            413: 'Request or message too large.',
            415: 'Expected application/json (UTF-8), no compression.',
            429: 'Rate or execution capacity reached. Respect bounded Retry-After; no retry storm.',
            503: 'Disabled feature, configuration/mode mismatch, missing service or unavailable dependency. No success is implied.',
            504: 'Five-second conversation budget exhausted, or generic Gateway timeout. Commit may have succeeded; retry the same operation/key/body.',
          } as Record<number, string>
        )[status],
        content: json({
          anyOf: [ref('AiSanitizedError'), ref('AiGatewayError')],
        }),
        ...(status === 429
          ? {
              headers: {
                'Retry-After': {
                  description:
                    'AI admission/concurrency responses use integer seconds in 1..60; global Gateway throttling may use its own response contract.',
                  schema: { type: 'integer', minimum: 1, maximum: 60 },
                  example: 6,
                },
              },
            }
          : {}),
      },
    ]),
  );
function operation(
  operationId: string,
  summary: string,
  description: string,
  parameters: ParameterObject[],
  responses: Record<string, ResponseObject>,
): OperationObject {
  return {
    operationId,
    summary,
    description: `${description}\n\n${auth}\n\n${demo}${operationId === 'aiEligibility' ? '' : '\n\n' + rates}`,
    tags: ['AI Assistant'],
    security: [{ 'access-token': [] }, { cookie: [] }],
    parameters,
    responses,
  };
}

// Gateway has a wildcard proxy, so Nest cannot discover the six concrete paths.
// Augment only its existing Swagger document; register no controllers or routes.
export function addAiOpenApi(document: OpenAPIObject): void {
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...schemas };
  document.tags = [
    ...(document.tags ?? []).filter((tag) => tag.name !== 'AI Assistant'),
    {
      name: 'AI Assistant',
      description:
        'Authenticated, owner-only encrypted history and explicitly isolated scripted demo. Real inference remains unavailable.',
    },
  ];
  const base = '/api/v1/ai';
  document.paths[`${base}/eligibility`] = {
    get: operation(
      'aiEligibility',
      'Get AI eligibility and optional demo catalog',
      'Returns inferenceAvailable=false even for the scripted demo. Optional demo.configured describes configuration, NOT Redis/database readiness. When absent, hide demo chat. Existing generic Gateway errors may omit code/requestId. This endpoint does not consume conversation admission/proofs.',
      [],
      {
        '200': success(
          'Authenticated eligibility; demo information is optional.',
          'AiEligibility',
        ),
        ...errors([400, 401, 403, 429, 503, 504]),
      },
    ),
  };
  document.paths[`${base}/conversations`] = {
    post: {
      ...operation(
        'aiCreateConversation',
        'Create a private conversation',
        'Creates an empty conversation with fixed 720-hour expiry. Both processes must have compatible enabled conversation configuration. Require Content-Type application/json and an explicit empty object; no tenant/user/title fields. Responses are no-store.',
        [idempotency, origin],
        {
          '201': success(
            'Created, or exact replay of a live owned conversation.',
            'AiCreatedConversation',
          ),
          ...errors([400, 401, 403, 404, 409, 413, 415, 429, 503, 504]),
        },
      ),
      requestBody: {
        required: true,
        content: json(ref('AiCreateConversationRequest')),
      },
    },
    get: operation(
      'aiListConversations',
      'List owned active conversations',
      'Newest first; only the current tenant/user. No request body or Idempotency-Key. Responses are no-store.',
      page,
      {
        '200': success(
          'Cursor-paginated conversation metadata.',
          'AiConversationList',
        ),
        ...errors([400, 401, 403, 413, 415, 429, 503, 504]),
      },
    ),
  };
  document.paths[`${base}/conversations/{id}`] = {
    get: operation(
      'aiConversationDetail',
      'Read owned conversation and ordered messages',
      'Decrypted content is returned only after ownership and expiry checks. No request body or Idempotency-Key. Encrypted records remain unreadable after expiry; missing/corrupt key or ciphertext fails closed. Responses are no-store.',
      [id, ...page],
      {
        '200': success(
          'Conversation and sequence-ordered message page.',
          'AiConversationDetail',
        ),
        ...errors([400, 401, 403, 404, 413, 415, 429, 503, 504]),
      },
    ),
    delete: operation(
      'aiDeleteConversation',
      'Permanently delete an owned active conversation',
      'Atomic message cascade; no request body, query fields or Idempotency-Key. Requires frontend confirmation. First success is 204; repeat/missing/expired/foreign ID is 404. Deletion does not promise backup erasure.',
      [id, origin],
      {
        '204': { description: 'Deleted. Empty response body.' },
        ...errors([400, 401, 403, 404, 413, 415, 429, 503, 504]),
      },
    ),
  };
  document.paths[`${base}/conversations/{id}/messages`] = {
    post: {
      ...operation(
        'aiAppendMessage',
        'Append a message and receive a scripted demo reply when enabled',
        'In isolated demo mode, the four catalog questions produce an encrypted USER/DEMO_ASSISTANT pair and one receipt atomically; quotas count both rows. If demo generation is OFF on both processes, the pre-existing user-only endpoint returns USER metadata without a reply. Do not represent that as chat or silently fall back. Mode disagreement is 503 before AI nonce/business writes. Browser submits only content, never mode, role, tenant or proof fields. No query parameters. Responses are no-store.',
        [id, idempotency, origin],
        {
          '201': {
            description:
              'DemoTurn in enabled isolated-demo mode; USER metadata only in existing non-demo mode. Exact committed replay returns the stored response.',
            content: json({
              oneOf: [ref('AiDemoTurn'), ref('AiUserMessageMetadata')],
            }),
          },
          ...errors([400, 401, 403, 404, 409, 413, 415, 429, 503, 504]),
        },
      ),
      requestBody: {
        required: true,
        content: json({
          anyOf: [
            ref('AiDemoAppendMessageRequest'),
            ref('AiAppendMessageRequest'),
          ],
          description:
            'The authoritative server mode selects the accepted schema. Demo mode requires a catalog question; non-demo mode preserves the existing user-only UTF-8 contract.',
        }),
      },
    },
  };
}
