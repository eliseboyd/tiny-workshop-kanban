'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FileText, Upload, Trash2, Link2, X, Filter, FolderOpen, ExternalLink, Calendar, HardDrive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  StandalonePlan,
  uploadFile,
  createStandalonePlan,
  updateStandalonePlan,
  deleteStandalonePlan,
  getAllPlans
} from '@/app/actions';
import { useConfirm } from '@/components/ui/confirm-dialog';
import styles from './PlansView.module.css';

type Project = {
  id: string;
  title: string;
};

type PlansViewProps = {
  initialPlans: Array<StandalonePlan & { source: 'standalone' | 'project' }>;
  projects: Project[];
  onPlanClick?: (plan: StandalonePlan & { source: 'standalone' | 'project' }) => void;
};

export function PlansView({ initialPlans, projects, onPlanClick }: PlansViewProps) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [plans, setPlans] = useState(initialPlans);
  const [isLoading, setIsLoading] = useState(true);

  // Load plans on mount and sync with initialPlans changes
  useEffect(() => {
    const loadPlans = async () => {
      setIsLoading(true);
      try {
        const freshPlans = await getAllPlans();
        setPlans(freshPlans);
      } catch (error) {
        console.error('Failed to load plans:', error);
        // Fall back to initialPlans if fetch fails
        if (initialPlans.length > 0) {
          setPlans(initialPlans);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadPlans();
  }, []);

  // Also sync when initialPlans changes (from parent refresh)
  useEffect(() => {
    if (initialPlans.length > 0) {
      setPlans(initialPlans);
    }
  }, [initialPlans]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [assigningPlan, setAssigningPlan] = useState<string | null>(null);

  // Filter plans
  const filteredPlans = plans.filter(plan => {
    if (filterMode === 'unassigned') return !plan.projectId;
    if (filterMode === 'assigned') return !!plan.projectId;
    return true;
  });

  // Refresh plans data
  const refreshPlans = async () => {
    const freshPlans = await getAllPlans();
    setPlans(freshPlans);
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Accept images and PDFs
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          const fd = new FormData();
          fd.append('file', file);
          const result = await uploadFile(fd);
          
          await createStandalonePlan({
            url: result.url,
            name: result.name,
            type: result.type,
            size: result.size,
          });
        }
      }
      await refreshPlans();
    } catch (error) {
      console.error('Failed to upload plans:', error);
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Handle file input
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append('file', file);
        const result = await uploadFile(fd);
        
        await createStandalonePlan({
          url: result.url,
          name: result.name,
          type: result.type,
          size: result.size,
        });
      }
      await refreshPlans();
    } catch (error) {
      console.error('Failed to upload plans:', error);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle assigning plan to project
  const handleAssignProject = async (planId: string, projectId: string | null) => {
    try {
      await updateStandalonePlan(planId, { projectId });
      await refreshPlans();
      setAssigningPlan(null);
    } catch (error) {
      console.error('Failed to assign plan:', error);
    }
  };

  // Handle deleting a standalone plan
  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: 'Delete plan?',
      description: 'This plan will be permanently removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    
    try {
      await deleteStandalonePlan(planId);
      await refreshPlans();
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div 
      className={cn(
        styles.Root,
        isDragging && styles.RootDragging
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={styles.Header}>
        <div className={styles.HeaderStart}>
          <h2 className={styles.Heading}>Plans & Sketches</h2>
          {isLoading ? (
            <Loader2 className={styles.Spinner} />
          ) : (
            <Badge variant="secondary" className={styles.CountBadge}>
              {filteredPlans.length} {filteredPlans.length === 1 ? 'item' : 'items'}
            </Badge>
          )}
        </div>
        
        <div className={styles.HeaderActions}>
          {/* Filter */}
          <Select value={filterMode} onValueChange={(v: 'all' | 'unassigned' | 'assigned') => setFilterMode(v)}>
            <SelectTrigger className={styles.FilterTrigger}>
              <Filter className={styles.FilterIcon} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>

          {/* Upload button */}
          <input
            type="file"
            id="plans-upload-input"
            className={styles.FileInput}
            multiple
            accept="image/*,.pdf"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            onClick={() => document.getElementById('plans-upload-input')?.click()}
            disabled={isUploading}
          >
            <Upload className={styles.UploadIcon} />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Drop zone hint */}
      {isDragging && (
        <div className={styles.DropOverlay}>
          <div className={styles.DropPanel}>
            <Upload className={styles.DropIcon} />
            <p className={styles.DropTitle}>Drop files to upload</p>
            <p className={styles.DropHint}>Images and PDFs supported</p>
          </div>
        </div>
      )}

      {/* Plans grid */}
      {filteredPlans.length === 0 ? (
        <div 
          className={styles.Empty}
          onClick={() => document.getElementById('plans-upload-input')?.click()}
        >
          <FolderOpen className={styles.EmptyIcon} />
          <p className={styles.EmptyTitle}>
            {filterMode === 'unassigned' 
              ? 'No unassigned plans'
              : filterMode === 'assigned'
                ? 'No assigned plans'
                : 'No plans yet'
            }
          </p>
          <p className={styles.EmptyHint}>
            Drop files here or click to upload
          </p>
        </div>
      ) : (
        <div className={styles.Grid}>
          {filteredPlans.map(plan => (
            <div
              key={`${plan.source}-${plan.id}`}
              className={cn(
                styles.Card,
                selectedPlan === plan.id && styles.CardSelected,
                !plan.projectId && plan.source === 'standalone' && styles.CardUnassigned
              )}
              onClick={() => {
                if (onPlanClick) {
                  onPlanClick(plan);
                } else {
                  window.open(plan.url, '_blank');
                }
              }}
            >
              {/* Thumbnail */}
              <div className={styles.Thumb}>
                {plan.type.startsWith('image/') ? (
                  <Image
                    src={plan.url}
                    alt={plan.name}
                    fill
                    className={styles.ThumbImage}
                    unoptimized
                  />
                ) : plan.type === 'application/pdf' ? (
                  <div className={styles.PdfFrame}>
                    {/* PDF thumbnail using embed - shows first page */}
                    <embed
                      src={`${plan.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      type="application/pdf"
                      className={styles.PdfEmbed}
                      style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                    />
                    {/* Overlay to prevent interaction and show PDF badge */}
                    <div className={styles.PdfBadgeWrap}>
                      <span className={styles.PdfBadge}>
                        PDF
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.FileFallback}>
                    <FileText className={styles.FileIcon} />
                    <span className={styles.FileType}>
                      {plan.type.split('/')[1] || 'FILE'}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className={styles.Overlay}>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className={styles.IconButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(plan.url, '_blank');
                    }}
                  >
                    <ExternalLink className={styles.Icon} />
                  </Button>
                  {plan.source === 'standalone' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className={styles.IconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssigningPlan(plan.id);
                        }}
                        title="Assign to project"
                      >
                        <Link2 className={styles.Icon} />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className={styles.IconButton}
                        onClick={(e) => handleDeletePlan(plan.id, e)}
                      >
                        <Trash2 className={styles.Icon} />
                      </Button>
                    </>
                  )}
                </div>

                {/* Source badge */}
                {plan.source === 'project' && (
                  <div className={styles.SourceBadgeWrap}>
                    <Badge variant="secondary" className={styles.SourceBadge}>
                      From Project
                    </Badge>
                  </div>
                )}

                {/* Unassigned indicator */}
                {!plan.projectId && plan.source === 'standalone' && (
                  <div className={styles.UnassignedBadgeWrap}>
                    <Badge variant="outline" className={styles.UnassignedBadge}>
                      Unassigned
                    </Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className={styles.Info}>
                <p className={styles.Name} title={plan.name}>
                  {plan.name}
                </p>
                <div className={styles.Meta}>
                  <span className={styles.MetaItem}>
                    <HardDrive className={styles.MetaIcon} />
                    {formatSize(plan.size)}
                  </span>
                  {plan.createdAt && (
                    <span className={styles.MetaItem}>
                      <Calendar className={styles.MetaIcon} />
                      {formatDate(plan.createdAt)}
                    </span>
                  )}
                </div>
                {plan.projectTitle && (
                  <p className={styles.ProjectLink}>
                    <Link2 className={styles.MetaIcon} />
                    {plan.projectTitle}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Add more card */}
          <div
            className={styles.AddCard}
            onClick={() => document.getElementById('plans-upload-input')?.click()}
          >
            <Upload className={styles.AddIcon} />
            <span className={styles.AddLabel}>Add more</span>
          </div>
        </div>
      )}

      {/* Assign to project modal */}
      {assigningPlan && (
        <div 
          className={styles.AssignBackdrop}
          onClick={() => setAssigningPlan(null)}
        >
          <div 
            className={styles.AssignPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.AssignHeader}>
              <h3 className={styles.AssignTitle}>Assign to Project</h3>
              <Button variant="ghost" size="sm" className={styles.IconButton} onClick={() => setAssigningPlan(null)}>
                <X className={styles.Icon} />
              </Button>
            </div>
            
            <div className={styles.AssignList}>
              <button
                className={cn(styles.AssignOption, styles.AssignOptionUnassign)}
                onClick={() => handleAssignProject(assigningPlan, null)}
              >
                <X className={styles.MutedIcon} />
                <span className={styles.Muted}>Unassign</span>
              </button>
              {projects.map(project => (
                <button
                  key={project.id}
                  className={styles.AssignOption}
                  onClick={() => handleAssignProject(assigningPlan, project.id)}
                >
                  {project.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

