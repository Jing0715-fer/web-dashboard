'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, FolderOpen, Server, Trash2, Play, Square,
  RotateCcw, Settings, Terminal, Sparkles, ExternalLink,
  ChevronRight, Clock, Globe, X, Loader2, Edit3, Check,
  AlertCircle, Package, MoreVertical, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ============ Types ============
interface Environment {
  id: string;
  projectId: string;
  name: string;
  cmd: string;
  port: number;
  envVars: string;
  status?: 'running' | 'stopped';
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  environments: Environment[];
}

// ============ API Helpers ============
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============ Main Page ============
export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ projects: Project[] }>('/api/projects');
      setProjects(data.projects);
    } catch (e: any) {
      toast({ title: 'Failed to load projects', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleDeleteProject = async () => {
    if (!deleteProject) return;
    try {
      await apiFetch(`/api/projects/${deleteProject.id}`, { method: 'DELETE' });
      toast({ title: 'Project deleted', description: `${deleteProject.name} has been removed` });
      setDeleteProject(null);
      if (selectedProjectId === deleteProject.id) {
        setShowDetailSheet(false);
        setSelectedProjectId(null);
      }
      refresh();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleOpenDetail = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowDetailSheet(true);
  };

  // Count stats
  const totalProjects = projects.length;
  const runningEnvs = projects.reduce(
    (acc, p) => acc + p.environments.filter(e => e.status === 'running').length, 0
  );
  const totalEnvs = projects.reduce((acc, p) => acc + p.environments.length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Web Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage your web applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Projects:</span>
            <span className="font-semibold">{totalProjects}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Environments:</span>
            <span className="font-semibold">{totalEnvs}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">Running:</span>
            <span className="font-semibold text-emerald-600">{runningEnvs}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onAddProject={() => setShowAddDialog(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => handleOpenDetail(project.id)}
                  onDelete={() => setDeleteProject(project)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Web Dashboard v2.0</span>
          <span>Auto-refresh every 8s</span>
        </div>
      </footer>

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => { setShowAddDialog(false); refresh(); }}
      />

      {/* Project Detail Sheet */}
      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={showDetailSheet}
        onOpenChange={(open) => {
          setShowDetailSheet(open);
          if (!open) setSelectedProjectId(null);
        }}
        onProjectChanged={refresh}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProject} onOpenChange={() => setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteProject?.name}</strong>? All environments will be stopped and removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ Empty State ============
function EmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Server className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">No Projects Yet</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Add your first project by providing its directory path. You can use AI to automatically detect and configure startup settings.
      </p>
      <Button onClick={onAddProject} size="lg" className="gap-2">
        <Plus className="h-5 w-5" />
        Add Your First Project
      </Button>
    </motion.div>
  );
}

// ============ Project Card ============
function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const runningCount = project.environments.filter(e => e.status === 'running').length;
  const totalCount = project.environments.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-emerald-500/30" onClick={onOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-2xl shrink-0">
                {project.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{project.path}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                  <Settings className="h-4 w-4 mr-2" /> Manage
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {project.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {totalCount > 0 ? (
                <>
                  <Badge variant={runningCount > 0 ? 'default' : 'secondary'} className={runningCount > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15' : ''}>
                    <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${runningCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                    {runningCount}/{totalCount} running
                  </Badge>
                  {project.environments.map(env => (
                    <Badge key={env.id} variant="outline" className="text-xs font-mono">
                      {env.name}:{env.port}
                    </Badge>
                  ))}
                </>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-500/20">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not configured
                </Badge>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ Add Project Dialog ============
function AddProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleAutoDetect = async () => {
    if (!path.trim()) {
      toast({ title: 'Path required', description: 'Please enter a project directory path', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      // Create project first
      const data = await apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim(), name: name.trim() || undefined }),
      });

      toast({ title: 'Project created', description: 'Starting AI analysis...' });

      // Then analyze with LLM
      setIsAnalyzing(true);
      try {
        const result = await apiFetch<{ project: Project; analysis: any }>(`/api/projects/${data.project.id}/analyze`, {
          method: 'POST',
        });
        toast({
          title: 'AI Configuration Complete',
          description: `Detected ${result.analysis?.environments?.length || 0} environments for ${result.analysis?.projectName || data.project.name}`,
          duration: 5000,
        });
      } catch (analyzeErr: any) {
        toast({
          title: 'AI Analysis Failed',
          description: analyzeErr.message + '. You can manually configure environments.',
          variant: 'destructive',
          duration: 7000,
        });
      }

      setPath('');
      setName('');
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Failed to create project', description: e.message, variant: 'destructive', duration: 5000 });
    } finally {
      setIsCreating(false);
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Add New Project
          </DialogTitle>
          <DialogDescription>
            Enter the project directory path. AI will automatically detect the framework and configure startup settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="path" className="text-sm font-medium">
              Project Directory <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                id="path"
                placeholder="/path/to/your/project"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAutoDetect()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The root directory of your web project (where package.json or similar config exists)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Project Name <span className="text-muted-foreground font-normal">(optional, auto-detected)</span>
            </Label>
            <Input
              id="name"
              placeholder="My Web App"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleAutoDetect} disabled={isCreating || !path.trim()} className="gap-2">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI Analyzing...
              </>
            ) : isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Add & Auto-Configure
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Project Detail Sheet (manages own data) ============
function ProjectDetailSheet({
  projectId,
  open,
  onOpenChange,
  onProjectChanged,
}: {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectChanged: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState<Environment | null>(null);
  const [editEnv, setEditEnv] = useState<Environment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch project data when the sheet opens or projectId changes
  const refreshProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${projectId}`);
      setProject(data.project);
    } catch (e: any) {
      toast({ title: 'Failed to load project', description: e.message, variant: 'destructive' });
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (open && projectId) {
      refreshProject();
      const interval = setInterval(refreshProject, 5000);
      return () => clearInterval(interval);
    }
  }, [open, projectId, refreshProject]);

  // When project data changes, also refresh the parent list
  const handleProjectUpdate = useCallback(async () => {
    await refreshProject();
    onProjectChanged();
  }, [refreshProject, onProjectChanged]);

  if (!project) return null;

  const handleAction = async (envId: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(`${envId}-${action}`);
    try {
      const env = project.environments.find(e => e.id === envId);
      if (!env) return;

      const result = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/projects/${project.id}/environments/${envId}/${action}`,
        { method: 'POST' }
      );

      if (result.ok === false && result.error) {
        toast({
          title: `${action} failed`,
          description: result.error,
          variant: 'destructive',
          duration: 7000,
        });
      } else {
        toast({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${env.name}`,
          description: `Command sent successfully`,
          duration: 3000,
        });
      }
      // Refresh project data but don't close the sheet
      await refreshProject();
      onProjectChanged();
    } catch (e: any) {
      toast({
        title: `${action} failed`,
        description: e.message,
        variant: 'destructive',
        duration: 7000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await apiFetch(`/api/projects/${project.id}/analyze`, { method: 'POST' });
      toast({ title: 'AI Analysis Complete', description: 'Environments have been reconfigured', duration: 5000 });
      await refreshProject();
      onProjectChanged();
    } catch (e: any) {
      toast({ title: 'AI Analysis Failed', description: e.message, variant: 'destructive', duration: 7000 });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteEnv = async (envId: string) => {
    try {
      await apiFetch(`/api/projects/${project.id}/environments/${envId}`, { method: 'DELETE' });
      toast({ title: 'Environment removed' });
      await refreshProject();
      onProjectChanged();
    } catch (e: any) {
      toast({ title: 'Failed to remove environment', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-3xl">
                {project.icon}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg">{project.name}</SheetTitle>
                <p className="text-sm text-muted-foreground font-mono truncate">{project.path}</p>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pt-2">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="environments" className="flex-1">Environments</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 overflow-auto px-6 py-4">
              <div className="space-y-6">
                {project.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Project Path</h4>
                  <code className="text-sm bg-muted px-3 py-2 rounded-md block font-mono">{project.path}</code>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Environments Summary</h4>
                  {project.environments.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-center">
                      No environments configured yet.
                      <br />Use AI to auto-configure or add manually.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {project.environments.map(env => (
                        <div key={env.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full ${env.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                            <div>
                              <span className="font-medium text-sm capitalize">{env.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">:{env.port}</span>
                            </div>
                          </div>
                          <Badge variant={env.status === 'running' ? 'default' : 'secondary'} className={env.status === 'running' ? 'bg-emerald-500/10 text-emerald-600' : ''}>
                            {env.status === 'running' ? 'Running' : 'Stopped'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAnalyze} disabled={isAnalyzing} className="gap-2 flex-1">
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isAnalyzing ? 'Analyzing...' : 'Re-Analyze with AI'}
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                  <p className="text-sm">{new Date(project.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="environments" className="flex-1 overflow-auto px-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Environments</h4>
                  <Button size="sm" onClick={() => { setEditEnv(null); setShowEnvDialog(true); }} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {project.environments.length === 0 ? (
                  <div className="text-center py-10">
                    <Terminal className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No environments configured</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing} className="gap-1">
                        {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        AI Auto-Configure
                      </Button>
                      <Button size="sm" onClick={() => { setEditEnv(null); setShowEnvDialog(true); }} className="gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        Add Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  project.environments.map(env => (
                    <EnvironmentPanel
                      key={env.id}
                      environment={env}
                      projectPath={project.path}
                      actionLoading={actionLoading}
                      onAction={(action) => handleAction(env.id, action)}
                      onEdit={() => { setEditEnv(env); setShowEnvDialog(true); }}
                      onDelete={() => handleDeleteEnv(env.id)}
                      onViewLogs={() => setShowLogViewer(env)}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Environment Config Dialog */}
      <EnvironmentConfigDialog
        project={project}
        environment={editEnv}
        open={showEnvDialog}
        onOpenChange={setShowEnvDialog}
        onSuccess={() => { setShowEnvDialog(false); handleProjectUpdate(); }}
      />

      {/* Log Viewer Dialog */}
      {showLogViewer && (
        <LogViewerDialog
          project={project}
          environment={showLogViewer}
          open={!!showLogViewer}
          onOpenChange={(open) => { if (!open) setShowLogViewer(null); }}
        />
      )}
    </>
  );
}

// ============ Environment Panel ============
function EnvironmentPanel({
  environment: env,
  projectPath,
  actionLoading,
  onAction,
  onEdit,
  onDelete,
  onViewLogs,
}: {
  environment: Environment;
  projectPath: string;
  actionLoading: string | null;
  onAction: (action: 'start' | 'stop' | 'restart') => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
}) {
  const isLoading = actionLoading === `${env.id}-start` || actionLoading === `${env.id}-stop` || actionLoading === `${env.id}-restart`;
  const isRunning = env.status === 'running';

  let envVars: Record<string, string> = {};
  try { envVars = JSON.parse(env.envVars); } catch { /* ignore */ }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Environment Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
          <div>
            <span className="font-medium text-sm capitalize">{env.name}</span>
            <span className="text-xs text-muted-foreground ml-2">Port {env.port}</span>
          </div>
          <Badge variant={isRunning ? 'default' : 'secondary'} className={isRunning ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs' : 'text-xs'}>
            {isRunning ? 'Running' : 'Stopped'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onViewLogs()} title="View Logs"
          >
            <Terminal className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={onEdit} title="Edit Configuration"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
            onClick={onDelete} title="Delete Environment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Environment Body */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Start Command</p>
          <code className="text-xs bg-muted px-2 py-1 rounded font-mono block truncate">{env.cmd}</code>
        </div>

        {Object.keys(envVars).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Environment Variables</p>
            <div className="space-y-1">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-600">{key}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-muted-foreground truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isRunning && (
          <div>
            <a
              href={`http://localhost:${env.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              Open http://localhost:{env.port}
            </a>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant={isRunning ? 'outline' : 'default'}
            onClick={() => onAction('start')}
            disabled={isLoading || isRunning}
            className={isRunning ? '' : 'bg-emerald-600 hover:bg-emerald-700 gap-1'}
          >
            {actionLoading === `${env.id}-start` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('stop')}
            disabled={isLoading || !isRunning}
            className="gap-1"
          >
            {actionLoading === `${env.id}-stop` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            Stop
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('restart')}
            disabled={isLoading || !isRunning}
            className="gap-1"
          >
            {actionLoading === `${env.id}-restart` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ Environment Config Dialog ============
function EnvironmentConfigDialog({
  project,
  environment,
  open,
  onOpenChange,
  onSuccess,
}: {
  project: Project;
  environment: Environment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = !!environment;
  const [name, setName] = useState('');
  const [cmd, setCmd] = useState('');
  const [port, setPort] = useState('');
  const [envVarsText, setEnvVarsText] = useState('{}');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (environment) {
      setName(environment.name);
      setCmd(environment.cmd);
      setPort(String(environment.port));
      setEnvVarsText(environment.envVars || '{}');
    } else {
      setName('');
      setCmd('');
      setPort('');
      setEnvVarsText('{}');
    }
  }, [environment, open]);

  const handleSave = async () => {
    if (!name.trim() || !cmd.trim() || !port.trim()) {
      toast({ title: 'Validation Error', description: 'Name, command, and port are required', variant: 'destructive' });
      return;
    }

    let envVars: Record<string, string>;
    try {
      envVars = JSON.parse(envVarsText);
    } catch {
      toast({ title: 'Invalid JSON', description: 'Environment variables must be valid JSON', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && environment) {
        await apiFetch(`/api/projects/${project.id}/environments/${environment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cmd, port: parseInt(port, 10), envVars }),
        });
        toast({ title: 'Environment updated' });
      } else {
        await apiFetch(`/api/projects/${project.id}/environments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cmd, port: parseInt(port, 10), envVars }),
        });
        toast({ title: 'Environment created' });
      }
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Environment' : 'Add Environment'}</DialogTitle>
          <DialogDescription>
            Configure how this environment starts. Each project can have multiple environments (e.g., test, production).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Environment Name</Label>
            <Select value={name} onValueChange={setName} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Select environment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Command</Label>
            <Input
              placeholder="e.g., npm run dev"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">The command to start the application</p>
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input
              type="number"
              placeholder="e.g., 3000"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Environment Variables (JSON)</Label>
            <Textarea
              placeholder='{"KEY": "value"}'
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              className="font-mono text-sm min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Log Viewer Dialog ============
function LogViewerDialog({
  project,
  environment,
  open,
  onOpenChange,
}: {
  project: Project;
  environment: Environment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiFetch<{ logs: string[] }>(
        `/api/projects/${project.id}/environments/${environment.id}/logs`
      );
      setLogs(data.logs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [project.id, environment.id]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [open, fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Logs - {environment.name}
          </DialogTitle>
          <DialogDescription>
            Real-time logs for {project.name} / {environment.name} (port {environment.port})
          </DialogDescription>
        </DialogHeader>
        <div
          ref={scrollRef}
          className="bg-zinc-950 text-zinc-100 rounded-lg p-4 font-mono text-xs max-h-[50vh] overflow-y-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-6">
              <Info className="h-6 w-6 text-zinc-500 mx-auto mb-2" />
              <p className="text-zinc-500">No logs available yet.</p>
              <p className="text-zinc-600 text-xs mt-1">
                {environment.status === 'running'
                  ? 'This process was started externally. Logs are only available for processes started from this dashboard.'
                  : 'Start the environment to see logs.'}
              </p>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`py-0.5 ${log.startsWith('[stderr]') ? 'text-red-400' : log.startsWith('[') ? 'text-zinc-500' : ''}`}>
                {log}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
