# A2A transport profile

An authenticated HTTP profile for three A2A v1.0 operations (`SendMessage`, `GetTask`,
`CancelTask`) in the JSON-RPC representation. It is a bounded profile, not general A2A
conformance, third-party SDK compatibility, public discovery or remote execution. The reference
implementation serves it for local development on a loopback address.

## Pin

Specification release **1.0.0**, wire version **1.0**, JSON-RPC representation.

- Upstream commit `173695755607e884aa9acf8ce4feed90e32727a1`.
- Normative protobuf SHA-256 `4b74c0baa923ae0acb55474e548f1d6e5d3f83b80d757b65f8bf3e99a3c2257f`.
- Sources: the [versioned specification](https://a2a-protocol.org/v1.0.0/specification/) and the
  [commit-pinned protobuf](https://raw.githubusercontent.com/a2aproject/A2A/173695755607e884aa9acf8ce4feed90e32727a1/specification/a2a.proto).
  Relevant sections: version and service parameters (3.2.6, 3.6), task cancellation (3.1.5),
  scoped authorization (7, 13), and JSON-RPC methods and errors (9).

The mapping between A2A messages and native jobs is in [`protocol/a2a.ts`](../protocol/a2a.ts),
with example payloads in [`protocol/fixtures/`](../protocol/fixtures).

## Endpoint and authority

`POST /api/runtime/a2a/:providerId` accepts `application/json`. The owner supplies the provider
UUID and an external-requester runtime credential through native provisioning. No Agent Card is
published for this endpoint, no agent directory is disclosed and no caller-supplied endpoint is
fetched.

Required headers:

```text
A2A-Version: 1.0
A2A-Extensions: urn:central-city:a2a:native-auth:1
Authorization: Bearer <native runtime credential>
X-CC-Timestamp: <13-digit Unix milliseconds>
X-CC-Nonce: <fresh 16-128 character nonce>
X-CC-Signature: <hex HMAC-SHA256>
Content-Type: application/json
```

- The extension URI is a profile identifier, not a registered interoperable authentication
  standard.
- The native credential is both the bearer credential and the HMAC key. The signed UTF-8 string
  is exactly `POST\n<pathname>\n<timestamp>\n<nonce>\n<SHA256(raw request body)>`. Query strings
  are forbidden.
- Timestamp tolerance is 60 seconds and nonces cannot be replayed. Every retry needs a fresh
  signature. The version and extension headers are fixed values and are not covered by the
  signature.
- Never send this credential to an outside A2A server.

The credential determines the owner and the requester. The provider must be a hosted
deterministic demo agent in the same workspace, and a current directional connection from the
requester to the provider is required for every operation. The credential is checked again when
the task changes, so rotating or revoking it takes effect at once. A rotated credential keeps its
requester identity and can read historical tasks only while its connection remains. The native
presence, capacity, pause and history limits apply to new tasks.

## Requests

```json
{
  "jsonrpc": "2.0",
  "id": "request-1",
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "message-1",
      "role": "ROLE_USER",
      "parts": [{ "text": "Invoice amount: 42" }]
    },
    "configuration": { "returnImmediately": true }
  }
}
```

- `SendMessage` returns `result.task`.
- `GetTask` and `CancelTask` take `params: {"id": "<task id>"}` and return the task in `result`.
  `GetTask` optionally accepts `historyLength: 0`.
- `SendMessage` optionally accepts zero history, JSON output mode and the `text/plain` media type,
  as defined in `protocol/a2a.ts`.
- Every other field and operation is rejected. Requests must carry a JSON-RPC `id`; batches and
  notifications are rejected.
- Not supported: blocking send, continuation, streaming, push notifications, task listing, file or
  URL content, arbitrary data input and error-state ingestion.

### Example client

Save as `client.mjs`. Set `CC_ORIGIN` to the server origin, and `CC_RUNTIME_TOKEN` and
`CC_PROVIDER_ID` to the provisioned requester credential and the connected hosted provider. The
requester must already have sent a native heartbeat. Run `node client.mjs SendMessage message-1`,
then `node client.mjs GetTask <task-id>` or `node client.mjs CancelTask <task-id>`. Only the
status and response body are printed, never the credential.

```js
import { createHash, createHmac, randomUUID } from 'node:crypto';
const origin = process.env.CC_ORIGIN;
const token = process.env.CC_RUNTIME_TOKEN;
const provider = process.env.CC_PROVIDER_ID;
if (!origin || !token || !provider) throw new Error('Set CC_ORIGIN, CC_RUNTIME_TOKEN and CC_PROVIDER_ID.');
const [method = 'SendMessage', identifier = randomUUID()] = process.argv.slice(2);
if (!['SendMessage', 'GetTask', 'CancelTask'].includes(method)) throw new Error('Unsupported method');
const params = method === 'SendMessage'
  ? { message: { messageId: identifier, role: 'ROLE_USER', parts: [{ text: 'Invoice amount: 42' }] },
      configuration: { returnImmediately: true } }
  : { id: identifier };
const body = JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params });
const path = `/api/runtime/a2a/${encodeURIComponent(provider)}`;
const stamp = String(Date.now()), nonce = randomUUID();
const hash = createHash('sha256').update(body).digest('hex');
const signature = createHmac('sha256', token)
  .update(`POST\n${path}\n${stamp}\n${nonce}\n${hash}`).digest('hex');
const response = await fetch(new URL(path, origin), {
  method: 'POST', body, redirect: 'error',
  headers: {
    'content-type': 'application/json', authorization: `Bearer ${token}`,
    'a2a-version': '1.0', 'a2a-extensions': 'urn:central-city:a2a:native-auth:1',
    'x-cc-timestamp': stamp, 'x-cc-nonce': nonce, 'x-cc-signature': signature,
  },
});
console.log(response.status, await response.json());
```

## Deduplication and task state

- **Deduplication.** A message is identified by requester, provider and `messageId`. Its request
  hash covers the full canonical JSON parameters and the profile identifier: property order and
  the JSON-RPC `id` do not matter, but changed text or configuration is a conflict. Retries with a
  fresh nonce return the same task, including after a server restart. The native 1,000-job cap
  applies: all retained jobs are kept as retry evidence, and new messages are refused when full.
- **Task and context ids** are opaque and deterministic. Every lookup also checks the owner,
  requester, provider and current connection: ids are not authorization. Native job ids and
  credentials never appear in responses. A completed task carries only the structured output
  artifact and its state; the owner's acceptance of a result stays separate.
- **Cancellation** succeeds only while a task is queued or running, and is recorded before the
  response. An already-terminal task returns `-32002`, including on repeat cancellation. A race
  between completion and cancellation has one outcome: either cancellation wins and no artifact
  appears, or completion wins and cancellation fails. Cancellation does not reverse effects; this
  profile admits only pure deterministic hosted work with zero external cost.

## Bounds and errors

Requests are at most 64 KiB UTF-8, input at most 12,000 characters and the projected output at
most 32 KiB. Errors never contain task data or credentials.

Success and protocol-validation errors use HTTP 200 with JSON-RPC envelopes:

| Condition | JSON-RPC code |
| --- | --- |
| Unsupported version | `-32009` |
| Extension required | `-32008` |
| Unsupported operation | `-32004` |
| Missing or inaccessible task | `-32001` |
| Cancel of a terminal task | `-32002` |
| Invalid request | `-32600` |
| Unsupported parameters | `-32602` |

Authentication, admission and parser failures keep a meaningful HTTP status inside a JSON-RPC
envelope: 401 (credential or signature), 403 (connection or provider), 409 (nonce or message
conflict), 413 (size) and 429 (throttling). They use the generic code `-32000` unless a standard
parser, request or not-found code applies. Internal failures use HTTP 500 with a generic message.
This error profile and the strict rejection of unknown fields are deliberate limitations, not
full standard conformance.

The next interoperability step is a pinned, independently maintained A2A SDK with custom
authentication support, Agent Card negotiation, broader schema and error compatibility, and TLS.
