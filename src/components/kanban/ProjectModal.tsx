'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Project } from './KanbanBoard';
import { ProjectEditor } from './ProjectEditor';

type ProjectModalProps = {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
};

export function ProjectModal({ project, isOpen, onClose }: ProjectModalProps) {
  if (!project) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] h-[85vh] overflow-hidden flex flex-col p-0 gap-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Edit Project</DialogTitle>
        <ProjectEditor
            project={project}
            onClose={onClose}
            isModal={true}
        />
      </DialogContent>
    </Dialog>
  );
}
