'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FolderOpen, Trash2, MoreHorizontal, Gamepad2, Settings, Type, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/sidebar';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchProjects = async () => {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch {
      // API not available yet, use empty list
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const project = await projectsApi.create({ name: newName, description: newDesc || undefined });
      setProjects([project, ...projects]);
      setShowNewDialog(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此项目吗？所有相关资产将被清除。')) return;
    try {
      await projectsApi.delete(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('删除项目失败：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">GameArtAI</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/models"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
              模型配置
            </Link>
            <Link
              href="/settings/prompts"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              <Type className="h-3.5 w-3.5" />
              提示词管理
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl">
            {/* Page title */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">我的项目</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  创建项目以开始生成游戏美术资产
                </p>
              </div>
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                新建项目
              </button>
            </div>

            {/* New project dialog */}
            {showNewDialog && (
              <div className="mb-6 rounded-xl border border-border bg-card p-6 shadow-xl">
                <h3 className="mb-4 text-lg font-semibold text-foreground">新建项目</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      项目名称
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="例如：我的RPG游戏"
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      项目描述（可选）
                    </label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="描述你的游戏项目..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNewDialog(false)}
                      className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      创建
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Project grid */}
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-card border border-border" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="mb-4 rounded-full bg-accent p-6">
                  <FolderOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">还没有项目</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  创建你的第一个项目，开始生成游戏美术资产
                </p>
                <button
                  onClick={() => setShowNewDialog(true)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  创建项目
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={() => handleDelete(project.id)}
                    onRename={(newName) => setProjects(prev => prev.map(p => p.id === project.id ? { ...p, name: newName } : p))}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete, onRename }: { project: Project; onDelete: () => void; onRename: (newName: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStartRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    setEditName(project.name);
    setEditing(true);
  };

  const handleCancelRename = () => {
    setEditing(false);
    setEditName('');
  };

  const handleSaveRename = async () => {
    const name = editName.trim();
    if (!name || name === project.name) {
      handleCancelRename();
      return;
    }
    setSaving(true);
    try {
      await projectsApi.update(project.id, { name });
      onRename(name);
      setEditing(false);
      setEditName('');
      toast.success('重命名成功');
    } catch (err) {
      console.error('Failed to rename project:', err);
      toast.error('重命名失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group relative rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200">
      <Link href={`/project/${project.id}`} className="block">
        <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-accent/50">
          <Gamepad2 className="h-10 w-10 text-muted-foreground/50" />
        </div>
        {editing ? (
          <div className="mb-1 flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              disabled={saving}
              className="min-w-0 flex-1 rounded-md border border-primary bg-input px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="项目名称"
            />
            <button
              onClick={handleSaveRename}
              disabled={saving}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancelRename}
              disabled={saving}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <h3 className="mb-1 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {project.name}
          </h3>
        )}
        {project.description && (
          <p className="mb-2 text-sm text-muted-foreground line-clamp-2">{project.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {new Date(project.updated_at).toLocaleDateString('zh-CN')}
        </p>
      </Link>

      {/* Actions */}
      <div className="absolute right-3 top-3">
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowMenu(!showMenu);
          }}
          className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-border bg-card p-1 shadow-xl">
            <button
              onClick={handleStartRename}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              重命名
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowMenu(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除项目
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
