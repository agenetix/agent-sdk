import React, { useEffect } from 'react';

const STYLE_ID = 'agenetix-agent-styles';

const keyframes = `
@keyframes agenetix-fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes agenetix-fadeInScale {
  from { opacity: 0; transform: scale(0.95) translateY(12px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes agenetix-fadeOut {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95) translateY(12px); }
}
@keyframes agenetix-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
@keyframes agenetix-spin {
  to { transform: rotate(360deg); }
}
@keyframes agenetix-progressIndeterminate {
  0% { left: -30%; }
  100% { left: 100%; }
}
@keyframes agenetix-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes agenetix-checkmark {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
@keyframes agenetix-slideDown {
  from { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
  to { max-height: 300px; opacity: 1; }
}

.agenetix-fadeInUp {
  animation: agenetix-fadeInUp 0.25s ease-out both;
}
.agenetix-fadeInScale {
  animation: agenetix-fadeInScale 0.3s ease-out both;
}
.agenetix-fadeOut {
  animation: agenetix-fadeOut 0.2s ease-in both;
}
.agenetix-spin {
  animation: agenetix-spin 1s linear infinite;
}
.agenetix-blink {
  animation: agenetix-blink 1s step-end infinite;
}
`;

/**
 * Injects a <style> tag with all Agenetix animation keyframes into <head>.
 * Idempotent — safe to render multiple times. SSR-safe.
 */
export function StyleInjector() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = keyframes;
    document.head.appendChild(style);

    return () => {
      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
    };
  }, []);

  return null;
}
