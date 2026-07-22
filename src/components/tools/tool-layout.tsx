'use client';

import { ReactNode } from 'react';
import { PromptEditor } from './prompt-editor';

interface ToolLayoutProps {
  title: string;
  description: string;
  toolKey: string;
  toolName: string;
  params: ReactNode;
  canvas: ReactNode;
  history?: ReactNode;
}

export function ToolLayout({ title, description, toolKey, toolName, params, canvas, history }: ToolLayoutProps) {
  return (
    <div className="flex h-full">
      {/* Left: Parameters */}
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-border p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-4">{params}</div>
        <div className="mt-4">
          <PromptEditor toolKey={toolKey} toolName={toolName} />
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-y-auto p-4">{canvas}</div>

      {/* Right: History */}
      {history && (
        <div className="w-[280px] shrink-0 overflow-y-auto border-l border-border p-4">
          {history}
        </div>
      )}
    </div>
  );
}
