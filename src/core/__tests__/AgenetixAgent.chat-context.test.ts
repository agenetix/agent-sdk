import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenetixAgent } from '../AgenetixAgent';

const AGENT_ID = 'agent_test';
const CONFIG_URL = `https://api.agenetix.com/api/v1/agents/${AGENT_ID}/config`;
const AG_UI_URL = `https://api.agenetix.com/api/v1/agents/${AGENT_ID}/ag-ui`;

function agentConfigResponse(): Response {
  return Response.json({
    agentId: AGENT_ID,
    name: 'Chat Agent',
    mcpServers: [],
    widgetConfig: null,
  });
}

function agUiResponse(...events: Array<Record<string, unknown>>): Response {
  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

function finishedRun(conversationId = 'conv_test', toolCalls = 0): Response {
  return agUiResponse(
    { type: 'RUN_STARTED', threadId: conversationId, runId: 'run_test' },
    { type: 'STATE_SNAPSHOT', snapshot: { conversationId } },
    {
      type: 'RUN_FINISHED',
      threadId: conversationId,
      runId: 'run_test',
      result: { conversationId, inputTokens: 1, outputTokens: 1, toolCalls },
    },
  );
}

function frontendToolRun(toolName: string, args: Record<string, unknown> = {}): Response {
  return agUiResponse(
    { type: 'RUN_STARTED', threadId: 'conv_test', runId: 'run_test' },
    { type: 'STATE_SNAPSHOT', snapshot: { conversationId: 'conv_test' } },
    {
      type: 'TOOL_CALL_START',
      toolCallId: 'tool_1',
      toolCallName: toolName,
      agenetix: { source: 'client', label: toolName },
    },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'tool_1', delta: JSON.stringify(args) },
    { type: 'TOOL_CALL_END', toolCallId: 'tool_1' },
    {
      type: 'RUN_FINISHED',
      threadId: 'conv_test',
      runId: 'run_test',
      result: {
        conversationId: 'conv_test',
        status: 'awaiting_frontend_tool',
        toolCallId: 'tool_1',
        toolCallName: toolName,
      },
    },
  );
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

describe('AgenetixAgent AG-UI chat context', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('derives forwarded externalUser from embedded host identity', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        const body = parseBody(init);
        expect(body.forwardedProps).toEqual({
          agenetix: {
            externalUserId: 'host-user-123',
            externalUser: {
              id: 'host-user-123',
              email: 'sarah@example.com',
              displayName: 'Sarah Kim',
              avatarUrl: 'https://cdn.example.com/sarah.png',
              organizationId: 'org_acme',
            },
          },
        });

        return finishedRun();
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      embeddedAuth: {
        mismatchPolicy: 'block_with_switch',
        hostIdentity: {
          subject: 'host-user-123',
          email: 'sarah@example.com',
          displayName: 'Sarah Kim',
          avatarUrl: 'https://cdn.example.com/sarah.png',
          organizationId: 'org_acme',
        },
      },
    });

    await agent.init();
    await agent.sendMessage('hello');
  });

  it('prefers explicit externalUserId over host identity subject', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        const body = parseBody(init);
        expect(body.forwardedProps).toMatchObject({
          agenetix: {
            externalUserId: 'customer-user-789',
            externalUser: {
              id: 'customer-user-789',
              email: 'owner@example.com',
            },
          },
        });

        return finishedRun();
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      externalUserId: 'customer-user-789',
      embeddedAuth: {
        mismatchPolicy: 'block_with_switch',
        hostIdentity: {
          subject: 'host-user-123',
          email: 'owner@example.com',
        },
      },
    });

    await agent.init();
    await agent.sendMessage('hello');
  });

  it('sends host context again on frontend tool continuations', async () => {
    const refreshChecklistWorkspace = vi.fn(async () => ({ success: true }));
    let agUiCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        agUiCalls += 1;
        const body = parseBody(init);
        expect(body.forwardedProps).toMatchObject({
          agenetix: {
            context: {
              hostRefreshInstruction: 'refresh after mutation',
            },
          },
        });

        if (agUiCalls === 1) {
          return frontendToolRun('refreshChecklistWorkspace');
        }

        const messages = body.messages as Array<Record<string, unknown>>;
        const toolMessage = messages[messages.length - 1];
        expect(toolMessage).toMatchObject({
          role: 'tool',
          toolCallId: 'tool_1',
          content: JSON.stringify({ success: true }),
        });
        return finishedRun('conv_test');
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      context: {
        hostRefreshInstruction: 'refresh after mutation',
      },
      frontendTools: {
        refreshChecklistWorkspace: {
          description: 'Refresh the current workspace.',
          parameters: {},
          execute: refreshChecklistWorkspace,
        },
      },
    });

    await agent.init();
    await agent.sendMessage('refresh');

    expect(refreshChecklistWorkspace).toHaveBeenCalledTimes(1);
    expect(agUiCalls).toBe(2);
  });

  it('uses updated context on subsequent AG-UI turns', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        const body = parseBody(init);
        expect(body.forwardedProps).toMatchObject({
          agenetix: {
            context: {
              hostRefreshInstruction: 'refresh from updated context',
            },
          },
        });

        return finishedRun();
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      context: {
        hostRefreshInstruction: 'refresh from original context',
      },
    });

    await agent.init();
    agent.setAppContext({
      hostRefreshInstruction: 'refresh from updated context',
    });
    await agent.sendMessage('hello');
  });

  it('uses updated frontend tools without recreating the agent', async () => {
    const originalTool = vi.fn(async () => ({ success: true, active: { id: 'old' } }));
    const updatedTool = vi.fn(async () => ({ success: true, active: { id: 'new' } }));
    let agUiCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        agUiCalls += 1;
        const body = parseBody(init);

        if (agUiCalls === 1) {
          expect(body.tools).toMatchObject([
            {
              name: 'getActiveChecklistContext',
              description: 'Get the current checklist context.',
            },
          ]);
          return frontendToolRun('getActiveChecklistContext');
        }

        const messages = body.messages as Array<Record<string, unknown>>;
        const toolMessage = messages[messages.length - 1];
        expect(toolMessage).toMatchObject({
          toolCallId: 'tool_1',
          content: JSON.stringify({ success: true, active: { id: 'new' } }),
        });
        return finishedRun('conv_test', 1);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      frontendTools: {
        getActiveChecklistContext: {
          description: 'Get the current checklist context.',
          parameters: {},
          execute: originalTool,
        },
      },
    });

    await agent.init();
    agent.setFrontendTools({
      getActiveChecklistContext: {
        description: 'Get the current checklist context.',
        parameters: {},
        execute: updatedTool,
      },
    });
    await agent.sendMessage('hello');

    expect(originalTool).not.toHaveBeenCalled();
    expect(updatedTool).toHaveBeenCalledTimes(1);
  });

  it('serializes frontendTools as AG-UI frontend tools with selection metadata', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === CONFIG_URL) {
        return agentConfigResponse();
      }

      if (url.includes('/budget')) {
        return Response.json({});
      }

      if (url === AG_UI_URL) {
        const body = parseBody(init);
        expect(body.tools).toEqual([
          {
            name: 'highlightItems',
            description: 'Highlight checklist items.',
            parameters: {
              type: 'object',
              properties: {
                ids: {
                  type: 'array',
                  description: 'Checklist item ids.',
                  items: { type: 'string' },
                },
                groups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      itemIds: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                    required: ['itemIds'],
                  },
                },
              },
              required: ['ids'],
            },
            metadata: {
              agenetix: {
                selection: {
                  categories: ['ui_feedback'],
                  includeWhen: ['highlight'],
                  risk: 'low',
                },
              },
              'x-agenetix-selection': {
                categories: ['ui_feedback'],
                includeWhen: ['highlight'],
                risk: 'low',
              },
            },
          },
        ]);

        return finishedRun();
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const agent = new AgenetixAgent({
      apiKey: 'agenetix-test-key',
      agentId: AGENT_ID,
      frontendTools: {
        highlightItems: {
          description: 'Highlight checklist items.',
          parameters: {
            ids: {
              type: 'array',
              description: 'Checklist item ids.',
              required: true,
            },
            groups: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemIds: {
                    type: 'array',
                    required: true,
                  },
                },
              },
            },
          },
          selection: {
            categories: ['ui_feedback'],
            includeWhen: ['highlight'],
            risk: 'low',
          },
          execute: vi.fn(),
        },
      },
    });

    await agent.init();
    await agent.sendMessage('highlight');
  });
});
