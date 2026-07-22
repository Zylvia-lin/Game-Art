'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  useEffect(() => {
    // 进入项目后默认跳转到角色生成页面
    router.replace(`/project/${projectId}/character`);
  }, [projectId, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-500 text-sm">正在进入项目...</div>
    </div>
  );
}
