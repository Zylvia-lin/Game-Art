'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { projectsApi } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      projectsApi.get(Number(projectId)).then(setProject).catch(() => {});
    }
  }, [projectId]);

  // Redirect to text2img if entering project root
  useEffect(() => {
    if (projectId && pathname === `/project/${projectId}`) {
      window.location.href = `/project/${projectId}/text2img`;
    }
  }, [projectId, pathname]);

  return (
    <div className="flex h-screen">
      <Sidebar projectId={projectId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Breadcrumb projectName={project?.name} projectId={projectId} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
