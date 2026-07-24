'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Image,
  ImagePlus,
  Paintbrush,
  Eraser,
  User,
  Film,
  Sword,
  Layout,
  Map,
  FolderOpen,
  Settings,
  Type,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOOLBOX_ITEMS, CREATION_ITEMS } from '@/lib/types';
import { useState } from 'react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Image,
  ImagePlus,
  Paintbrush,
  Eraser,
  User,
  Film,
  Sword,
  Layout,
  Map,
  FolderOpen,
};

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const settingsItems = [
    { key: 'models', label: '模型配置', href: '/settings/models', icon: Settings },
    { key: 'prompts', label: '提示词管理', href: '/settings/prompts', icon: Type },
    { key: 'billing', label: '账单统计', href: '/settings/billing', icon: BarChart3 },
  ];

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <Gamepad2 className="h-7 w-7 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-base font-semibold text-foreground whitespace-nowrap">
              GameArtAI
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {projectId ? (
          <>
            {/* Creation Tools Section */}
            <div className={cn('mb-2 px-2', collapsed && 'hidden')}>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                创作工具
              </span>
            </div>
            {CREATION_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname.includes(item.href);
              return (
                <Link
                  key={item.key}
                  href={`/project/${projectId}${item.href}`}
                  className={cn(
                    'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}

            {/* Toolbox Section */}
            <div className={cn('mb-2 mt-4 px-2', collapsed && 'hidden')}>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                工具箱
              </span>
            </div>
            {TOOLBOX_ITEMS.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = pathname.includes(item.href);
              return (
                <Link
                  key={item.key}
                  href={`/project/${projectId}${item.href}`}
                  className={cn(
                    'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}

            {/* Assets */}
            <div className={cn('mb-2 mt-4 px-2', collapsed && 'hidden')}>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                资产
              </span>
            </div>
            <Link
              href={`/project/${projectId}/assets`}
              className={cn(
                'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                pathname.includes('/assets')
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">资产库</span>}
            </Link>
          </>
        ) : (
          <div className="space-y-1">
            <Link
              href="/"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                pathname === '/'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <FolderOpen className="h-4 w-4" />
              {!collapsed && <span>所有项目</span>}
            </Link>
          </div>
        )}

        {/* Settings */}
        <div className={cn('mt-6 border-t border-border pt-3', collapsed && 'px-0')}>
          {!collapsed && (
            <div className="mb-2 px-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                设置
              </span>
            </div>
          )}
          {settingsItems.map((item) => {
            const isActive = pathname.includes(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
