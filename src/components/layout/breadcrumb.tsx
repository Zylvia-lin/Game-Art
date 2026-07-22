'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { TOOL_NAV_ITEMS } from '@/lib/types';

interface BreadcrumbProps {
  projectName?: string;
  projectId?: string;
}

export function Breadcrumb({ projectName, projectId }: BreadcrumbProps) {
  const pathname = usePathname();

  const getCurrentTool = () => {
    if (!projectId) return null;
    const toolPath = pathname.split(`/project/${projectId}`)[1];
    if (!toolPath || toolPath === '/') return null;
    return TOOL_NAV_ITEMS.find((item) => toolPath.startsWith(item.href));
  };

  const currentTool = getCurrentTool();

  const segments = [
    { label: '首页', href: '/' },
  ];

  if (projectId && projectName) {
    segments.push({ label: projectName, href: `/project/${projectId}` });
  }

  if (currentTool) {
    segments.push({ label: currentTool.label, href: '#' });
  }

  if (pathname.includes('/settings/models')) {
    segments.push({ label: '模型配置', href: '#' });
  }
  if (pathname.includes('/settings/prompts')) {
    segments.push({ label: '提示词管理', href: '#' });
  }
  if (pathname === '/project/new') {
    segments.push({ label: '新建项目', href: '#' });
  }

  return (
    <nav className="flex h-14 items-center gap-1 border-b border-border bg-sidebar/50 px-6">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {i === 0 ? (
            <Home className="h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
          {seg.href === '#' ? (
            <span className="text-sm text-foreground font-medium">{seg.label}</span>
          ) : (
            <Link
              href={seg.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {seg.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
