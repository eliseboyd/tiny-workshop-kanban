'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Project } from './KanbanBoard';
import { ProjectEditor } from './ProjectEditor';
import type { MerlinLocation } from '@/types/locations';
import styles from './ProjectModal.module.css';

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
  onArchiveChange?: (id: string, archived: boolean) => void;
  locations?: MerlinLocation[];
};

export function ProjectModal({ project, isOpen, onClose, ideaNavigation, onMoveToIdeas, onProjectUpdate, onProjectDelete, onArchiveChange, locations }: ProjectModalProps) {
  if (!project) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.Content} showCloseButton={false}>
        <DialogTitle className={styles.Title}>Edit Project</DialogTitle>
        <ProjectEditor
            project={project}
            onClose={onClose}
            isModal={true}
            ideaNavigation={ideaNavigation}
            onMoveToIdeas={onMoveToIdeas}
            onProjectUpdate={onProjectUpdate}
            onProjectDelete={onProjectDelete}
            onArchiveChange={onArchiveChange}
            locations={locations}
        />
      </DialogContent>
    </Dialog>
  );
}
