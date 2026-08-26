import { getProject } from '@/app/actions';
import { ProjectEditor } from '@/components/kanban/ProjectEditor';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage(props: PageProps) {
  const params = await props.params;
  const project = await getProject(params.id);

  if (!project) {
    notFound();
  }

  // Map snake_case to camelCase to match Project type
  const mappedProject = {
      ...project,
      richContent: project.rich_content,
      imageUrl: project.image_url,
      materialsList: project.materials_list,
      plans: project.plans,
      inspiration: project.inspiration,
  };

  return (
    <div className="h-screen w-full bg-background">
      <ProjectEditor project={mappedProject} />
    </div>
  );
}

