'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Project } from './KanbanBoard';
import { ProjectEditor } from './ProjectEditor';

type IdeaNavigation = {
  current: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
};

type ProjectModalProps = {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  ideaNavigation?: IdeaNavigation;
  onMoveToIdeas?: () => void;
  onProjectUpdate?: (id: string, updates: Partial<Project>) => void;
  onProjectDelete?: (id: string) => void;
};

export function ProjectModal({ project, isOpen, onClose, ideaNavigation, onMoveToIdeas, onProjectUpdate, onProjectDelete }: ProjectModalProps) {
  if (!project) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] h-[85vh] overflow-hidden flex flex-col p-0 gap-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Edit Project</DialogTitle>
        <ProjectEditor
            project={project}
            onClose={onClose}
            isModal={true}
            ideaNavigation={ideaNavigation}
            onMoveToIdeas={onMoveToIdeas}
            onProjectUpdate={onProjectUpdate}
            onProjectDelete={onProjectDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
