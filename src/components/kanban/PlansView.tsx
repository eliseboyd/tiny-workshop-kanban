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
    if (!confirm('Are you sure you want to delete this plan?')) return;
    
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
        "flex-1 p-6 transition-all",
        isDragging && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Plans & Sketches</h2>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="secondary" className="text-xs">
              {filteredPlans.length} {filteredPlans.length === 1 ? 'item' : 'items'}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Filter */}
          <Select value={filterMode} onValueChange={(v: 'all' | 'unassigned' | 'assigned') => setFilterMode(v)}>
            <SelectTrigger className="w-[160px] h-9">
              <Filter className="h-3.5 w-3.5 mr-2" />
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
            className="hidden"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            onClick={() => document.getElementById('plans-upload-input')?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Drop zone hint */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="bg-primary/10 border-2 border-dashed border-primary rounded-xl p-12 text-center">
            <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-lg font-medium text-primary">Drop files to upload</p>
            <p className="text-sm text-muted-foreground mt-1">Images and PDFs supported</p>
          </div>
        </div>
      )}

      {/* Plans grid */}
      {filteredPlans.length === 0 ? (
        <div 
          className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => document.getElementById('plans-upload-input')?.click()}
        >
          <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {filterMode === 'unassigned' 
              ? 'No unassigned plans'
              : filterMode === 'assigned'
                ? 'No assigned plans'
                : 'No plans yet'
            }
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Drop files here or click to upload
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredPlans.map(plan => (
            <div
              key={`${plan.source}-${plan.id}`}
              className={cn(
                "group relative border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-all cursor-pointer",
                selectedPlan === plan.id && "ring-2 ring-primary",
                !plan.projectId && plan.source === 'standalone' && "border-amber-500/30"
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
              <div className="aspect-[4/3] relative bg-muted/20 overflow-hidden">
                {plan.type.startsWith('image/') ? (
                  <Image
                    src={plan.url}
                    alt={plan.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : plan.type === 'application/pdf' ? (
                  <div className="w-full h-full relative">
                    {/* PDF thumbnail using embed - shows first page */}
                    <embed
                      src={`${plan.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      type="application/pdf"
                      className="w-full h-full pointer-events-none"
                      style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                    />
                    {/* Overlay to prevent interaction and show PDF badge */}
                    <div className="absolute bottom-1 right-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded">
                        PDF
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-50" />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1">
                      {plan.type.split('/')[1] || 'FILE'}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(plan.url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {plan.source === 'standalone' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssigningPlan(plan.id);
                        }}
                        title="Assign to project"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 w-8 p-0"
                        onClick={(e) => handleDeletePlan(plan.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Source badge */}
                {plan.source === 'project' && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-background/80 backdrop-blur-sm">
                      From Project
                    </Badge>
                  </div>
                )}

                {/* Unassigned indicator */}
                {!plan.projectId && plan.source === 'standalone' && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400">
                      Unassigned
                    </Badge>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium truncate" title={plan.name}>
                  {plan.name}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <HardDrive className="h-2.5 w-2.5" />
                    {formatSize(plan.size)}
                  </span>
                  {plan.createdAt && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatDate(plan.createdAt)}
                    </span>
                  )}
                </div>
                {plan.projectTitle && (
                  <p className="text-[10px] text-primary mt-1 truncate flex items-center gap-1">
                    <Link2 className="h-2.5 w-2.5" />
                    {plan.projectTitle}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Add more card */}
          <div
            className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/10 cursor-pointer transition-colors min-h-[180px]"
            onClick={() => document.getElementById('plans-upload-input')?.click()}
          >
            <Upload className="h-8 w-8 opacity-50 mb-2" />
            <span className="text-xs">Add more</span>
          </div>
        </div>
      )}

      {/* Assign to project modal */}
      {assigningPlan && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setAssigningPlan(null)}
        >
          <div 
            className="bg-background rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Assign to Project</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setAssigningPlan(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-auto">
              <button
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm flex items-center gap-2"
                onClick={() => handleAssignProject(assigningPlan, null)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Unassign</span>
              </button>
              {projects.map(project => (
                <button
                  key={project.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
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

