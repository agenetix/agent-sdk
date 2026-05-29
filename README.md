# @emcy/agent-sdk

Use Emcy agents in your app.

This package now has one public model for custom product integrations: `App Agent`.

## Install

```bash
npm install @emcy/agent-sdk
```

## Package surfaces

### `@emcy/agent-sdk`

Low-level runtime:

- `EmcyAgent`
- core auth helpers
- core transport and types

### `@emcy/agent-sdk/app`

Framework-agnostic agent experience helpers:

- `createAppAgent`
- `AppAgentController`
- message / tool derivation helpers
- resume / pending-turn / formatting helpers

### `@emcy/agent-sdk/react`

React app integration:

- `useAppAgent`
- `AppAgentProvider`
- `useAppAgentContext`

### `@emcy/agent-sdk/react-native`

React Native app integration:

- `useAppAgent`
- `AppAgentProvider`
- `useAppAgentContext`

### `@emcy/agent-sdk/react-embed`

Drop-in web widget:

- `EmcyChat`

## Start here

### 1. Drop-in web embed

```tsx
import { EmcyChat } from "@emcy/agent-sdk/react-embed";

export function App() {
  const appSessionKey = [session.organizationId, session.user.id, session.id].join(":");

  return (
    <div style={{ height: 640 }}>
      <EmcyChat
        apiKey="emcy_pk_xxxx"
        agentId="ag_xxxxx"
        appSessionKey={appSessionKey}
        userIdentity={{
          subject: session.user.id,
          email: session.user.email,
          organizationId: session.organizationId,
        }}
        auth={{
          mode: "app-token",
          getToken: () => session.getAccessToken(),
        }}
        mode="inline"
        title="Support Agent"
      />
    </div>
  );
}
```

### 2. Custom React app UI

```tsx
import { useAppAgent } from "@emcy/agent-sdk/react";

export function CustomAssistant() {
  const agent = useAppAgent({
    apiKey: "emcy_pk_xxxx",
    agentId: "ag_xxxxx",
    appSessionKey: [session.organizationId, session.user.id, session.id].join(":"),
    userIdentity: {
      subject: session.user.id,
      email: session.user.email,
      organizationId: session.organizationId,
    },
    auth: {
      mode: "app-token",
      getToken: () => session.getAccessToken(),
    },
    clientTools,
    appContext,
  });

  return null;
}
```

### 3. Custom React Native UI

```tsx
import { useAppAgent } from "@emcy/agent-sdk/react-native";

export function AssistantShell() {
  const agent = useAppAgent({
    apiKey: "emcy_pk_xxxx",
    agentId: "ag_xxxxx",
    appSessionKey: [session.organizationId, session.user.id, session.id].join(":"),
    userIdentity: {
      subject: session.user.id,
      email: session.user.email,
      organizationId: session.organizationId,
    },
    auth: {
      mode: "app-token",
      getToken: () => session.getAccessToken(),
    },
    clientTools,
    appContext,
    platform,
  });

  const toolMessages = agent.conversation.toolMessages;
  return null;
}
```

### 4. Raw runtime

```ts
import { EmcyAgent } from "@emcy/agent-sdk";

const agent = new EmcyAgent({
  apiKey: "emcy_pk_xxxx",
  agentId: "ag_xxxxx",
  appSessionKey: [session.organizationId, session.user.id, session.id].join(":"),
  userIdentity: {
    subject: session.user.id,
    email: session.user.email,
    organizationId: session.organizationId,
  },
  auth: {
    mode: "app-token",
    getToken: () => session.getAccessToken(),
  },
});

await agent.init();
await agent.sendMessage("Hello");
```

### Microphone turn detection

Microphone end-of-speech detection is owned by the SDK for both embedded and
headless integrations. By default, the SDK listens for real speech, adapts to
the local noise floor, then commits the utterance after a short trailing pause.
Apps can tune the behavior without implementing their own VAD:

```ts
const agent = new EmcyAgent({
  apiKey: "emcy_pk_xxxx",
  agentId: "ag_xxxxx",
  audioInput: {
    turnDetection: {
      silenceDurationMs: 850,
      minSpeechDurationMs: 180,
      noSpeechTimeoutMs: 12000,
      autoSubmit: true,
    },
  },
});
```

## Core app-agent config

### `apiKey`

Your agent public key (`emcy_pk_*`). Public keys are designed for browser and native app code. Keep service-account keys (`emcy_sk_*`) on your backend.

### `agentId`

The agent to run.

### `appSessionKey`

Your host app’s current signed-in session boundary.

Pass this so persisted MCP auth and resumed conversations do not leak across logout/login cycles.

### `userIdentity`

The signed-in host user:

```ts
userIdentity: {
  subject: session.user.id,
  email: session.user.email,
  organizationId: session.organizationId,
}
```

### `auth`

For embedded products where the user already signed in, let your app keep auth
ownership and give the SDK a token getter:

```ts
auth: {
  mode: "app-token",
  getToken: () => session.getAccessToken(),
}
```

`getToken` should return the current app token each time it is called. If your
auth library refreshes tokens, read from that current session source rather than
capturing a token from the first render.

The SDK exchanges that app token at Gateway for an MCP-facing token without
OAuth client registration. External MCP clients can still use the same
Gateway-backed server through standard OAuth discovery, registration, and
authorization.

Runtime API calls keep the agent public key in the `Authorization` header and
forward your app token separately as `X-Emcy-App-Token`. This lets MCP Stack
validate the embed key, the allowed browser origin, and the signed-in app user
without treating the public key as a secret.

### `clientTools`

App-owned functions the agent can call locally for UI work or host orchestration.

### `appContext`

Extra host context or policy instructions for the agent.

## OAuth

If an external MCP client needs user-scoped OAuth:

- pass `userIdentity`
- let Emcy manage the popup flow by default
- override with `onAuthRequired` only when you need custom host auth UX

For embedded apps, prefer `auth.mode = "app-token"` instead of a popup flow.

## Localhost defaults

When `serviceUrl` points to localhost, popup helper URLs default to:

- `http://localhost:3100/oauth/callback`
- `http://localhost:3100/.well-known/oauth-client-metadata.json`

## In one sentence

Use `react-embed` for the fastest hosted widget, and use `react` or `react-native` when the assistant is part of your product.

## License

MIT
