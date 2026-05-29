import React from 'react';
import type { AgentBudgetSnapshot, AudioInputState, ChatMessage, SseError } from '../../core/types';
import { StyleInjector } from './AnimationStyles';
import { McpServerStatusBar } from './McpServerStatusBar';
import type { McpServerStatus } from './McpServerStatusBar';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { PlusIcon, CloseIcon } from './Icons';
import * as styles from './styles';

export interface ChatWindowProps {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
  isLoadingHistory?: boolean;
  isThinking?: boolean;
  error: SseError | null;
  budget?: AgentBudgetSnapshot | null;
  hasOlderMessages?: boolean;
  title?: string;
  welcomeMessage?: string;
  placeholder?: string;
  mcpServers?: McpServerStatus[];
  mcpAuthButtonLabel?: string;
  onSend: (message: string) => void;
  onLoadOlderMessages?: () => void | Promise<void>;
  onClose?: () => void;
  onNewConversation?: () => void;
  onMcpAuthClick?: (serverUrl: string, serverName: string) => void;
  onMcpSignOutClick?: (serverUrl: string, serverName: string) => void;
  voice?: AudioInputState & {
    onStart: () => void;
    onStop: () => void;
    onCancel: () => void;
  };
  /** 'floating' = fixed card (default), 'inline' = fill container */
  variant?: 'floating' | 'inline';
}

export function ChatWindow({
  messages,
  streamingContent,
  isLoading,
  isLoadingHistory,
  isThinking,
  error,
  budget,
  hasOlderMessages,
  title = 'AI Assistant',
  welcomeMessage,
  placeholder,
  mcpServers,
  mcpAuthButtonLabel,
  onSend,
  onLoadOlderMessages,
  onClose,
  onNewConversation,
  onMcpAuthClick,
  onMcpSignOutClick,
  voice,
  variant = 'floating',
}: ChatWindowProps) {
  const containerStyle = variant === 'inline' ? styles.chatWindowInline : styles.chatWindow;
  const blockingError = error && error.code.startsWith('agent_config_') ? error : null;

  return (
    <div style={containerStyle}>
      <StyleInjector />

      {/* Header */}
      <div style={styles.chatHeader}>
        <h3 style={styles.chatHeaderTitle}>{title}</h3>
        <div style={styles.headerActions}>
          {onNewConversation && (
            <button
              style={styles.iconButton}
              onClick={onNewConversation}
              type="button"
              aria-label="New conversation"
              title="New conversation"
            >
              <PlusIcon size={16} color={styles.colors.textSecondary} />
            </button>
          )}
          {onClose && (
            <button
              style={styles.iconButton}
              onClick={onClose}
              type="button"
              aria-label="Close"
              title="Close"
            >
              <CloseIcon size={16} color={styles.colors.textSecondary} />
            </button>
          )}
        </div>
      </div>

      {budget && (
        <BudgetBar budget={budget} />
      )}

      {/* MCP Server Status */}
      <McpServerStatusBar
        servers={mcpServers || []}
        authButtonLabel={mcpAuthButtonLabel}
        onAuthClick={onMcpAuthClick}
        onSignOutClick={onMcpSignOutClick}
      />

      {/* Messages */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        welcomeMessage={welcomeMessage}
        isThinking={isThinking}
        blockingError={blockingError}
        hasOlderMessages={hasOlderMessages}
        isLoadingHistory={isLoadingHistory}
        onLoadOlderMessages={onLoadOlderMessages}
      />

      {/* Error banner */}
      {error && !blockingError && (
        <div style={styles.errorCard}>
          {error.message || 'Something went wrong. Please try again.'}
        </div>
      )}

      {/* Input */}
      <InputArea
        onSend={onSend}
        disabled={isLoading || Boolean(blockingError)}
        voice={voice}
        placeholder={
          blockingError
            ? 'Embedded agent unavailable'
            : placeholder
        }
      />

      {/* Powered by */}
      <div style={styles.poweredBy}>
        Powered by <a href="https://mcpstack.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>MCP Stack</a>
      </div>
    </div>
  );
}

function BudgetBar({ budget }: { budget: AgentBudgetSnapshot }) {
  const label = budget.identityType === 'anonymous' ? 'Anonymous budget' : 'My budget';
  const remaining = budget.effectiveRemainingUsd;
  const source = budgetSourceLabel(budget);
  const text = remaining == null
    ? `${label}: ${source}`
    : `${label}: ${formatUsd(remaining)} remaining`;
  const statusColor = budget.status === 'blocked'
    ? '#ef4444'
    : budget.status === 'warning'
      ? '#f59e0b'
      : styles.colors.textSecondary;

  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${styles.colors.border}`,
        background: 'rgba(255,255,255,0.02)',
        fontSize: '12px',
        color: statusColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
      {remaining != null && (
        <span style={{ color: styles.colors.textSecondary, whiteSpace: 'nowrap' }}>{source}</span>
      )}
    </div>
  );
}

function budgetSourceLabel(budget: AgentBudgetSnapshot): string {
  if (!budget.enabled) return 'Org AI credits only';
  if (budget.budgetSource === 'explicit') return 'Override';
  if (budget.budgetSource === 'default_user') return 'Monthly user allowance';
  if (budget.budgetSource === 'anonymous') return 'Anonymous pool';
  return 'Agent cap only';
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
