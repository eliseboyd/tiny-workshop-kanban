'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Project } from './KanbanBoard';
import { ProjectEditor } from './ProjectEditor';

type ProjectModalProps = {
  project?: Project | null;
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: string;
  existingTags?: string[];
};

export function ProjectModal({ project, isOpen, onClose, initialStatus, existingTags = [] }: ProjectModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] h-[85vh] overflow-hidden flex flex-col p-0 gap-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{project ? 'Edit Project' : 'New Project'}</DialogTitle>
        <ProjectEditor
            project={project}
            initialStatus={initialStatus}
            existingTags={existingTags}
            onClose={onClose}
            isModal={true}
        />
      </DialogContent>
    </Dialog>
  );
}
