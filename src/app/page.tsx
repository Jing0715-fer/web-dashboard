'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, FolderOpen, Server, Trash2, Play, Square,
  RotateCcw, Settings, Terminal, Sparkles, ExternalLink,
  ChevronRight, Clock, Globe, X, Loader2, Edit3, Check,
  AlertCircle, Package, MoreVertical, Info, Zap, Activity
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

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

// ============ Inline Port Editor ============
function InlinePortEditor({
  projectId,
  envId,
  port,
  onSaved,
}: {
  projectId: string;
  envId: string;
  port: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(port));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    const newPort = parseInt(value, 10);
    if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
      toast({ title: 'Invalid port', description: 'Port must be between 1 and 65535', variant: 'destructive' });
      setValue(String(port));
      setEditing(false);
      return;
    }
    if (newPort === port) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/environments/${envId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: newPort }),
      });
      toast({ title: 'Port updated', description: `Port changed to ${newPort}`, duration: 2000 });
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast({ title: 'Failed to update port', description: e.message, variant: 'destructive' });
      setValue(String(port));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [value, port, projectId, envId, onSaved, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setValue(String(port));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-6 w-20 text-xs font-mono px-1.5 py-0 border-emerald-500/40 focus-visible:ring-emerald-500/30"
          min={1}
          max={65535}
          disabled={saving}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="text-xs text-muted-foreground font-mono shrink-0 hover:text-foreground hover:bg-muted/80 rounded px-1 py-0.5 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setValue(String(port));
            }}
          >
            :{port}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <p>Click to edit port</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============ Main Page ============
export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [cardActionLoading, setCardActionLoading] = useState<string | null>(null);
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

  const handleOpenDetailToEnv = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowDetailSheet(true);
  };

  const handleCardAction = async (projectId: string, envId: string, action: 'start' | 'stop') => {
    setCardActionLoading(envId);
    try {
      const result = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/projects/${projectId}/environments/${envId}/${action}`,
        { method: 'POST' }
      );
      if (result.ok === false && result.error) {
        toast({ title: `${action} failed`, description: result.error, variant: 'destructive', duration: 5000 });
      } else {
        toast({ title: `${action === 'start' ? 'Started' : 'Stopped'}`, duration: 2000 });
      }
      refresh();
    } catch (e: any) {
      toast({ title: `${action} failed`, description: e.message, variant: 'destructive', duration: 5000 });
    } finally {
      setCardActionLoading(null);
    }
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
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Web Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage your web applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          </div>
        </div>
        {/* Gradient underline */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      </header>

      {/* Stats Bar - Card style */}
      <div className="border-b bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 bg-background/80 rounded-xl px-4 py-2.5 border border-border/40 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-none">Projects</p>
                <p className="text-lg font-bold leading-tight">{totalProjects}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background/80 rounded-xl px-4 py-2.5 border border-border/40 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-none">Environments</p>
                <p className="text-lg font-bold leading-tight">{totalEnvs}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background/80 rounded-xl px-4 py-2.5 border border-border/40 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Activity className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-none">Running</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-bold leading-tight text-emerald-600">{runningEnvs}</p>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => handleOpenDetail(project.id)}
                  onOpenToEnv={() => handleOpenDetailToEnv(project.id)}
                  onDelete={() => setDeleteProject(project)}
                  onAction={(envId, action) => handleCardAction(project.id, envId, action)}
                  onPortChange={refresh}
                  actionLoading={cardActionLoading}
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
          <span className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Auto-refresh every 8s
          </span>
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
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
        <Server className="h-10 w-10 text-emerald-500/60" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">No Projects Yet</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Add your first project by providing its directory path. You can use AI to automatically detect and configure startup settings.
      </p>
      <Button onClick={onAddProject} size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20">
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
  onOpenToEnv,
  onDelete,
  onAction,
  onPortChange,
  actionLoading,
}: {
  project: Project;
  onOpen: () => void;
  onOpenToEnv: () => void;
  onDelete: () => void;
  onAction: (envId: string, action: 'start' | 'stop') => void;
  onPortChange: () => void;
  actionLoading: string | null;
}) {
  const runningCount = project.environments.filter(e => e.status === 'running').length;
  const totalCount = project.environments.length;
  const allRunning = totalCount > 0 && runningCount === totalCount;
  const hasRunning = runningCount > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:-translate-y-0.5 relative overflow-hidden ${
          hasRunning ? 'hover:border-emerald-500/30' : 'hover:border-border'
        }`}
        onClick={onOpen}
      >
        {/* Left accent border */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors duration-300 ${
          hasRunning ? 'bg-gradient-to-b from-emerald-500 to-teal-500' : 'bg-muted-foreground/20'
        }`} />

        <CardHeader className="pb-3 pl-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm ${
                hasRunning
                  ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20'
                  : 'bg-gradient-to-br from-muted to-muted/50'
              }`}>
                {project.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{project.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Quick Start/Stop All button */}
              {totalCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${allRunning ? 'text-red-500 hover:text-red-600 hover:bg-red-500/10' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    project.environments.forEach(env => {
                      if (allRunning && env.status === 'running') {
                        onAction(env.id, 'stop');
                      } else if (!allRunning && env.status !== 'running') {
                        onAction(env.id, 'start');
                      }
                    });
                  }}
                  disabled={!!actionLoading}
                  title={allRunning ? 'Stop All' : runningCount > 0 ? 'Start Remaining' : 'Start All'}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : allRunning ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              )}
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
          </div>
        </CardHeader>
        <CardContent className="pt-0 pl-5">
          {project.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
          )}
          {totalCount > 0 ? (
            <div className="space-y-2">
              {/* Quick toggle per environment */}
              <div className="flex flex-col gap-1">
                {project.environments.map(env => {
                  const isLoading = actionLoading === env.id;
                  return (
                    <div
                      key={env.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${env.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-sm font-medium capitalize truncate">{env.name}</span>
                        <InlinePortEditor
                          projectId={project.id}
                          envId={env.id}
                          port={env.port}
                          onSaved={onPortChange}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {env.status === 'running' && (
                          <a
                            href={`http://localhost:${env.port}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in browser"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 text-xs gap-1 ${env.status === 'running' ? 'text-red-500 hover:text-red-600 hover:bg-red-500/10' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAction(env.id, env.status === 'running' ? 'stop' : 'start');
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : env.status === 'running' ? (
                            <>
                              <Square className="h-3 w-3" />
                              <span className="hidden sm:inline">Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" />
                              <span className="hidden sm:inline">Start</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Summary badge */}
              <div className="flex items-center gap-2 pt-1">
                <Badge variant={runningCount > 0 ? 'default' : 'secondary'} className={runningCount > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                  <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${runningCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                  {runningCount}/{totalCount} running
                </Badge>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-amber-600 border-amber-500/20">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not configured
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenToEnv();
                  }}
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Add Env</span>
                </Button>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
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
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = !!environment;
  const [name, setName] = useState('');
  const [cmd, setCmd] = useState('');
  const [port, setPort] = useState('3000');
  const [envVars, setEnvVars] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (environment) {
      setName(environment.name);
      setCmd(environment.cmd);
      setPort(String(environment.port));
      setEnvVars(environment.envVars || '{}');
    } else {
      setName('');
      setCmd('');
      setPort('3000');
      setEnvVars('{}');
    }
  }, [environment, open]);

  const handleSave = async () => {
    if (!name.trim() || !cmd.trim() || !port.trim()) {
      toast({ title: 'Validation Error', description: 'Name, command, and port are required', variant: 'destructive' });
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast({ title: 'Invalid Port', description: 'Port must be between 1 and 65535', variant: 'destructive' });
      return;
    }

    // Validate env vars JSON
    let parsedEnvVars = '{}';
    try {
      parsedEnvVars = JSON.stringify(JSON.parse(envVars));
    } catch {
      toast({ title: 'Invalid JSON', description: 'Environment variables must be valid JSON', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/api/projects/${project.id}/environments/${environment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), cmd: cmd.trim(), port: portNum, envVars: parsedEnvVars }),
        });
        toast({ title: 'Environment updated' });
      } else {
        await apiFetch(`/api/projects/${project.id}/environments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), cmd: cmd.trim(), port: portNum, envVars: parsedEnvVars }),
        });
        toast({ title: 'Environment added' });
      }
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Failed to save environment', description: e.message, variant: 'destructive' });
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
            Configure the startup command and settings for this environment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="env-name" className="text-sm font-medium">Name</Label>
            <Input
              id="env-name"
              placeholder="development"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-cmd" className="text-sm font-medium">Start Command</Label>
            <Input
              id="env-cmd"
              placeholder="npm run dev"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The command to start this environment (run from the project directory)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-port" className="text-sm font-medium">Port</Label>
            <Input
              id="env-port"
              type="number"
              placeholder="3000"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min={1}
              max={65535}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-vars" className="text-sm font-medium">
              Environment Variables <span className="text-muted-foreground font-normal">(JSON)</span>
            </Label>
            <Textarea
              id="env-vars"
              placeholder='{"NODE_ENV": "development"}'
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              className="font-mono text-xs min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Add Environment'}
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
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiFetch<{ logs: string[] }>(`/api/projects/${project.id}/environments/${environment.id}/logs`);
      setLogs(data.logs || []);
    } catch (e: any) {
      toast({ title: 'Failed to load logs', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [project.id, environment.id, toast]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [open, fetchLogs]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            Logs - {environment.name}
          </DialogTitle>
          <DialogDescription>
            Real-time logs for {project.name} / {environment.name}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-[400px] max-h-[60vh] bg-zinc-950 rounded-lg p-4 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-zinc-500 text-center py-10">No logs available</p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all hover:bg-zinc-800/50 rounded px-1">
                {line}
              </div>
            ))
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${environment.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            {environment.status === 'running' ? 'Running' : 'Stopped'}
            <span className="ml-2">{logs.length} lines</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
