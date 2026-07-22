'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, FolderPlus } from 'lucide-react';
import { projectsApi } from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const project = await projectsApi.create({ name, description });
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </button>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-black/20">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <FolderPlus className="h-7 w-7 text-primary" />
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">新建项目</h1>
          <p className="mb-6 text-sm text-muted-foreground">创建一个新的游戏美术项目</p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">项目名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：我的RPG游戏"
                autoFocus
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">项目描述（可选）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="简要描述你的项目..."
                className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all hover:-translate-y-0.5"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />创建中...</> : '创建项目'}
          </button>
        </div>
      </div>
    </div>
  );
}
