'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, FolderOpen, Server, Trash2, Play, Square,
  RotateCcw, Settings, Terminal, Sparkles, ExternalLink,
  ChevronRight, Globe, X, Loader2, Edit3, Check,
  AlertCircle, Package, MoreVertical, Info, Zap, Activity,
  Code, Database, Smartphone, ShoppingCart, Layout, Palette,
  Cpu, BookOpen, Music, Gamepad2, BarChart3, Shield, Camera,
  Map, Cloud, Rocket, Puzzle, Folder, Flame, Laptop, Atom,
  Search, Wifi, WifiOff, Eye, EyeOff, TestTube, Copy,
  HeartPulse, Timer, Filter, Pencil, ArrowUpDown, LayoutGrid, List,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
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
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';


// ============ Icon Registry ============
const ICON_MAP: Record<string, LucideIcon> = {
  'folder': Folder,
  'globe': Globe,
  'code': Code,
  'database': Database,
  'smartphone': Smartphone,
  'shopping-cart': ShoppingCart,
  'layout': Layout,
  'palette': Palette,
  'cpu': Cpu,
  'book-open': BookOpen,
  'music': Music,
  'gamepad-2': Gamepad2,
  'bar-chart': BarChart3,
  'shield': Shield,
  'camera': Camera,
  'map': Map,
  'cloud': Cloud,
  'terminal': Terminal,
  'rocket': Rocket,
  'puzzle': Puzzle,
  'package': Package,
  'zap': Zap,
  'laptop': Laptop,
  'atom': Atom,
  'flame': Flame,
  'server': Server,
};

function ProjectIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = ICON_MAP[icon] || ICON_MAP['folder'];
  return <IconComponent className={className} />;
}

function IconSelector({ icon, onIconChange }: { icon: string; onIconChange: (icon: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.keys(ICON_MAP).map(iconKey => (
        <button
          key={iconKey}
          type="button"
          onClick={() => onIconChange(iconKey)}
          className={`h-8 w-8 rounded-md border flex items-center justify-center transition-all ${
            icon === iconKey
              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
              : 'border-border/50 hover:border-muted-foreground/30 hover:bg-muted/50'
          }`}
          title={iconKey}
          aria-label={`Select ${iconKey} icon`}
          aria-pressed={icon === iconKey}
        >
          <ProjectIcon icon={iconKey} className={`h-4 w-4 ${icon === iconKey ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
        </button>
      ))}
    </div>
  );
}

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

interface LlmConfigState {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  claudeCodeAuto?: boolean;
}

interface NetworkInfo {
  lanIPs: Array<{ address: string; interface: string; family: string }>;
  primaryIP: string;
  hostname: string;
}

interface ServiceHealth {
  projectId: string;
  projectName: string;
  envId: string;
  envName: string;
  port: number;
  status: 'running' | 'stopped';
  httpStatus: number | null;
  responseTime: number | null;
  gatewayAccessible: boolean;
}

interface AgentGateway {
  name: string;
  displayName: string;
  description: string;
  port: number;
  status: 'running' | 'stopped';
  pid: number | null;
  uptime: number;
  memoryMB: number;
  version: string;
  httpStatus: number | null;
  responseTime: number | null;
  icon: string;
}

interface GatewayStatusData {
  caddyRunning: boolean;
  caddyVersion: string;
  gatewayPort: number;
  gatewayListening: boolean;
  configValid: boolean;
  uptime: number;
  systemUptime: number;
  memoryUsage: { total: number; used: number; free: number; percentage: number };
  cpuUsage: number;
  services: ServiceHealth[];
  agentGateways: AgentGateway[];
  lastChecked: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatEnvName(name: string, abbreviated = false): string {
  if (name === 'production') return abbreviated ? 'Prod' : 'Production';
  if (name === 'development') return abbreviated ? 'Dev' : 'Development';
  if (name === 'staging') return abbreviated ? 'Stg' : 'Staging';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============ API Helpers ============
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============ Copyable URL ============
function CopyableUrl({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'URL copied', description: url, duration: 2000 });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`transition-colors ${copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={handleCopy}
          aria-label={label || 'Copy URL'}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <p>{label || 'Copy URL'}: <code className="font-mono text-xs">{url}</code></p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============ Copyable Text ============
function CopyableText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <button
      className={`shrink-0 transition-colors ${copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'} ${className || ''}`}
      onClick={handleCopy}
      title={`Copy: ${text}`}
      aria-label={`Copy: ${text}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="text-xs text-muted-foreground font-mono shrink-0 hover:text-foreground hover:bg-muted/80 rounded px-1 py-0.5 transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
            setValue(String(port));
          }}
          aria-label="Edit port"
        >
          :{port}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <p>Click to edit port</p>
      </TooltipContent>
    </Tooltip>
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
  const [cardActionLoading, setCardActionLoading] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [detailInitialTab, setDetailInitialTab] = useState('overview');
  const [showLlmSettings, setShowLlmSettings] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfigState | null>(null);
  const [lanIP, setLanIP] = useState('');
  const [showGatewayMonitor, setShowGatewayMonitor] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusData | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await apiFetch<{ projects: Project[] }>('/api/projects');
      setProjects(data.projects);
      setLastRefreshed(new Date());
    } catch (e: any) {
      toast({ title: 'Failed to load projects', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  const fetchLlmConfig = useCallback(async () => {
    try {
      const data = await apiFetch<{ config: LlmConfigState }>('/api/llm-config');
      setLlmConfig(data.config);
    } catch {
      // ignore
    }
  }, []);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const data = await apiFetch<NetworkInfo>('/api/network-info');
      setLanIP(data.primaryIP || '');
    } catch {
      // ignore
    }
  }, []);

  const fetchGatewayStatus = useCallback(async () => {
    try {
      const data = await apiFetch<GatewayStatusData>('/api/gateway/status');
      setGatewayStatus(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    fetchLlmConfig();
    fetchNetworkInfo();
    fetchGatewayStatus();
    let intervalId: ReturnType<typeof setInterval>;
    let gatewayIntervalId: ReturnType<typeof setInterval>;
    const startIntervals = () => {
      intervalId = setInterval(refresh, 8000);
      gatewayIntervalId = setInterval(fetchGatewayStatus, 15000);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        fetchGatewayStatus();
        startIntervals();
      } else {
        clearInterval(intervalId);
        clearInterval(gatewayIntervalId);
      }
    };
    startIntervals();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalId);
      clearInterval(gatewayIntervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh, fetchLlmConfig, fetchNetworkInfo, fetchGatewayStatus]);

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
    setDetailInitialTab('overview');
    setShowDetailSheet(true);
  };

  const handleOpenDetailToEnv = (projectId: string) => {
    setSelectedProjectId(projectId);
    setDetailInitialTab('environments');
    setShowDetailSheet(true);
  };

  const handleCardAction = async (projectId: string, envId: string, action: 'start' | 'stop') => {
    setCardActionLoading(prev => new Set(prev).add(envId));
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
      setCardActionLoading(prev => { const next = new Set(prev); next.delete(envId); return next; });
    }
  };

  // Count stats
  const totalProjects = projects.length;
  const runningEnvs = projects.reduce(
    (acc, p) => acc + p.environments.filter(e => e.status === 'running').length, 0
  );
  const totalEnvs = projects.reduce((acc, p) => acc + p.environments.length, 0);

  const isLlmReady = llmConfig?.provider === 'zai' || llmConfig?.provider === 'claude-code' || llmConfig?.hasApiKey;

  // Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (statusFilter === 'running') {
      result = result.filter(p => p.environments.some(e => e.status === 'running'));
    } else if (statusFilter === 'stopped') {
      result = result.filter(p => !p.environments.some(e => e.status === 'running'));
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') {
        const aRunning = a.environments.some(e => e.status === 'running') ? 0 : 1;
        const bRunning = b.environments.some(e => e.status === 'running') ? 0 : 1;
        if (aRunning !== bRunning) return aRunning - bRunning;
        return a.name.localeCompare(b.name);
      }
      // date - newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return result;
  }, [projects, searchQuery, statusFilter, sortBy]);

  return (
    <TooltipProvider delayDuration={300}>
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 dark:shadow-emerald-500/10">
              <Server className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Web Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage your web applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGatewayMonitor(true)}
                  className={gatewayStatus?.caddyRunning && gatewayStatus?.gatewayListening ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' : 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'}
                  aria-label="Gateway monitor"
                >
                  <HeartPulse className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{gatewayStatus?.caddyRunning ? 'Gateway Running - Click to monitor' : 'Gateway Status - Click to check'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLlmSettings(true)}
                  className={isLlmReady ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' : 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'}
                  aria-label="LLM configuration"
                >
                  {isLlmReady ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isLlmReady ? 'LLM Connected - Click to configure' : 'LLM Not Configured - Click to set up'}</p>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={refresh} title="Refresh" aria-label="Refresh projects" disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-600 dark:hover:to-teal-600 shadow-md shadow-emerald-500/20">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Project</span>
            </Button>
          </div>
        </div>
        {/* Gradient underline */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/40 dark:via-emerald-400/30 to-transparent" />
      </header>

      {/* Stats Bar - Card style */}
      <div className="border-b bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="flex items-center gap-2.5 bg-background/80 rounded-lg px-3 py-2 border border-border/40 shadow-sm">
              <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-none">Projects</p>
                <p className="text-base font-bold leading-tight">{totalProjects}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-background/80 rounded-lg px-3 py-2 border border-border/40 shadow-sm">
              <div className="h-7 w-7 rounded-md bg-teal-500/10 flex items-center justify-center shrink-0">
                <Globe className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-none">Environments</p>
                <p className="text-base font-bold leading-tight">{totalEnvs}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-background/80 rounded-lg px-3 py-2 border border-border/40 shadow-sm">
              <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-none">Running</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-base font-bold leading-tight text-emerald-600 dark:text-emerald-400">{runningEnvs}</p>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowGatewayMonitor(true)}
              className="flex items-center gap-2.5 bg-background/80 rounded-lg px-3 py-2 border border-border/40 shadow-sm hover:border-emerald-500/30 transition-colors cursor-pointer text-left"
              aria-label="Gateway status - click to monitor"
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${gatewayStatus?.caddyRunning ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <HeartPulse className={`h-3.5 w-3.5 ${gatewayStatus?.caddyRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-none">Gateway</p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-base font-bold leading-tight ${gatewayStatus?.caddyRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {gatewayStatus?.caddyRunning ? 'Online' : gatewayStatus ? 'Offline' : '...'}
                  </p>
                  {gatewayStatus?.caddyRunning && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {gatewayStatus?.agentGateways && gatewayStatus.agentGateways.filter(a => a.status === 'running').length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {gatewayStatus.agentGateways.filter(a => a.status === 'running').length} agents
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="py-2 gap-0.5">
                <CardHeader className="pb-1 pl-3.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-3.5 pr-3 pb-1.5">
                  <div className="space-y-1">
                    <div className="h-3 w-full bg-muted rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onAddProject={() => setShowAddDialog(true)} />
        ) : (
          <>
            {/* Search / Filter Bar */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              <div className="relative flex-1 max-w-sm w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search projects... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-9"
                />
                {searchQuery && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Status Filter Tabs */}
                <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5" role="tablist" aria-label="Filter projects by status">
                  {[
                    { key: 'all', label: 'All', count: projects.length },
                    { key: 'running', label: 'Running', count: runningEnvs > 0 ? projects.filter(p => p.environments.some(e => e.status === 'running')).length : 0 },
                    { key: 'stopped', label: 'Stopped', count: projects.filter(p => !p.environments.some(e => e.status === 'running')).length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key as 'all' | 'running' | 'stopped')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${statusFilter === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      role="tab"
                      aria-selected={statusFilter === key}
                    >
                      {label}
                      {count > 0 && <span className="ml-1 text-[10px] opacity-70">{count}</span>}
                    </button>
                  ))}
                </div>
                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="hidden sm:inline">{sortBy === 'name' ? 'Name' : sortBy === 'status' ? 'Status' : 'Newest'}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy('date')} className={sortBy === 'date' ? 'bg-muted' : ''}>
                      Newest first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'bg-muted' : ''}>
                      Name (A-Z)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('status')} className={sortBy === 'status' ? 'bg-muted' : ''}>
                      Status (running first)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(searchQuery || statusFilter !== 'all') && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredProjects.length} of {projects.length}
                  </span>
                )}
              </div>
            </div>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-2'}>
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    lanIP={lanIP}
                    viewMode={viewMode}
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
            {(searchQuery || statusFilter !== 'all') && filteredProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Filter className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground mb-2">No projects match your filter.</p>
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-1">
          <span>Web Dashboard v2.2</span>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            {gatewayStatus?.agentGateways && gatewayStatus.agentGateways.filter(a => a.status === 'running').length > 0 && (
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                {gatewayStatus.agentGateways.filter(a => a.status === 'running').length} agents online
              </span>
            )}
            {lanIP && (
              <span className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                LAN: <code className="font-mono text-emerald-600 dark:text-emerald-400">{lanIP}</code>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : 'Loading...'}
            </span>
          </div>
        </div>
      </footer>

      {/* Add Project Dialog */}
      <AddProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => { setShowAddDialog(false); refresh(); }}
        llmReady={isLlmReady}
        llmProvider={llmConfig?.provider || 'zai'}
      />

      {/* LLM Settings Dialog */}
      <LlmSettingsDialog
        open={showLlmSettings}
        onOpenChange={setShowLlmSettings}
        onConfigChanged={fetchLlmConfig}
      />

      {/* Gateway Monitor Dialog */}
      <GatewayMonitorDialog
        open={showGatewayMonitor}
        onOpenChange={setShowGatewayMonitor}
        gatewayStatus={gatewayStatus}
        onRefresh={fetchGatewayStatus}
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
        llmReady={isLlmReady}
        lanIP={lanIP}
        initialTab={detailInitialTab}
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
    </TooltipProvider>
  );
}

// ============ LLM Settings Dialog ============
function LlmSettingsDialog({
  open,
  onOpenChange,
  onConfigChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigChanged: () => void;
}) {
  const [provider, setProvider] = useState('zai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [claudeCodeAuto, setClaudeCodeAuto] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState<{ found: boolean; source: string; details: string[]; hasApiKey: boolean; apiKey: string; baseUrl: string; model: string } | null>(null);
  const [customModelName, setCustomModelName] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setConfigLoading(true);
      // Fetch current config
      apiFetch<{ config: LlmConfigState }>('/api/llm-config')
        .then(data => {
          setProvider(data.config.provider);
          setApiKey(data.config.apiKey); // masked
          setBaseUrl(data.config.baseUrl);
          setModel(data.config.model);
          setClaudeCodeAuto(data.config.claudeCodeAuto || false);
          setCustomModelName('');
          setTestResult(null);
          setDetectedInfo(null);
        })
        .catch(() => {})
        .finally(() => setConfigLoading(false));
    }
  }, [open]);

  // Auto-detect Claude Code config when provider changes to claude-code
  const handleDetectClaudeCode = useCallback(async () => {
    setDetecting(true);
    try {
      const data = await apiFetch<{ config: { found: boolean; source: string; details: string[]; hasApiKey: boolean; apiKey: string; baseUrl: string; model: string } }>('/api/llm-config/detect-claude-code');
      setDetectedInfo(data.config);
      if (data.config.found) {
        // Auto-fill detected values (API key is masked from server)
        setApiKey(data.config.apiKey);
        setBaseUrl(data.config.baseUrl);
        setModel(data.config.model);
        setClaudeCodeAuto(true);
      }
    } catch (_e: any) {
      setDetectedInfo({ found: false, source: '', details: [], hasApiKey: false, apiKey: '', baseUrl: '', model: '' });
    } finally {
      setDetecting(false);
    }
  }, [toast]);

  useEffect(() => {
    if (provider === 'claude-code' && open) {
      handleDetectClaudeCode();
    }
  }, [provider, open, handleDetectClaudeCode]);

  const handleImportFromClaudeCode = async () => {
    setDetecting(true);
    try {
      const data = await apiFetch<{ config: { found: boolean; source: string; details: string[]; hasApiKey: boolean; apiKey: string; baseUrl: string; model: string } }>('/api/llm-config/detect-claude-code');
      setDetectedInfo(data.config);
      if (data.config.found) {
        setProvider('anthropic');
        setApiKey(data.config.apiKey);
        setBaseUrl(data.config.baseUrl);
        setModel(data.config.model);
        setClaudeCodeAuto(false);
        toast({ title: 'Configuration imported from Claude Code', duration: 2000 });
      } else {
        toast({ title: 'No Claude Code configuration found', description: 'Set ANTHROPIC_API_KEY or configure Claude Code CLI first.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Detection failed', description: e.message, variant: 'destructive' });
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalModel = model === '__custom__' ? customModelName : model;
      await apiFetch('/api/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl, model: finalModel, claudeCodeAuto }),
      });
      toast({ title: 'LLM settings saved', duration: 2000 });
      onConfigChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to save settings', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so test uses latest config
      const finalModel = model === '__custom__' ? customModelName : model;
      await apiFetch('/api/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl, model: finalModel, claudeCodeAuto }),
      });
      onConfigChanged();

      const result = await apiFetch<{ success: boolean; provider: string; message: string }>('/api/llm-config', {
        method: 'POST',
      });
      setTestResult({ success: result.success, message: result.message });
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  const isCustomProvider = provider !== 'zai' && provider !== 'claude-code';

  // Smart defaults per provider
  const getApiPlaceholder = () => {
    if (provider === 'anthropic' || provider === 'claude-code') return 'sk-ant-api03-...';
    if (provider === 'openai') return 'sk-...';
    return 'sk-...';
  };

  const getBaseUrlPlaceholder = () => {
    if (provider === 'anthropic' || provider === 'claude-code') return 'https://api.anthropic.com';
    if (provider === 'openai') return 'https://api.openai.com';
    return 'https://your-api.example.com';
  };

  const getModelPlaceholder = () => {
    if (provider === 'anthropic' || provider === 'claude-code') return 'claude-sonnet-4-20250514';
    if (provider === 'openai') return 'gpt-4o-mini';
    return 'model-name';
  };

  const getModelHint = () => {
    if (provider === 'anthropic' || provider === 'claude-code') return 'Examples: claude-sonnet-4-20250514, claude-3-5-sonnet-20241022, claude-3-haiku-20240307';
    if (provider === 'openai') return 'Examples: gpt-4o-mini, gpt-4o, gpt-4-turbo';
    return 'The model to use for chat completions. Examples: deepseek-chat, qwen-turbo, glm-4';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            LLM Configuration
          </DialogTitle>
          <DialogDescription>
            Configure the AI model used for project analysis and auto-configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Provider</Label>
            {configLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : (
            <Select value={provider} onValueChange={(val) => { setProvider(val); setApiKey(''); setBaseUrl(''); setModel(''); setCustomModelName(''); setTestResult(null); setDetectedInfo(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zai">
                  <span className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Built-in AI (Default)
                  </span>
                </SelectItem>
                <SelectItem value="claude-code">
                  <span className="flex items-center gap-2">
                    <Atom className="h-3.5 w-3.5" />
                    Claude Code (Auto-detect)
                  </span>
                </SelectItem>
                <SelectItem value="anthropic">
                  <span className="flex items-center gap-2">
                    <Atom className="h-3.5 w-3.5" />
                    Anthropic (Claude)
                  </span>
                </SelectItem>
                <SelectItem value="openai">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    OpenAI
                  </span>
                </SelectItem>
                <SelectItem value="custom">
                  <span className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5" />
                    Custom OpenAI-Compatible
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            )}
            {provider === 'zai' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wifi className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                Built-in AI service, no configuration needed. Works out of the box.
              </p>
            )}
            {provider === 'claude-code' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Atom className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                Auto-detect API key, base URL and model from Claude Code CLI config. No manual setup needed.
              </p>
            )}
            {provider === 'anthropic' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Atom className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                Use Claude models via the Anthropic Messages API. Requires an API key from console.anthropic.com.
              </p>
            )}
          </div>

          {/* Claude Code Auto-detect Info */}
          {provider === 'claude-code' && (
            <div className="space-y-3">
              {detecting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Detecting Claude Code configuration...
                </div>
              ) : detectedInfo ? (
                <div className={`rounded-lg p-3 text-sm ${
                  detectedInfo.found
                    ? 'bg-violet-500/10 border border-violet-500/20 dark:bg-violet-500/15'
                    : 'bg-amber-500/10 border border-amber-500/20 dark:bg-amber-500/15'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5 font-medium">
                    {detectedInfo.found ? (
                      <Check className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    {detectedInfo.found
                      ? `Configuration detected (Source: ${detectedInfo.source})`
                      : 'No Claude Code configuration found'}
                  </div>
                  {detectedInfo.found && (
                    <div className="ml-6 space-y-1.5">
                      {/* Show detected model info */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <Atom className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-mono text-violet-700 dark:text-violet-300">{detectedInfo.model || 'claude-sonnet-4-20250514'}</span>
                      </div>
                      {/* Show detected base URL */}
                      {detectedInfo.baseUrl && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Globe className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                          <span className="text-muted-foreground">Base URL:</span>
                          <span className="font-mono text-violet-700 dark:text-violet-300">{detectedInfo.baseUrl}</span>
                        </div>
                      )}
                      {/* Show API key status */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <Wifi className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                        <span className="text-muted-foreground">API Key:</span>
                        <span className="font-mono text-violet-700 dark:text-violet-300">{detectedInfo.apiKey || '(not set)'}</span>
                      </div>
                      {/* Additional details */}
                      {detectedInfo.details.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {detectedInfo.details.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {!detectedInfo.found && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Set <code className="font-mono bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> environment variable or configure Claude Code CLI.
                    </p>
                  )}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                Model, API key and base URL are read from Claude Code configuration. No manual setup needed.
              </p>

              {/* Re-detect button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectClaudeCode}
                disabled={detecting}
                className="gap-1.5"
              >
                {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Re-detect Configuration
              </Button>
            </div>
          )}

          {/* Import from Claude Code button (for anthropic/custom/openai providers) */}
          {(provider === 'anthropic' || provider === 'openai' || provider === 'custom') && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportFromClaudeCode}
                disabled={detecting}
                className="gap-1.5 text-xs"
              >
                {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Atom className="h-3.5 w-3.5" />}
                Import from Claude Code
              </Button>
              <span className="text-xs text-muted-foreground">Auto-fill from Claude Code CLI config</span>
            </div>
          )}

          {/* API Key (only for custom providers) */}
          {isCustomProvider && (
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-sm font-medium">API Key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={getApiPlaceholder()}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {provider === 'anthropic' && (
                <p className="text-xs text-muted-foreground">
                  Get your API key from <span className="font-mono text-xs">console.anthropic.com</span>
                </p>
              )}
            </div>
          )}

          {/* Base URL (only for custom providers) */}
          {isCustomProvider && (
            <div className="space-y-2">
              <Label htmlFor="base-url" className="text-sm font-medium">
                Base URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="base-url"
                placeholder={getBaseUrlPlaceholder()}
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
              />
              <p className="text-xs text-muted-foreground">
                {provider === 'anthropic'
                  ? 'Leave empty for official Anthropic API. For proxies (e.g. OpenRouter), enter the base URL.'
                  : 'Leave empty for official API. For proxies or self-hosted, enter the base URL.'}
              </p>
            </div>
          )}

          {/* Model (only for custom providers, NOT claude-code — model is auto-detected) */}
          {isCustomProvider && (
            <div className="space-y-2">
              <Label htmlFor="model" className="text-sm font-medium">Model</Label>
              {provider === 'anthropic' ? (
                <Select value={model} onValueChange={(val) => { setModel(val); if (val !== '__custom__') setCustomModelName(''); setTestResult(null); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Claude model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-20250514">
                      <span className="flex items-center gap-2">
                        <Atom className="h-3 w-3" />
                        Claude Sonnet 4 <span className="text-muted-foreground text-xs">(Recommended)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="claude-3-5-sonnet-20241022">
                      <span className="flex items-center gap-2">
                        <Atom className="h-3 w-3" />
                        Claude 3.5 Sonnet
                      </span>
                    </SelectItem>
                    <SelectItem value="claude-3-5-haiku-20241022">
                      <span className="flex items-center gap-2">
                        <Zap className="h-3 w-3" />
                        Claude 3.5 Haiku <span className="text-muted-foreground text-xs">(Fast)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="claude-3-opus-20240229">
                      <span className="flex items-center gap-2">
                        <Cpu className="h-3 w-3" />
                        Claude 3 Opus <span className="text-muted-foreground text-xs">(Powerful)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="claude-3-haiku-20240307">
                      <span className="flex items-center gap-2">
                        <Zap className="h-3 w-3" />
                        Claude 3 Haiku <span className="text-muted-foreground text-xs">(Fastest)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="__custom__">
                      <span className="flex items-center gap-2">
                        <Edit3 className="h-3 w-3" />
                        Custom model name...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="model"
                  placeholder={getModelPlaceholder()}
                  value={model}
                  onChange={(e) => { setModel(e.target.value); setTestResult(null); }}
                />
              )}
              {model === '__custom__' && provider === 'anthropic' && (
                <Input
                  placeholder="claude-custom-model-name"
                  value={customModelName}
                  onChange={(e) => { setCustomModelName(e.target.value); setTestResult(null); }}
                  className="mt-2"
                  autoFocus
                />
              )}
              <p className="text-xs text-muted-foreground">
                {getModelHint()}
              </p>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
            }`}>
              {testResult.success ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleTest} disabled={testing || (isCustomProvider && !apiKey)} className="gap-1.5">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || (isCustomProvider && !apiKey) || (model === '__custom__' && !customModelName.trim())} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <Button onClick={onAddProject} size="lg" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-700 dark:to-teal-700 dark:hover:from-emerald-600 dark:hover:to-teal-600 shadow-lg shadow-emerald-500/20">
        <Plus className="h-5 w-5" />
        Add Your First Project
      </Button>
    </motion.div>
  );
}

// ============ Project Card ============
function ProjectCard({
  project,
  lanIP,
  viewMode,
  onOpen,
  onOpenToEnv,
  onDelete,
  onAction,
  onPortChange,
  actionLoading,
}: {
  project: Project;
  lanIP: string;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
  onOpenToEnv: () => void;
  onDelete: () => void;
  onAction: (envId: string, action: 'start' | 'stop') => void;
  onPortChange: () => void;
  actionLoading: Set<string>;
}) {
  const runningCount = project.environments.filter(e => e.status === 'running').length;
  const totalCount = project.environments.length;
  const allRunning = totalCount > 0 && runningCount === totalCount;
  const hasRunning = runningCount > 0;
  const isListView = viewMode === 'list';

  const createdDate = new Date(project.createdAt);
  const timeAgo = (() => {
    const diffMs = Date.now() - createdDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return createdDate.toLocaleDateString();
  })();

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
          isListView ? 'py-1.5 gap-0' : 'py-2 gap-0.5'
        } ${hasRunning ? 'hover:border-emerald-500/30' : 'hover:border-border'}`}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {/* Left accent border */}
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-colors duration-300 ${
          hasRunning ? 'bg-gradient-to-b from-emerald-500 to-teal-500' : 'bg-muted-foreground/20'
        }`} />

        {isListView ? (
          /* List View Layout */
          <div className="flex items-center gap-3 pl-3.5 pr-3 py-0.5">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
              hasRunning
                ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20'
                : 'bg-muted/80 border border-border/50'
            }`}>
              <ProjectIcon icon={project.icon} className={`h-3.5 w-3.5 ${hasRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${hasRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-mono">{project.path}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {totalCount > 0 && (
                <span className={`text-xs font-medium ${hasRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {runningCount}/{totalCount}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60">{timeAgo}</span>
              {totalCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 ${allRunning ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10'}`}
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
                  disabled={actionLoading.size > 0}
                  title={allRunning ? 'Stop All' : runningCount > 0 ? 'Start Remaining' : 'Start All'}
                  aria-label={allRunning ? 'Stop all environments' : runningCount > 0 ? 'Start remaining environments' : 'Start all environments'}
                >
                  {actionLoading.size > 0 ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : allRunning ? (
                    <Square className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <MoreVertical className="h-3 w-3" />
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
        ) : (
          /* Grid View Layout (original) */
          <>
        <CardHeader className="pb-1 pl-3.5 pr-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                hasRunning
                  ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20'
                  : 'bg-muted/80 border border-border/50'
              }`}>
                <ProjectIcon icon={project.icon} className={`h-4 w-4 ${hasRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                <p className="text-[11px] text-muted-foreground truncate flex-1 font-mono">{project.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Quick Start/Stop All button */}
              {totalCount > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${allRunning ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10'}`}
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
                  disabled={actionLoading.size > 0}
                  title={allRunning ? 'Stop All' : runningCount > 0 ? 'Start Remaining' : 'Start All'}
                  aria-label={allRunning ? 'Stop all environments' : runningCount > 0 ? 'Start remaining environments' : 'Start all environments'}
                >
                  {actionLoading.size > 0 ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : allRunning ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
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
        <CardContent className="pt-0 pl-3.5 pr-3 pb-1.5">
          {project.description && (
            <p className="text-[11px] text-muted-foreground mb-1 line-clamp-2">{project.description}</p>
          )}
          {totalCount > 0 ? (
            <div className="space-y-0.5">
              {/* Quick toggle per environment */}
              <div className="flex flex-col gap-0">
                {project.environments.map(env => {
                  const isLoading = actionLoading.has(env.id);
                  return (
                    <div
                      key={env.id}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-px -mx-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${env.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-xs font-medium truncate">{formatEnvName(env.name, true)}</span>
                        <InlinePortEditor
                          projectId={project.id}
                          envId={env.id}
                          port={env.port}
                          onSaved={onPortChange}
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {env.status === 'running' && (
                          <>
                            <a
                              href={`http://localhost:${env.port}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                              onClick={(e) => e.stopPropagation()}
                              title="Open localhost"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {lanIP && (
                              <CopyableUrl url={`http://${lanIP}:${env.port}`} label="Copy LAN URL" />
                            )}
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-5 w-5 ${env.status === 'running' ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAction(env.id, env.status === 'running' ? 'stop' : 'start');
                          }}
                          disabled={isLoading}
                          title={env.status === 'running' ? 'Stop' : 'Start'}
                        >
                          {isLoading ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : env.status === 'running' ? (
                            <Square className="h-2.5 w-2.5" />
                          ) : (
                            <Play className="h-2.5 w-2.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Summary row */}
              <div className="flex items-center justify-between pt-px">
                <span className={`text-[11px] font-medium ${runningCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {runningCount}/{totalCount} running
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/50">{timeAgo}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px] gap-0.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenToEnv();
                  }}
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50">{timeAgo}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          )}
        </CardContent>
          </>
        )}
      </Card>
    </motion.div>
  );
}

// ============ Add Project Dialog ============
function AddProjectDialog({
  open,
  onOpenChange,
  onSuccess,
  llmReady,
  llmProvider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  llmReady: boolean;
  llmProvider: string;
}) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  const [analyzeMode, setAnalyzeMode] = useState<'api' | 'cli'>('api');
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
        body: JSON.stringify({ path: path.trim(), name: name.trim() || undefined, icon }),
      });

      if (llmReady || analyzeMode === 'cli') {
        const modeLabel = analyzeMode === 'cli' ? 'Claude Code CLI' : 'AI';
        toast({ title: 'Project created', description: `Starting ${modeLabel} analysis...` });

        // Then analyze with LLM or Claude Code CLI
        setIsAnalyzing(true);
        try {
          const analyzeUrl = analyzeMode === 'cli'
            ? `/api/projects/${data.project.id}/analyze-cli`
            : `/api/projects/${data.project.id}/analyze`;
          const result = await apiFetch<{ project: Project; analysis: any }>(analyzeUrl, {
            method: 'POST',
          });
          toast({
            title: `${modeLabel} Configuration Complete`,
            description: `Detected ${result.analysis?.environments?.length || 0} environments for ${result.analysis?.projectName || data.project.name}`,
            duration: 5000,
          });
        } catch (analyzeErr: any) {
          const modeLabel = analyzeMode === 'cli' ? 'Claude Code CLI' : 'AI';
          toast({
            title: `${modeLabel} Analysis Failed`,
            description: analyzeErr.message + '. You can manually configure environments.',
            variant: 'destructive',
            duration: 7000,
          });
        }
      } else {
        toast({ title: 'Project created', description: 'Configure LLM settings to enable AI auto-configuration.' });
      }

      setPath('');
      setName('');
      setIcon('folder');
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Failed to create project', description: e.message, variant: 'destructive', duration: 5000 });
    } finally {
      setIsCreating(false);
      setIsAnalyzing(false);
    }
  };

  const providerLabel = llmProvider === 'zai' ? 'Built-in AI' : llmProvider === 'claude-code' ? 'Claude Code (Auto-detect)' : llmProvider === 'anthropic' ? 'Anthropic (Claude)' : llmProvider === 'openai' ? 'OpenAI' : 'Custom API';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            Add New Project
          </DialogTitle>
          <DialogDescription>
            Enter the project directory path. AI will automatically detect the framework and configure startup settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* LLM Status Banner */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            llmReady || analyzeMode === 'cli'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {llmReady || analyzeMode === 'cli' ? (
              <>
                <Wifi className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {analyzeMode === 'cli'
                    ? 'Claude Code CLI will be used for analysis'
                    : `AI auto-configuration enabled (${providerLabel})`}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                <span>LLM not configured. Project will be added without AI analysis.</span>
              </>
            )}
          </div>

          {/* Analysis Mode Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Analysis Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAnalyzeMode('api')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all ${
                  analyzeMode === 'api'
                    ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                    : 'border-muted hover:border-muted-foreground/25'
                }`}
              >
                <Settings className={`h-5 w-5 ${analyzeMode === 'api' ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${analyzeMode === 'api' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  LLM API
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Use configured API provider
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAnalyzeMode('cli')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all ${
                  analyzeMode === 'cli'
                    ? 'border-violet-500 bg-violet-500/5 dark:bg-violet-500/10'
                    : 'border-muted hover:border-muted-foreground/25'
                }`}
              >
                <Terminal className={`h-5 w-5 ${analyzeMode === 'cli' ? 'text-violet-500 dark:text-violet-400' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${analyzeMode === 'cli' ? 'text-violet-700 dark:text-violet-400' : 'text-muted-foreground'}`}>
                  Claude Code CLI
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Use Claude Code directly
                </span>
              </button>
            </div>
            {analyzeMode === 'cli' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Terminal className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                Invokes <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">claude</code> CLI to analyze the project directory and generate startup configs. Requires Claude Code CLI installed and authenticated.
              </p>
            )}
            {analyzeMode === 'api' && !llmReady && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                No LLM provider configured. Switch to Claude Code CLI or configure LLM settings first.
              </p>
            )}
          </div>

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
          <div className="space-y-2">
            <Label className="text-sm font-medium">Project Icon</Label>
            <IconSelector icon={icon} onIconChange={setIcon} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleAutoDetect}
            disabled={isCreating || !path.trim()}
            className="gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {analyzeMode === 'cli' ? 'Claude Code Analyzing...' : 'AI Analyzing...'}
              </>
            ) : isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {analyzeMode === 'cli' ? <Terminal className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {analyzeMode === 'api' && !llmReady ? 'Add Project' : analyzeMode === 'cli' ? 'Add & CLI Configure' : 'Add & Auto-Configure'}
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
  llmReady,
  lanIP,
  initialTab,
}: {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectChanged: () => void;
  llmReady: boolean;
  lanIP: string;
  initialTab: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState<Environment | null>(null);
  const [editEnv, setEditEnv] = useState<Environment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteEnv, setDeleteEnv] = useState<Environment | null>(null);
  const [showEditProject, setShowEditProject] = useState(false);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
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

  if (!project) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="sr-only">Loading project</SheetTitle>
            <SheetDescription className="sr-only">Project details are loading</SheetDescription>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-muted rounded animate-pulse" />
                <div className="h-3 w-52 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 px-5 py-3 space-y-3">
            <div className="h-16 bg-muted rounded-lg animate-pulse" />
            <div className="h-28 bg-muted rounded-lg animate-pulse" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

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

  const handleAnalyze = async (useCli = false) => {
    setIsAnalyzing(true);
    try {
      const analyzeUrl = useCli
        ? `/api/projects/${project.id}/analyze-cli`
        : `/api/projects/${project.id}/analyze`;
      await apiFetch(analyzeUrl, { method: 'POST' });
      const label = useCli ? 'Claude Code CLI Analysis' : 'AI Analysis';
      toast({ title: `${label} Complete`, description: 'Environments have been reconfigured', duration: 5000 });
      await refreshProject();
      onProjectChanged();
    } catch (e: any) {
      toast({ title: 'Analysis Failed', description: e.message, variant: 'destructive', duration: 7000 });
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
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-lg bg-muted/80 border border-border/50 flex items-center justify-center">
                <ProjectIcon icon={project.icon} className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base">{project.name}</SheetTitle>
                <SheetDescription className="sr-only">{project.path}</SheetDescription>
                <p className="text-xs text-muted-foreground font-mono truncate">{project.path}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowEditProject(true)} title="Edit project">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-1.5">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="environments" className="flex-1">Environments</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 overflow-auto px-4 py-2.5">
              <div className="space-y-3">
                {project.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{project.description}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Project Path</h4>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-3 py-2 rounded-md block font-mono flex-1">{project.path}</code>
                    <CopyableText text={project.path} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Environments Summary</h4>
                  {project.environments.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
                      No environments configured yet.
                      <br />Use AI to auto-configure or add manually.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {project.environments.map(env => (
                        <div key={env.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-2 w-2 rounded-full ${env.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                            <div>
                              <span className="font-medium text-sm">{formatEnvName(env.name)}</span>
                              <span className="text-xs text-muted-foreground ml-1.5">:{env.port}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {env.status === 'running' && lanIP && (
                              <CopyableUrl url={`http://${lanIP}:${env.port}`} label="Copy LAN URL" />
                            )}
                            <Badge variant={env.status === 'running' ? 'default' : 'secondary'} className={`text-[11px] ${env.status === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}`}>
                              {env.status === 'running' ? 'Running' : 'Stopped'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button disabled={isAnalyzing} className="gap-2 flex-1">
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAnalyze(false)} disabled={!llmReady}>
                        <Settings className="h-4 w-4 mr-2" />
                        LLM API Analysis
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAnalyze(true)}>
                        <Terminal className="h-4 w-4 mr-2" />
                        Claude Code CLI
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                  <p className="text-sm">{new Date(project.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="environments" className="flex-1 overflow-auto px-4 py-2.5">
              <div className="space-y-3">
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
                      <Button variant="outline" size="sm" onClick={() => handleAnalyze(false)} disabled={isAnalyzing || !llmReady} className="gap-1">
                        {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        AI Auto-Configure
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAnalyze(true)} disabled={isAnalyzing} className="gap-1">
                        {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
                        Claude Code CLI
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
                      lanIP={lanIP}
                      actionLoading={actionLoading}
                      onAction={(action) => handleAction(env.id, action)}
                      onEdit={() => { setEditEnv(env); setShowEnvDialog(true); }}
                      onDelete={() => setDeleteEnv(env)}
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

      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={project}
        open={showEditProject}
        onOpenChange={setShowEditProject}
        onSuccess={handleProjectUpdate}
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

      {/* Delete Environment Confirmation */}
      <AlertDialog open={!!deleteEnv} onOpenChange={() => setDeleteEnv(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the <strong>{deleteEnv?.name}</strong> environment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteEnv) handleDeleteEnv(deleteEnv.id); setDeleteEnv(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============ Environment Panel ============
function EnvironmentPanel({
  environment: env,
  projectPath,
  lanIP,
  actionLoading,
  onAction,
  onEdit,
  onDelete,
  onViewLogs,
}: {
  environment: Environment;
  projectPath: string;
  lanIP: string;
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
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Environment Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="font-medium text-sm">{formatEnvName(env.name)}</span>
          <span className="text-[11px] text-muted-foreground">:{env.port}</span>
          <Badge variant={isRunning ? 'default' : 'secondary'} className={`text-[11px] px-1.5 py-0 ${isRunning ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : ''} ${!isRunning && env.name === 'production' ? 'border-orange-500/20 text-orange-600 dark:text-orange-400' : ''}`}>
            {isRunning ? 'Running' : 'Stopped'}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onViewLogs()} title="View Logs"
          >
            <Terminal className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={onEdit} title="Edit Configuration"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
            onClick={onDelete} title="Delete Environment"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Environment Body */}
      <div className="px-3 py-2 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Start Command</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">{env.cmd}</code>
            <CopyableText text={env.cmd} />
          </div>
        </div>

        {Object.keys(envVars).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Environment Variables</p>
            <div className="space-y-1">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400">{key}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-muted-foreground truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isRunning && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <a
                href={`http://localhost:${env.port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                localhost:{env.port}
              </a>
              <CopyableUrl url={`http://localhost:${env.port}`} label="Copy URL" />
            </div>
            {lanIP && (
              <div className="flex items-center gap-2">
                <a
                  href={`http://${lanIP}:${env.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Wifi className="h-3 w-3" />
                  {lanIP}:{env.port}
                </a>
                <CopyableUrl url={`http://${lanIP}:${env.port}`} label="Copy LAN URL" />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant={isRunning ? 'outline' : 'default'}
            onClick={() => onAction('start')}
            disabled={isLoading || isRunning}
            className={isRunning ? '' : 'bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 gap-1'}
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

// ============ Edit Project Dialog ============
function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description);
      setIcon(project.icon);
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Project name cannot be empty', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), icon }),
      });
      toast({ title: 'Project updated', duration: 2000 });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Failed to update project', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            Edit Project
          </DialogTitle>
          <DialogDescription>
            Update the project name, description, and icon.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-medium">Project Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc" className="text-sm font-medium">Description</Label>
            <Textarea
              id="edit-desc"
              placeholder="A brief description of this project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Project Icon</Label>
            <IconSelector icon={icon} onIconChange={setIcon} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Changes
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

// ============ Gateway Monitor Dialog ============
// ============ Agent Gateway Icon Map ============
const AGENT_ICON_MAP: Record<string, LucideIcon> = {
  'sparkles': Sparkles,
  'puzzle': Puzzle,
  'zap': Zap,
  'folder': Folder,
  'server': Server,
  'globe': Globe,
  'terminal': Terminal,
  'cpu': Cpu,
  'shield': Shield,
  'code': Code,
  'rocket': Rocket,
  'cloud': Cloud,
  'database': Database,
  'package': Package,
};

function GatewayMonitorDialog({
  open,
  onOpenChange,
  gatewayStatus,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatewayStatus: GatewayStatusData | null;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const runningServices = gatewayStatus?.services.filter(s => s.status === 'running') || [];
  const stoppedServices = gatewayStatus?.services.filter(s => s.status === 'stopped') || [];
  const accessibleServices = runningServices.filter(s => s.gatewayAccessible);

  const runningAgents = gatewayStatus?.agentGateways.filter(a => a.status === 'running') || [];
  const stoppedAgents = gatewayStatus?.agentGateways.filter(a => a.status === 'stopped') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            Gateway Monitor
          </DialogTitle>
          <DialogDescription>
            Real-time gateway, agent service and project health monitoring
          </DialogDescription>
        </DialogHeader>

        {!gatewayStatus ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Tab Navigation */}
            <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5" role="tablist">
              {[
                { key: 'overview', label: 'Overview', icon: HeartPulse },
                { key: 'agents', label: 'Agent Gateways', icon: Sparkles, badge: runningAgents.length > 0 ? `${runningAgents.length}/${runningAgents.length + stoppedAgents.length}` : undefined },
                { key: 'services', label: 'Project Services', icon: Activity, badge: runningServices.length > 0 ? `${runningServices.length}/${runningServices.length + stoppedServices.length}` : undefined },
              ].map(({ key, label, icon: TabIcon, badge }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-1 justify-center ${
                    activeTab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  role="tab"
                  aria-selected={activeTab === key}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {label}
                  {badge && <span className="ml-0.5 text-[10px] opacity-70">({badge})</span>}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
                {/* Gateway Status Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Caddy Status Card */}
                  <div className={`rounded-lg border p-3 ${gatewayStatus.caddyRunning ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-2 w-2 rounded-full ${gatewayStatus.caddyRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-sm font-medium">Caddy Gateway</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Process</span>
                        <span className={gatewayStatus.caddyRunning ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                          {gatewayStatus.caddyRunning ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Port :{gatewayStatus.gatewayPort}</span>
                        <span className={gatewayStatus.gatewayListening ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                          {gatewayStatus.gatewayListening ? 'Listening' : 'Not Listening'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Uptime</span>
                        <span className="font-mono">{formatUptime(gatewayStatus.uptime)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-mono text-[11px]">{gatewayStatus.caddyVersion.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* System Resources Card */}
                  <div className="rounded-lg border p-3 border-border/50 bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">System Resources</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">CPU</span>
                          <span className={`font-mono font-medium ${gatewayStatus.cpuUsage > 80 ? 'text-red-500' : gatewayStatus.cpuUsage > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {gatewayStatus.cpuUsage}%
                          </span>
                        </div>
                        <div className={gatewayStatus.cpuUsage > 80 ? '[&_[data-slot=progress-indicator]]:bg-red-500' : gatewayStatus.cpuUsage > 50 ? '[&_[data-slot=progress-indicator]]:bg-amber-500' : '[&_[data-slot=progress-indicator]]:bg-emerald-500'}>
                          <Progress value={gatewayStatus.cpuUsage} className="h-1.5" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Memory</span>
                          <span className={`font-mono font-medium ${gatewayStatus.memoryUsage.percentage > 80 ? 'text-red-500' : gatewayStatus.memoryUsage.percentage > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {gatewayStatus.memoryUsage.percentage}%
                          </span>
                        </div>
                        <div className={gatewayStatus.memoryUsage.percentage > 80 ? '[&_[data-slot=progress-indicator]]:bg-red-500' : gatewayStatus.memoryUsage.percentage > 50 ? '[&_[data-slot=progress-indicator]]:bg-amber-500' : '[&_[data-slot=progress-indicator]]:bg-emerald-500'}>
                          <Progress value={gatewayStatus.memoryUsage.percentage} className="h-1.5" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatBytes(gatewayStatus.memoryUsage.used)} / {formatBytes(gatewayStatus.memoryUsage.total)}
                        </p>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">System Uptime</span>
                        <span className="font-mono">{formatUptime(gatewayStatus.systemUptime)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Gateway Quick Summary */}
                {gatewayStatus.agentGateways.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">Agent Gateways</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {runningAgents.length > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {runningAgents.length} online
                          </span>
                        )}
                        {stoppedAgents.length > 0 && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                            {stoppedAgents.length} offline
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {gatewayStatus.agentGateways.map(agent => {
                        const AgentIcon = AGENT_ICON_MAP[agent.icon] || Server;
                        return (
                          <div
                            key={agent.name}
                            className={`flex flex-col items-center gap-1.5 rounded-md p-2 border transition-colors ${
                              agent.status === 'running'
                                ? 'border-emerald-500/20 bg-emerald-500/5'
                                : 'border-border/30 bg-muted/20'
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-md flex items-center justify-center ${
                              agent.status === 'running' ? 'bg-emerald-500/10' : 'bg-muted/50'
                            }`}>
                              <AgentIcon className={`h-3.5 w-3.5 ${agent.status === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'}`} />
                            </div>
                            <span className="text-[11px] font-medium leading-tight text-center">{agent.displayName}</span>
                            <div className="flex items-center gap-1">
                              <div className={`h-1.5 w-1.5 rounded-full ${agent.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                              <span className={`text-[10px] ${agent.status === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                :{agent.port}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setActiveTab('agents')}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
                    >
                      View details <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Gateway Config Info */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Gateway Configuration</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between bg-background/60 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">Listen Port</span>
                      <span className="font-mono font-medium">:{gatewayStatus.gatewayPort}</span>
                    </div>
                    <div className="flex justify-between bg-background/60 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">Config Valid</span>
                      <span className={gatewayStatus.configValid ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                        {gatewayStatus.configValid ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between bg-background/60 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">Default Route</span>
                      <span className="font-mono">:3000</span>
                    </div>
                    <div className="flex justify-between bg-background/60 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">Port Forward</span>
                      <span className="font-mono">XTransformPort</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Gateways Tab */}
            {activeTab === 'agents' && (
              <div className="space-y-3">
                {gatewayStatus.agentGateways.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No agent gateways detected</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Agent services will appear here when running</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Bar */}
                    <div className="flex items-center gap-4 px-1 text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {runningAgents.length} Online
                      </span>
                      {stoppedAgents.length > 0 && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                          {stoppedAgents.length} Offline
                        </span>
                      )}
                    </div>
                    {/* Agent Cards */}
                    <div className="space-y-2">
                      {gatewayStatus.agentGateways.map(agent => {
                        const AgentIcon = AGENT_ICON_MAP[agent.icon] || Server;
                        const isRunning = agent.status === 'running';
                        return (
                          <div
                            key={agent.name}
                            className={`rounded-lg border p-3 transition-colors ${
                              isRunning
                                ? agent.httpStatus !== null
                                  ? 'border-emerald-500/20 bg-emerald-500/5'
                                  : 'border-amber-500/20 bg-amber-500/5'
                                : 'border-border/30 bg-muted/20'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2.5">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                                  isRunning ? 'bg-emerald-500/10' : 'bg-muted/50'
                                }`}>
                                  <AgentIcon className={`h-4.5 w-4.5 ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{agent.displayName}</span>
                                    <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 max-w-[280px]">{agent.description}</p>
                                </div>
                              </div>
                              <Badge variant={isRunning ? 'default' : 'secondary'} className={`text-[10px] h-5 shrink-0 ${isRunning ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15' : ''}`}>
                                {isRunning ? 'Online' : 'Offline'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs bg-background/40 rounded-md px-2.5 py-2">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground text-[10px]">Port</span>
                                <span className="font-mono font-medium">:{agent.port}</span>
                              </div>
                              {isRunning && (
                                <>
                                  {agent.pid !== null && (
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">PID</span>
                                      <span className="font-mono">{agent.pid}</span>
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground text-[10px]">Uptime</span>
                                    <span className="font-mono">{formatUptime(agent.uptime)}</span>
                                  </div>
                                  {agent.memoryMB > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">Memory</span>
                                      <span className="font-mono">{agent.memoryMB} MB</span>
                                    </div>
                                  )}
                                  {agent.httpStatus !== null ? (
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">HTTP</span>
                                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                        {agent.httpStatus} {agent.httpStatus === 404 ? '(API)' : ''}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">HTTP</span>
                                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                        <AlertCircle className="h-3 w-3" />
                                        N/A
                                      </span>
                                    </div>
                                  )}
                                  {agent.responseTime !== null && (
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">Response</span>
                                      <span className="flex items-center gap-0.5 font-mono">
                                        <Timer className="h-3 w-3 text-muted-foreground" />
                                        {agent.responseTime}ms
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              {!isRunning && (
                                <div className="flex flex-col col-span-2">
                                  <span className="text-muted-foreground text-[10px]">Status</span>
                                  <span className="text-muted-foreground/70">Service not running on this port</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Project Services Tab */}
            {activeTab === 'services' && (
              <div className="space-y-3">
                {/* Service Health Summary */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">Service Health</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {runningServices.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {runningServices.length} running
                        </span>
                      )}
                      {stoppedServices.length > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          {stoppedServices.length} stopped
                        </span>
                      )}
                      {runningServices.length > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3" />
                          {accessibleServices.length}/{runningServices.length} accessible
                        </span>
                      )}
                    </div>
                  </div>

                  {gatewayStatus.services.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No services configured</p>
                  ) : (
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {gatewayStatus.services.map(service => (
                        <div
                          key={service.envId}
                          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                            service.status === 'running'
                              ? service.gatewayAccessible
                                ? 'bg-emerald-500/5 border border-emerald-500/10'
                                : 'bg-amber-500/5 border border-amber-500/10'
                              : 'bg-muted/30 border border-border/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${
                              service.status === 'running'
                                ? service.gatewayAccessible
                                  ? 'bg-emerald-500 animate-pulse'
                                  : 'bg-amber-500'
                                : 'bg-muted-foreground/30'
                            }`} />
                            <span className="font-medium">{service.projectName}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">{formatEnvName(service.envName, true)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground">:{service.port}</span>
                            {service.status === 'running' ? (
                              <>
                                {service.httpStatus !== null ? (
                                  <span className={`font-mono font-medium ${service.httpStatus < 400 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    HTTP {service.httpStatus}
                                  </span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Unreachable
                                  </span>
                                )}
                                {service.responseTime !== null && (
                                  <span className="flex items-center gap-1 text-muted-foreground font-mono">
                                    <Timer className="h-3 w-3" />
                                    {service.responseTime}ms
                                  </span>
                                )}
                              </>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] h-4">Stopped</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Last Checked */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Last checked: {new Date(gatewayStatus.lastChecked).toLocaleTimeString()}</span>
              <span>Auto-refresh every 15s</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Now
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
