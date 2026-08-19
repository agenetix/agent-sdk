# @agenetix/agent-sdk

Use Agenetix agents in your app.

AgentSDK is Agenetix's first-party AG-UI client. Your app talks AG-UI to the agent; Agenetix keeps server tools on MCP through Gateway, AuthGateway, budgets, logs, and permissions.

This package has one public model for custom product integrations: `App Agent`.

## Install

```bash
npm install @agenetix/agent-sdk
```

## Package surfaces

### `@agenetix/agent-sdk`

Low-level runtime:

- `EmcyAgent`
- core auth helpers
- core transport and types

### `@agenetix/agent-sdk/app`

Framework-agnostic agent experience helpers:

- `createAppAgent`
- `AppAgentController`
- message / tool derivation helpers
- resume / pending-turn / formatting helpers

### `@agenetix/agent-sdk/react`

React app integration:

- `useAppAgent`
- `AppAgentProvider`
- `useAppAgentContext`

### `@agenetix/agent-sdk/react-native`

React Native app integration:

- `useAppAgent`
- `AppAgentProvider`
- `useAppAgentContext`

### `@agenetix/agent-sdk/react-embed`

Drop-in web widget:

- `EmcyChat`

## Start here

### 1. Drop-in web embed

```tsx
import { EmcyChat } from "@agenetix/agent-sdk/react-embed";

export function App() {
  return (
    <div style={{ height: 640 }}>
      <EmcyChat
        apiKey="agenetix_pk_xxxx"
        agentId="ag_xxxxx"
        appSessionKey={session.id}
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
import { useAppAgent } from "@agenetix/agent-sdk/react";

export function CustomAssistant() {
  const agent = useAppAgent({
    apiKey: "agenetix_pk_xxxx",
    agentId: "ag_xxxxx",
    appSessionKey: session.id,
    userIdentity: {
      subject: session.user.id,
      email: session.user.email,
      organizationId: session.organizationId,
    },
    auth: {
      mode: "app-token",
      getToken: () => session.getAccessToken(),
    },
    frontendTools,
    appContext,
  });

  return null;
}
```

### 3. Custom React Native UI

```tsx
import { useAppAgent } from "@agenetix/agent-sdk/react-native";

export function AssistantShell() {
  const agent = useAppAgent({
    apiKey: "agenetix_pk_xxxx",
    agentId: "ag_xxxxx",
    appSessionKey: session.id,
    userIdentity: {
      subject: session.user.id,
      email: session.user.email,
      organizationId: session.organizationId,
    },
    frontendTools,
    appContext,
    platform,
  });

  const toolMessages = agent.conversation.toolMessages;
  return null;
}
```

### 4. Raw runtime

```ts
import { EmcyAgent } from "@agenetix/agent-sdk";

const agent = new EmcyAgent({
  apiKey: "agenetix_pk_xxxx",
  agentId: "ag_xxxxx",
  authSessionKey: session.id,
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
  apiKey: "agenetix_pk_xxxx",
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

Your Agenetix public agent key, usually an `agenetix_pk_*` embed key scoped to the agent and allowed browser origins.

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

The SDK forwards that app token with the AG-UI run. When the agent needs a server MCP tool, Agenetix exchanges the app token at Gateway for an MCP-facing token without OAuth client registration. External MCP clients can still use the same Gateway-backed server through standard OAuth discovery, registration, and authorization.

### `frontendTools`

App-owned functions the agent can call locally for UI work or host orchestration.

AgentSDK sends these as AG-UI frontend tool schemas. They run in your app and should stay focused on route changes, current-screen reads, drafting, filtering, approvals, and other local UI work. Use server MCP tools for authoritative backend reads and writes.

### `appContext`

Extra host context or policy instructions for the agent.

## Protocol boundary

AgentSDK uses AG-UI for agent turns:

```text
AgentSDK / custom AG-UI frontend
        -> AG-UI
Agenetix Agent
        -> MCP
Agenetix Server
        -> Gateway / AuthGateway
        -> SaaS API
```

That means:

- assistant text and tool progress stream as AG-UI events
- `frontendTools` are AG-UI frontend tools
- server MCP tools execute server-side through Gateway/AuthGateway
- budgets, logs, and permissions still apply to server-side work

## OAuth

If an external MCP client needs user-scoped OAuth:

- pass `userIdentity`
- let Agenetix manage the popup flow by default
- override with `onAuthRequired` only when you need custom host auth UX

For embedded apps, prefer `auth.mode = "app-token"` instead of a popup flow.

## Localhost defaults

When `serviceUrl` points to localhost, popup helper URLs default to:

- `http://localhost:3100/oauth/callback`
- `http://localhost:3100/.well-known/oauth-client-metadata.json`

## In one sentence

Use `react-embed` for the fastest hosted widget, and use `react` or `react-native` when the assistant is part of your product.

## Publishing

`publish-npm.yml` is the only npm publish entry point. Merging to `main` does not publish `latest`.

- **Pull request against `main`** — publishes a preview dist-tag, for example `@agenetix/agent-sdk@pr-12`. The workflow comments with the exact package ref.
- **`v*` tag** (for example `v2.0.3`) — publishes `latest`. Bump `package.json` first; npm will not overwrite an already-published version.

To try a preview in a platform PR, add the ref to `infra/preview-packages.json`:

```json
{
  "@agenetix/agent-sdk": "@agenetix/agent-sdk@pr-12"
}
```

## License

MIT
