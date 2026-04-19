'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { dictsApi, configApi, suppliersApi, metalApi, backupApi, importApi, itemsApi, salesApi, batchesApi, customersApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, EmptyState, LoadingSkeleton } from './shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';

import { Plus, Pencil, Trash2, Factory, Calculator, History, Download, Upload, Database, AlertTriangle, Loader2, FileSpreadsheet, FileDown, CheckCircle, XCircle, Clock, Phone, Gem, Box, Tag, DollarSign, Settings, ShieldCheck, Grid, Package, ShoppingCart, Users, Layers, Search, X, Hash, Crown, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ========== 材质大类选项 ==========
const MATERIAL_CATEGORIES = [
  { value: '玉', label: '玉' },
  { value: '贵金属', label: '贵金属' },
  { value: '水晶', label: '水晶' },
  { value: '文玩', label: '文玩' },
  { value: '其他', label: '其他' },
];

// ========== 规格字段定义 ==========
const SPEC_FIELD_OPTIONS = [
  { key: 'weight', label: '克重(g)' },
  { key: 'metalWeight', label: '金重(g)' },
  { key: 'size', label: '尺寸' },
  { key: 'braceletSize', label: '圈口' },
  { key: 'beadCount', label: '颗数' },
  { key: 'beadDiameter', label: '珠径' },
  { key: 'ringSize', label: '戒圈' },
] as const;

const SPEC_FIELD_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SPEC_FIELD_OPTIONS.map(f => [f.key, f.label])
);

/** 解析 specFields（向后兼容数组格式） */
function parseSpecFields(raw: string | null | undefined): Record<string, { required: boolean }> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // 旧格式：["weight","braceletSize"] → {"weight":{"required":false},"braceletSize":{"required":false}}
      const obj: Record<string, { required: boolean }> = {};
      parsed.forEach((key: string) => { obj[key] = { required: false }; });
      return obj;
    }
    return parsed;
  } catch {
    return {};
  }
}

/** 将 specFields 对象格式化为中文展示 */
function formatSpecFieldsDisplay(raw: string | null | undefined): string {
  const fields = parseSpecFields(raw);
  const keys = Object.keys(fields);
  if (keys.length === 0) return '-';
  return keys.map(k => {
    const label = SPEC_FIELD_LABEL_MAP[k] || k;
    const required = fields[k]?.required;
    return required ? `${label}*` : label;
  }).join('、');
}

// ========== Relative Time Helper ==========
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffWeeks < 4) return `${diffWeeks}周前`;
    if (diffMonths < 12) return `${diffMonths}个月前`;
    return `${Math.floor(diffMonths / 12)}年前`;
  } catch {
    return dateStr;
  }
}

// ========== Settings Tab ==========
function SettingsTab() {
  const [subTab, setSubTab] = useState('dicts');
  const [materials, setMaterials] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [crafts, setCrafts] = useState<any[]>([]);
  const [sellingPoints, setSellingPoints] = useState<any[]>([]);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSupplierSearch(supplierSearch), 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  // Supplier dialog states
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<any>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', notes: '' });

  // Dict dialog states
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [editMaterial, setEditMaterial] = useState<any>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', category: '', subType: '', origin: '', costPerGram: '' });
  const [showCreateType, setShowCreateType] = useState(false);
  const [editType, setEditType] = useState<any>(null);
  const [deleteType, setDeleteType] = useState<any>(null);
  // typeForm.specFields now stores Record<string, { required: boolean }>
  const [typeForm, setTypeForm] = useState<{ name: string; specFields: Record<string, { required: boolean }> }>({ name: '', specFields: {} });
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [tagForm, setTagForm] = useState({ name: '', groupName: '' });
  const [tagGroupFilter, setTagGroupFilter] = useState('');
  const [editTag, setEditTag] = useState<any>(null);

  // Craft dialog states
  const [showCreateCraft, setShowCreateCraft] = useState(false);
  const [editCraft, setEditCraft] = useState<any>(null);
  const [craftForm, setCraftForm] = useState({ name: '', description: '', sortOrder: '' });

  // SellingPoint dialog states
  const [showCreateSellingPoint, setShowCreateSellingPoint] = useState(false);
  const [editSellingPoint, setEditSellingPoint] = useState<any>(null);
  const [sellingPointForm, setSellingPointForm] = useState({ name: '', sortOrder: '' });

  // Audience dialog states
  const [showCreateAudience, setShowCreateAudience] = useState(false);
  const [editAudience, setEditAudience] = useState<any>(null);
  const [audienceForm, setAudienceForm] = useState({ name: '', sortOrder: '' });

  // Metal reprice states
  const [repricePreview, setRepricePreview] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [priceHistoryMaterial, setPriceHistoryMaterial] = useState<string>('');

  // Backup/restore states
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // Import states
  const [importType, setImportType] = useState<'items' | 'sales'>('items');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // CSV quick import states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; skipped: number; duplicated: number; errors: string[]; autoCreated?: { materials: string[]; types: string[] }; inferred?: { row: number; field: string; value: string }[] } | null>(null);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [autoCreate, setAutoCreate] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

  // Data statistics states
  const [dataStats, setDataStats] = useState({
    itemsCount: null as number | null,
    salesCount: null as number | null,
    customersCount: null as number | null,
    batchesCount: null as number | null,
  });
  const [lastBackupFromStorage, setLastBackupFromStorage] = useState<string | null>(null);
  const [dbSize, setDbSize] = useState<string | null>(null);
  const [dbSizeLoading, setDbSizeLoading] = useState(false);

  // Data cleanup states
  const [deletedItemsCount, setDeletedItemsCount] = useState<number>(0);
  const [oldLogsCount, setOldLogsCount] = useState<number>(0);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState<{ type: 'deleted' | 'logs'; open: boolean }>({ type: 'deleted', open: false });

  // System config (synced to server SysConfig for store_name, others in localStorage)
  const STORAGE_KEY = 'jade_system_config';
  const defaultSettings = { storeName: '翡翠珠宝', currencySymbol: '¥', lowStockDays: 90, profitWarningThreshold: 30, defaultProfitRate: 40 };
  const [systemConfig, setSystemConfig] = useState(defaultSettings);

  // Editable server configs (local edit state, saved on blur)
  const [editConfigs, setEditConfigs] = useState<Record<string, string>>({});

  // Load settings & data stats from localStorage on mount
  useEffect(() => {
    try {
      // Try new key first, fall back to old key for migration
      let stored: string | null = null;
      try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
      if (!stored) {
        try { stored = localStorage.getItem('app_settings'); } catch {}
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        setSystemConfig({ ...defaultSettings, ...parsed });
      }
    } catch { /* use defaults */ }
    // Load last backup time from localStorage
    try {
      const backupTime = localStorage.getItem('last_backup_time');
      if (backupTime) {
        setLastBackupFromStorage(backupTime);
      }
    } catch { /* ignore */ }
  }, []);

  // Sync store name from server config to local state on initial load
  useEffect(() => {
    const storeNameConfig = configs.find(c => c.key === 'store_name');
    if (storeNameConfig?.value) {
      setSystemConfig(prev => ({ ...prev, storeName: storeNameConfig.value }));
    }
    // Initialize editConfigs from server configs
    const editMap: Record<string, string> = {};
    configs.forEach(c => { editMap[c.key] = c.value; });
    setEditConfigs(editMap);
  }, [configs]);

  // Fetch data statistics
  useEffect(() => {
    async function fetchStats() {
      setDbSizeLoading(true);
      try {
        const [itemsRes, salesRes, customersRes, batchesRes] = await Promise.allSettled([
          itemsApi.getItems({ page: 1, size: 1 }),
          salesApi.getSales({ page: 1, size: 1 }),
          customersApi.getCustomers({ page: 1, size: 1 }),
          batchesApi.getBatches({ page: 1, size: 1 }),
        ]);
        setDataStats({
          itemsCount: itemsRes.status === 'fulfilled' ? (itemsRes.value.pagination?.total ?? null) : null,
          salesCount: salesRes.status === 'fulfilled' ? (salesRes.value.pagination?.total ?? null) : null,
          customersCount: customersRes.status === 'fulfilled' ? (customersRes.value.pagination?.total ?? null) : null,
          batchesCount: batchesRes.status === 'fulfilled' ? (batchesRes.value.pagination?.total ?? null) : null,
        });
        // Fetch DB size
        try {
          const sizeRes = await fetch('/api/config');
          const sizeJson = await sizeRes.json();
          if (sizeJson.code === 0) {
            const sizeStr = sizeJson.data?.find?.((c: any) => c.key === 'db_size')?.value;
            if (sizeStr) setDbSize(sizeStr);
          }
        } catch { /* ignore */ }
        // Fetch cleanup counts
        try {
          const [delRes, logRes] = await Promise.allSettled([
            fetch('/api/items/cleanup-deleted'),
            fetch('/api/logs/cleanup-old'),
          ]);
          if (delRes.status === 'fulfilled') {
            const delJson = await delRes.value.json();
            setDeletedItemsCount(delJson.data?.count || 0);
          }
          if (logRes.status === 'fulfilled') {
            const logJson = await logRes.value.json();
            setOldLogsCount(logJson.data?.count || 0);
          }
        } catch { /* ignore */ }
      } catch { /* silently fail */ } finally { setDbSizeLoading(false); }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [m, t, tg, c, s] = await Promise.all([
          dictsApi.getMaterials(true), dictsApi.getTypes(true), dictsApi.getTags(undefined, true),
          configApi.getConfig(), suppliersApi.getSuppliers(),
        ]);
        setMaterials(m || []);
        setTypes(t || []);
        setTags(tg || []);
        setConfigs(c || []);
        setSuppliers(s?.items || []);

        // Fetch additional dicts in background (non-blocking)
        dictsApi.getCrafts(true).then(d => setCrafts(d || [])).catch(() => {});
        dictsApi.getSellingPoints(true).then(d => setSellingPoints(d || [])).catch(() => {});
        dictsApi.getAudiences(true).then(d => setAudiences(d || [])).catch(() => {});
      } catch { toast.error('加载设置数据失败'); } finally { setLoading(false); }
    }
    fetchAll();
  }, []);

  async function toggleMaterialActive(id: number, isActive: boolean) {
    try { await dictsApi.updateMaterial(id, { isActive: !isActive }); setMaterials(m => m.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  async function updateConfig(key: string, value: string) {
    try { await configApi.updateConfig(key, value); setConfigs(c => c.map(x => x.key === key ? { ...x, value } : x)); setEditConfigs(prev => ({ ...prev, [key]: value })); toast.success('配置已更新'); } catch (e: any) { toast.error(e.message); }
  }

  // Supplier handlers
  async function fetchSuppliers() {
    try { const s = await suppliersApi.getSuppliers(); setSuppliers(s?.items || []); } catch { toast.error('加载供应商失败'); }
  }

  async function handleCreateSupplier() {
    try { await suppliersApi.createSupplier(supplierForm); toast.success('供应商创建成功'); setShowCreateSupplier(false); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateSupplier() {
    if (!editSupplier) return;
    try { await suppliersApi.updateSupplier(editSupplier.id, supplierForm); toast.success('供应商更新成功'); setEditSupplier(null); setSupplierForm({ name: '', contact: '', phone: '', notes: '' }); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteSupplier() {
    if (!deleteSupplier) return;
    try { await suppliersApi.deleteSupplier(deleteSupplier.id); toast.success('供应商已删除'); setDeleteSupplier(null); fetchSuppliers(); } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  // Data cleanup handlers
  async function handleCleanupDeleted() {
    setCleanupLoading('deleted');
    try {
      const res = await fetch('/api/items/cleanup-deleted', { method: 'DELETE' });
      const json = await res.json();
      if (json.code === 0) {
        toast.success(`已清除 ${json.data.deleted} 条已删除货品`);
        setDeletedItemsCount(0);
        // Refresh data stats
        const itemsRes = await itemsApi.getItems({ page: 1, size: 1 });
        setDataStats(prev => ({ ...prev, itemsCount: itemsRes.pagination?.total ?? prev.itemsCount }));
      } else {
        toast.error(json.message || '清除失败');
      }
    } catch {
      toast.error('清除已删除货品失败');
    } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'deleted', open: false });
    }
  }

  async function handleCleanupOldLogs() {
    setCleanupLoading('logs');
    try {
      const res = await fetch('/api/logs/cleanup-old', { method: 'DELETE' });
      const json = await res.json();
      if (json.code === 0) {
        toast.success(`已清除 ${json.data.deleted} 条30天前的操作日志`);
        setOldLogsCount(0);
      } else {
        toast.error(json.message || '清除失败');
      }
    } catch {
      toast.error('清除操作日志失败');
    } finally {
      setCleanupLoading(null);
      setCleanupConfirm({ type: 'logs', open: false });
    }
  }

  function openEditSupplierDialog(s: any) {
    setEditSupplier(s);
    setSupplierForm({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', notes: s.notes || '' });
  }

  // Dict handlers
  async function handleCreateMaterial() {
    try { await dictsApi.createMaterial({ ...materialForm, costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined }); toast.success('材质创建成功'); setShowCreateMaterial(false); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateMaterial() {
    if (!editMaterial) return;
    try { await dictsApi.updateMaterial(editMaterial.id, { ...materialForm, costPerGram: materialForm.costPerGram ? parseFloat(materialForm.costPerGram) : undefined }); toast.success('材质更新成功'); setEditMaterial(null); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  function openEditMaterialDialog(m: any) {
    setEditMaterial(m);
    setMaterialForm({ name: m.name || '', category: m.category || '', subType: m.subType || '', origin: m.origin || '', costPerGram: m.costPerGram ? String(m.costPerGram) : '' });
  }

  async function handleCreateType() {
    try {
      await dictsApi.createType({ name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型创建成功');
      setShowCreateType(false);
      setTypeForm({ name: '', specFields: {} });
      const t = await dictsApi.getTypes(true);
      setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateType() {
    if (!editType) return;
    try {
      await dictsApi.updateType(editType.id, { name: typeForm.name, specFields: JSON.stringify(typeForm.specFields) });
      toast.success('器型更新成功');
      setEditType(null);
      setTypeForm({ name: '', specFields: {} });
      const t = await dictsApi.getTypes(true);
      setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteType() {
    if (!deleteType) return;
    try {
      await dictsApi.deleteType(deleteType.id);
      toast.success('器型已删除/停用');
      setDeleteType(null);
      const t = await dictsApi.getTypes(true);
      setTypes(t || []);
    } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  function openEditTypeDialog(t: any) {
    setEditType(t);
    setTypeForm({ name: t.name || '', specFields: parseSpecFields(t.specFields) });
  }

  async function handleCreateTag() {
    try { await dictsApi.createTag(tagForm); toast.success('标签创建成功'); setShowCreateTag(false); setTagForm({ name: '', groupName: '' }); const tg = await dictsApi.getTags(undefined, true); setTags(tg || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateTag() {
    if (!editTag) return;
    try { await dictsApi.updateTag(editTag.id, { name: tagForm.name, groupName: tagForm.groupName || null }); toast.success('标签更新成功'); setEditTag(null); setTagForm({ name: '', groupName: '' }); const tg = await dictsApi.getTags(undefined, true); setTags(tg || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function toggleTagActive(id: number, isActive: boolean) {
    try { await dictsApi.updateTag(id, { isActive: !isActive }); setTags(tg => tg.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function openEditTagDialog(tag: any) {
    setEditTag(tag);
    setTagForm({ name: tag.name || '', groupName: tag.groupName || '' });
  }

  // Craft handlers
  async function handleCreateCraft() {
    try { await dictsApi.createCraft({ ...craftForm, sortOrder: craftForm.sortOrder ? parseInt(craftForm.sortOrder) : 0 }); toast.success('工艺创建成功'); setShowCreateCraft(false); setCraftForm({ name: '', description: '', sortOrder: '' }); const d = await dictsApi.getCrafts(true); setCrafts(d || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateCraft() {
    if (!editCraft) return;
    try { await dictsApi.updateCraft(editCraft.id, { ...craftForm, sortOrder: craftForm.sortOrder ? parseInt(craftForm.sortOrder) : undefined }); toast.success('工艺更新成功'); setEditCraft(null); setCraftForm({ name: '', description: '', sortOrder: '' }); const d = await dictsApi.getCrafts(true); setCrafts(d || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteCraft(id: number) {
    try { await dictsApi.deleteCraft(id); toast.success('工艺已删除/停用'); const d = await dictsApi.getCrafts(true); setCrafts(d || []); } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  async function toggleCraftActive(id: number, isActive: boolean) {
    try { await dictsApi.updateCraft(id, { isActive: !isActive }); setCrafts(c => c.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function openEditCraftDialog(c: any) {
    setEditCraft(c);
    setCraftForm({ name: c.name || '', description: c.description || '', sortOrder: c.sortOrder != null ? String(c.sortOrder) : '' });
  }

  // SellingPoint handlers
  async function handleCreateSellingPoint() {
    try { await dictsApi.createSellingPoint({ ...sellingPointForm, sortOrder: sellingPointForm.sortOrder ? parseInt(sellingPointForm.sortOrder) : 0 }); toast.success('卖点创建成功'); setShowCreateSellingPoint(false); setSellingPointForm({ name: '', sortOrder: '' }); const d = await dictsApi.getSellingPoints(true); setSellingPoints(d || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateSellingPoint() {
    if (!editSellingPoint) return;
    try { await dictsApi.updateSellingPoint(editSellingPoint.id, { ...sellingPointForm, sortOrder: sellingPointForm.sortOrder ? parseInt(sellingPointForm.sortOrder) : undefined }); toast.success('卖点更新成功'); setEditSellingPoint(null); setSellingPointForm({ name: '', sortOrder: '' }); const d = await dictsApi.getSellingPoints(true); setSellingPoints(d || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteSellingPoint(id: number) {
    try { await dictsApi.deleteSellingPoint(id); toast.success('卖点已删除/停用'); const d = await dictsApi.getSellingPoints(true); setSellingPoints(d || []); } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  async function toggleSellingPointActive(id: number, isActive: boolean) {
    try { await dictsApi.updateSellingPoint(id, { isActive: !isActive }); setSellingPoints(sp => sp.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function openEditSellingPointDialog(sp: any) {
    setEditSellingPoint(sp);
    setSellingPointForm({ name: sp.name || '', sortOrder: sp.sortOrder != null ? String(sp.sortOrder) : '' });
  }

  // Audience handlers
  async function handleCreateAudience() {
    try { await dictsApi.createAudience({ ...audienceForm, sortOrder: audienceForm.sortOrder ? parseInt(audienceForm.sortOrder) : 0 }); toast.success('人群创建成功'); setShowCreateAudience(false); setAudienceForm({ name: '', sortOrder: '' }); const d = await dictsApi.getAudiences(true); setAudiences(d || []); } catch (e: any) { toast.error(e.message || '创建失败'); }
  }

  async function handleUpdateAudience() {
    if (!editAudience) return;
    try { await dictsApi.updateAudience(editAudience.id, { ...audienceForm, sortOrder: audienceForm.sortOrder ? parseInt(audienceForm.sortOrder) : undefined }); toast.success('人群更新成功'); setEditAudience(null); setAudienceForm({ name: '', sortOrder: '' }); const d = await dictsApi.getAudiences(true); setAudiences(d || []); } catch (e: any) { toast.error(e.message || '更新失败'); }
  }

  async function handleDeleteAudience(id: number) {
    try { await dictsApi.deleteAudience(id); toast.success('人群已删除/停用'); const d = await dictsApi.getAudiences(true); setAudiences(d || []); } catch (e: any) { toast.error(e.message || '删除失败'); }
  }

  async function toggleAudienceActive(id: number, isActive: boolean) {
    try { await dictsApi.updateAudience(id, { isActive: !isActive }); setAudiences(a => a.map(x => x.id === id ? { ...x, isActive: !isActive } : x)); toast.success(isActive ? '已停用' : '已启用'); } catch (e: any) { toast.error(e.message); }
  }

  function openEditAudienceDialog(a: any) {
    setEditAudience(a);
    setAudienceForm({ name: a.name || '', sortOrder: a.sortOrder != null ? String(a.sortOrder) : '' });
  }

  // Metal reprice handlers
  async function handlePreviewReprice(materialId: number, newPrice: number) {
    try { const result = await metalApi.previewReprice({ materialId, newPricePerGram: newPrice }); setRepricePreview({ ...result, materialId, newPrice }); } catch (e: any) { toast.error(e.message || '预览失败'); }
  }

  async function handleConfirmReprice() {
    if (!repricePreview) return;
    try { await metalApi.confirmReprice({ materialId: repricePreview.materialId, newPricePerGram: repricePreview.newPrice }); toast.success('调价已确认，相关货品已更新'); setRepricePreview(null); const m = await dictsApi.getMaterials(true); setMaterials(m || []); } catch (e: any) { toast.error(e.message || '确认调价失败'); }
  }

  async function handlePriceHistory(materialId: number, materialName: string) {
    try { const h = await metalApi.getPriceHistory({ material_id: materialId }); setPriceHistory(h || []); setPriceHistoryMaterial(materialName); setShowPriceHistory(true); } catch (e: any) { toast.error(e.message || '加载历史失败'); }
  }

  // Import handlers
  function handleFileSelect(file: File) {
    setImportFile(file);
    setImportResult(null);
    // Preview CSV data
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1, 6).map(line => {
          // Simple CSV split (doesn't handle quoted commas, but good enough for preview)
          return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        });
        setPreviewData({ headers, rows });
      } catch {
        toast.error('文件预览失败');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const options = { autoCreate, skipExisting };
      const result = importType === 'items'
        ? await importApi.importItems(importFile, options)
        : await importApi.importSales(importFile, { autoCreate });
      setImportResult(result);
      toast.success(`导入完成: 成功${result.successCount}条, 失败${result.failCount}条`);
    } catch (e: any) {
      toast.error(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  }

  // CSV quick import handler
  function handleDownloadCsvTemplate() {
    const header = '名称,数量,材质,器型,成本价,零售价,柜台,采购日期,产地,证书号,匹配码,备注';
    const example1 = '翡翠手镯,1,翡翠,手镯,5000,8000,1,2024-01-15,缅甸,,A001,好货';
    const example2 = '和田玉吊坠,1,和田玉,吊坠,3000,5500,2,2024-02-20,新疆,CERT001,A002,';
    const example3 = '南红手串,3,南红,手链,800,2500,1,2024-03-10,云南,,A003,热门款';
    const csv = '\uFEFF' + header + '\n' + example1 + '\n' + example2 + '\n' + example3 + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '货品导入模板.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvImport() {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const result = await importApi.importCsvItems(csvFile);
      setCsvResult(result);
      const parts = [`成功${result.success}件`];
      if ((result as any).duplicated > 0) parts.push(`重复跳过${(result as any).duplicated}件`);
      if (result.skipped > 0) parts.push(`跳过${result.skipped}行`);
      if (result.errors.length === 0) {
        toast.success(`CSV导入完成: ${parts.join('，')}`);
      } else {
        toast.warning(`CSV导入完成: ${parts.join('，')}，${result.errors.length}行错误`);
      }
    } catch (e: any) {
      toast.error(e.message || 'CSV导入失败');
    } finally {
      setCsvImporting(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  const tagGroups = tags.reduce((acc: any, tag: any) => {
    const g = tag.groupName || '未分组';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tag);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* ===== Data Overview Section ===== */}
      <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Grid className="h-4 w-4 text-emerald-500" />数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {/* 货品总数 */}
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-emerald-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><Package className="h-3.5 w-3.5 text-emerald-600" /></div>
                <span className="text-xs text-muted-foreground">货品总数</span>
              </div>
              {dbSizeLoading || dataStats.itemsCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{dataStats.itemsCount ?? 0}</p>
              )}
            </div>
            {/* 销售总数 */}
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-sky-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center"><ShoppingCart className="h-3.5 w-3.5 text-sky-600" /></div>
                <span className="text-xs text-muted-foreground">销售总数</span>
              </div>
              {dbSizeLoading || dataStats.salesCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-sky-700 dark:text-sky-400">{dataStats.salesCount ?? 0}</p>
              )}
            </div>
            {/* 客户总数 */}
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-amber-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-amber-600" /></div>
                <span className="text-xs text-muted-foreground">客户总数</span>
              </div>
              {dbSizeLoading || dataStats.customersCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{dataStats.customersCount ?? 0}</p>
              )}
            </div>
            {/* 批次总数 */}
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-teal-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center"><Layers className="h-3.5 w-3.5 text-teal-600" /></div>
                <span className="text-xs text-muted-foreground">批次总数</span>
              </div>
              {dbSizeLoading || dataStats.batchesCount == null ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{dataStats.batchesCount ?? 0}</p>
              )}
            </div>
            {/* 数据库信息 */}
            <div className="p-3 rounded-lg border border-border border-l-4 border-l-violet-500 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center"><Database className="h-3.5 w-3.5 text-violet-600" /></div>
                <span className="text-xs text-muted-foreground">数据库信息</span>
              </div>
              {dbSizeLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{dbSize || '计算中...'}</p>
              )}
              {lastBackupFromStorage && (
                <p className="text-[10px] text-muted-foreground mt-0.5">备份于 {lastBackupFromStorage}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
          <TabsTrigger value="dicts">字典管理</TabsTrigger>
          <TabsTrigger value="metal">贵金属市价</TabsTrigger>
          <TabsTrigger value="suppliers">供应商</TabsTrigger>
          <TabsTrigger value="config">系统配置</TabsTrigger>
          <TabsTrigger value="backup">数据备份</TabsTrigger>
          <TabsTrigger value="import">数据导入</TabsTrigger>
        </TabsList>

        <TabsContent value="dicts" className="mt-4 space-y-4">
          {/* Materials */}
          <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Gem className="h-4 w-4 text-emerald-500" />材质 ({materials.length})</CardTitle><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateMaterial(true); setMaterialForm({ name: '', category: '', subType: '', origin: '', costPerGram: '' }); }}><Plus className="h-3 w-3 mr-1" />新增材质</Button></div></CardHeader>
            <CardContent>
              {/* Material Statistics Info Bar */}
              {(() => {
                const activeMaterials = materials.filter(m => m.isActive);
                const materialsWithSubType = activeMaterials.filter(m => m.subType).length;
                const categoryCount = new Set(activeMaterials.map(m => m.category).filter(Boolean)).size;
                return (
                  <div className="mb-3 p-3 bg-muted/30 rounded-lg flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-muted-foreground">材质总数</span>
                      <span className="font-bold">{activeMaterials.length}种</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-sky-600" />
                      <span className="text-muted-foreground">有子类</span>
                      <span className="font-bold">{materialsWithSubType}种</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-muted-foreground">大类</span>
                      <span className="font-bold">{categoryCount}个</span>
                    </div>
                  </div>
                );
              })()}
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>大类</TableHead><TableHead>子类</TableHead><TableHead>产地</TableHead><TableHead className="text-right">克重单价</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {materials.map(m => (
                      <TableRow key={m.id} className={!m.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{m.category || '-'}</TableCell>
                        <TableCell>{m.subType || '-'}</TableCell>
                        <TableCell>{m.origin || '-'}</TableCell>
                        <TableCell className="text-right">{m.costPerGram ? `¥${m.costPerGram}` : '-'}</TableCell>
                        <TableCell><Badge variant={m.isActive ? 'default' : 'secondary'} className={m.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}>{m.isActive ? '启用' : '停用'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => openEditMaterialDialog(m)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleMaterialActive(m.id, m.isActive)}>{m.isActive ? '停用' : '启用'}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* Types */}
          <Card className="border-l-4 border-l-blue-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Box className="h-4 w-4 text-blue-500" />器型 ({types.length})</CardTitle><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateType(true); setTypeForm({ name: '', specFields: {} }); }}><Plus className="h-3 w-3 mr-1" />新增器型</Button></div></CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>规格字段</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {types.map(t => (
                      <TableRow key={t.id} className={!t.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatSpecFieldsDisplay(t.specFields)}</TableCell>
                        <TableCell><Badge variant={t.isActive ? 'default' : 'secondary'} className={t.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}>{t.isActive ? '启用' : '停用'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => openEditTypeDialog(t)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => {
                              try { await dictsApi.deleteType(t.id); toast.success('器型已删除/停用'); const tp = await dictsApi.getTypes(true); setTypes(tp || []); } catch (e: any) { toast.error(e.message); }
                            }}>{t.isActive ? '停用' : '启用'}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* Crafts */}
          <Card className="border-l-4 border-l-orange-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-500" />工艺 ({crafts.length})</CardTitle><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateCraft(true); setCraftForm({ name: '', description: '', sortOrder: '' }); }}><Plus className="h-3 w-3 mr-1" />新增工艺</Button></div></CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>描述</TableHead><TableHead className="text-right">排序</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {crafts.map(c => (
                      <TableRow key={c.id} className={!c.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.description || '-'}</TableCell>
                        <TableCell className="text-right">{c.sortOrder}</TableCell>
                        <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'} className={c.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}>{c.isActive ? '启用' : '停用'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" onClick={() => openEditCraftDialog(c)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => {
                              try { await handleDeleteCraft(c.id); } catch (e: any) { toast.error(e.message); }
                            }}>{c.isActive ? '停用' : '启用'}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* Tags */}
          <Card className="border-l-4 border-l-purple-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4 text-purple-500" />标签 ({tags.length})</CardTitle><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateTag(true); setTagForm({ name: '', groupName: '' }); }}><Plus className="h-3 w-3 mr-1" />新增标签</Button></div></CardHeader>
            <CardContent>
              {/* Group filter */}
              {Object.keys(tagGroups).length > 1 && (
                <div className="mb-3">
                  <Select value={tagGroupFilter} onValueChange={v => setTagGroupFilter(v === '_all' ? '' : v)}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="全部分组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">全部分组</SelectItem>
                      {Object.keys(tagGroups).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-3">
                {Object.entries(tagGroups)
                  .filter(([group]) => !tagGroupFilter || group === tagGroupFilter)
                  .map(([group, groupTags]: [string, any]) => (
                  <div key={group}>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {groupTags.map((tag: any) => (
                        <div key={tag.id} className="group relative">
                          <Badge
                            variant={tag.isActive ? 'default' : 'secondary'}
                            className={`${tag.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'opacity-50'} cursor-pointer pr-6`}
                            onClick={() => openEditTagDialog(tag)}
                            title="点击编辑"
                          >
                            {tag.name}
                          </Badge>
                          <Button
                            size="sm" variant="ghost"
                            className="absolute -top-1 -right-1 h-4 w-4 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); toggleTagActive(tag.id, tag.isActive); }}
                            title={tag.isActive ? '停用' : '启用'}
                          >
                            {tag.isActive ? <span className="text-[10px]">✕</span> : <span className="text-[10px]">✓</span>}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metal" className="mt-4">
          <Card className="border-l-4 border-l-amber-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-500" />贵金属市价管理</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">当前配置了克重单价的材质，市价变动时可批量重算在库货品零售价。</p>
              <div className="space-y-3">
                {materials.filter(m => m.costPerGram).map(m => (
                  <div key={m.id} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{m.name}{m.subType ? ` (${m.subType})` : ''}</p>
                        <p className="text-sm text-muted-foreground">当前: ¥{m.costPerGram}/克</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-28 h-8 text-sm" placeholder="新单价" id={`metal-price-${m.id}`}
                          onBlur={async (e) => {
                            const val = parseFloat(e.target.value);
                            if (val && val !== m.costPerGram) {
                              try { await metalApi.updatePrice({ materialId: m.id, pricePerGram: val }); setMaterials(ms => ms.map(x => x.id === m.id ? { ...x, costPerGram: val } : x)); toast.success(`${m.name}市价已更新为 ¥${val}/克`); } catch (e: any) { toast.error(e.message); }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        const input = document.getElementById(`metal-price-${m.id}`) as HTMLInputElement;
                        const val = input ? parseFloat(input.value) : 0;
                        if (val && val > 0) { handlePreviewReprice(m.id, val); }
                        else { toast.error('请先输入新单价'); }
                      }}><Calculator className="h-3 w-3 mr-1" />预览调价</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePriceHistory(m.id, m.name)}><History className="h-3 w-3 mr-1" />历史记录</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card className="border-l-4 border-l-teal-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Factory className="h-4 w-4 text-teal-500" />供应商 ({suppliers.length})</CardTitle><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => { setShowCreateSupplier(true); setSupplierForm({ name: '', contact: '', notes: '' }); }}><Plus className="h-3 w-3 mr-1" />新增供应商</Button></div></CardHeader>
            <CardContent>
              {/* Supplier Search */}
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="搜索名称、联系人、电话..."
                    value={supplierSearch}
                    onChange={e => setSupplierSearch(e.target.value)}
                    className="h-9 pl-8 pr-8"
                  />
                  {supplierSearch && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setSupplierSearch('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {debouncedSupplierSearch.trim() && (
                  <p className="text-xs text-muted-foreground mt-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    找到 <span className="font-medium text-foreground">{(() => {
                      const q = debouncedSupplierSearch.trim().toLowerCase();
                      return suppliers.filter((s: any) => (s.name || '').toLowerCase().includes(q) || (s.contact || '').toLowerCase().includes(q) || (s.phone || '').toLowerCase().includes(q)).length;
                    })()}</span> 个供应商
                  </p>
                )}
              </div>
              {suppliers.length === 0 ? (
                <EmptyState icon={Factory} title="暂无供应商" desc="还没有添加任何供应商" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(() => {
                    const q = debouncedSupplierSearch.trim().toLowerCase();
                    const filtered = q ? suppliers.filter((s: any) => (s.name || '').toLowerCase().includes(q) || (s.contact || '').toLowerCase().includes(q) || (s.phone || '').toLowerCase().includes(q)) : suppliers;
                    return filtered.length === 0 ? (
                      <div className="col-span-full text-center text-sm text-muted-foreground py-8">无匹配的供应商</div>
                    ) : filtered.map((s: any) => (
                    <div key={s.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{s.name}</p>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-amber-600" onClick={() => openEditSupplierDialog(s)} title="编辑"><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => setDeleteSupplier(s)} title="删除"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      {s.contact && <p className="text-sm text-muted-foreground">{s.contact}</p>}
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 transition-colors">
                          <Phone className="h-3 w-3" />{s.phone}
                        </a>
                      )}
                      {s.notes && <p className="text-sm text-muted-foreground truncate">{s.notes}</p>}
                    </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Card className="border-l-4 border-l-gray-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4 text-gray-500" />系统配置</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* System Config (localStorage + server sync for store_name) */}
                <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800 space-y-3">
                  <p className="font-medium text-sm flex items-center gap-2"><Settings className="h-4 w-4 text-violet-600" />系统配置</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">店铺名称</Label>
                      <Input value={systemConfig.storeName} onChange={e => setSystemConfig(c => ({ ...c, storeName: e.target.value }))} onBlur={() => {
                        // Sync store name to server config
                        const serverVal = configs.find(c => c.key === 'store_name')?.value;
                        if (systemConfig.storeName !== serverVal) {
                          updateConfig('store_name', systemConfig.storeName);
                        }
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(systemConfig));
                      }} className="h-8 text-sm" placeholder="翡翠珠宝" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">默认货币符号</Label>
                      <Input value={systemConfig.currencySymbol} onChange={e => setSystemConfig(c => ({ ...c, currencySymbol: e.target.value }))} className="h-8 text-sm w-24" placeholder="¥" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">利润预警阈值 (%)</Label>
                      <Input type="number" value={systemConfig.profitWarningThreshold} onChange={e => setSystemConfig(c => ({ ...c, profitWarningThreshold: parseInt(e.target.value) || 30 }))} className="h-8 text-sm w-24" min="0" max="100" />
                      <p className="text-[10px] text-muted-foreground">低于此比例的利润将触发预警</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">压货天数阈值 (天)</Label>
                      <Input type="number" value={systemConfig.lowStockDays} onChange={e => setSystemConfig(c => ({ ...c, lowStockDays: parseInt(e.target.value) || 90 }))} className="h-8 text-sm w-24" min="1" />
                      <p className="text-[10px] text-muted-foreground">超过此天数未售出将标记为压货</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">默认利润率 (%)</Label>
                      <Input type="number" value={systemConfig.defaultProfitRate} onChange={e => setSystemConfig(c => ({ ...c, defaultProfitRate: parseInt(e.target.value) || 40 }))} className="h-8 text-sm w-24" min="0" max="100" />
                      <p className="text-[10px] text-muted-foreground">新建货品时的默认利润率</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => {
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(systemConfig));
                      // Sync store name to server
                      const serverVal = configs.find(c => c.key === 'store_name')?.value;
                      if (systemConfig.storeName !== serverVal) {
                        updateConfig('store_name', systemConfig.storeName);
                      }
                      toast.success('设置已保存');
                    }}>
                      <CheckCircle className="h-3 w-3 mr-1" />保存设置
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                      const defaults = { storeName: '翡翠珠宝', currencySymbol: '¥', lowStockDays: 90, profitWarningThreshold: 30, defaultProfitRate: 40 };
                      setSystemConfig(defaults);
                      localStorage.removeItem(STORAGE_KEY);
                      toast.success('已恢复默认设置');
                    }}>
                      恢复默认
                    </Button>
                  </div>
                </div>
                {/* Server-side configs — fully editable */}
                {configs.map(c => {
                  const editValue = editConfigs[c.key] ?? c.value;
                  const isNumeric = ['operating_cost_rate', 'markup_rate', 'warning_days', 'aging_threshold_days'].includes(c.key);
                  const isPassword = c.key === 'admin_password';
                  return (
                  <div key={c.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{c.description || c.key}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type={isPassword ? 'password' : isNumeric ? 'number' : 'text'}
                        value={editValue}
                        onChange={e => setEditConfigs(prev => ({ ...prev, [c.key]: e.target.value }))}
                        onBlur={() => {
                          if (editValue !== c.value) {
                            updateConfig(c.key, editValue);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className={isNumeric ? 'w-24 h-8 text-sm text-right' : 'w-40 h-8 text-sm'}
                        step={isNumeric ? 'any' : undefined}
                      />
                      {c.key === 'warning_days' && <span className="text-sm text-muted-foreground">天</span>}
                      {c.key === 'operating_cost_rate' && <span className="text-sm text-muted-foreground whitespace-nowrap">({(parseFloat(editValue) * 100).toFixed(0)}%)</span>}
                      {c.key === 'markup_rate' && <span className="text-sm text-muted-foreground whitespace-nowrap">({(parseFloat(editValue) * 100).toFixed(0)}%)</span>}
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-4 space-y-4">
          {/* Data Statistics Card */}
          <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Grid className="h-4 w-4 text-emerald-500" />数据统计</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Package className="h-3.5 w-3.5" />
                    <span className="text-xs">货品总数</span>
                  </div>
                  <p className="text-lg font-bold">{dataStats.itemsCount ?? '...'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span className="text-xs">销售总数</span>
                  </div>
                  <p className="text-lg font-bold">{dataStats.salesCount ?? '...'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs">客户总数</span>
                  </div>
                  <p className="text-lg font-bold">{dataStats.customersCount ?? '...'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs">批次总数</span>
                  </div>
                  <p className="text-lg font-bold">{dataStats.batchesCount ?? '...'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center col-span-2 md:col-span-1">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Database className="h-3.5 w-3.5" />
                    <span className="text-xs">数据库</span>
                  </div>
                  <p className="text-sm font-medium">SQLite</p>
                  {lastBackupFromStorage && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      上次备份: {lastBackupFromStorage}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download backup */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-red-500" />备份数据库</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">下载当前数据库文件（SQLite），可用于数据迁移或定期备份。</p>
              {/* 最近备份时间卡片 */}
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">最近备份时间</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lastBackupFromStorage ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{formatRelativeTime(lastBackupFromStorage)}</span>
                      <span className="text-xs text-muted-foreground">({lastBackupFromStorage})</span>
                    </span>
                  ) : (
                    <span className="italic">尚未备份</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700" asChild onClick={() => {
                  const nowIso = new Date().toISOString();
                  const nowDisplay = new Date().toLocaleString('zh-CN');
                  setLastBackupTime(nowDisplay);
                  setLastBackupFromStorage(nowDisplay);
                  localStorage.setItem('last_backup_time', nowIso);
                  setTimeout(() => {
                    // Estimate file size after download starts
                    toast.success('备份下载已开始');
                  }, 100);
                }}>
                  <a href={backupApi.download()} download>
                    <Download className="h-4 w-4 mr-2" />下载数据库备份
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Restore backup */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-red-500" />恢复数据库</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">从备份文件恢复数据库。恢复前会自动保存当前数据库为安全副本。</p>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">⚠️ 恢复操作将覆盖当前所有数据，请谨慎操作！</p>
              </div>
              <div className="flex items-center gap-3">
                <Input type="file" accept=".db" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setRestoreFile(f); setShowRestoreConfirm(true); }
                }} className="max-w-xs" />
                {restoring && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
              </div>
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-red-400" />数据说明</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• 数据库为 SQLite 单文件，包含所有业务数据（货品、销售、客户等）</p>
                <p>• 图片文件需单独备份（<code className="px-1 py-0.5 bg-muted rounded text-xs">public/images/</code> 目录）</p>
                <p>• Docker 部署时，数据和图片已挂载到本地 <code className="px-1 py-0.5 bg-muted rounded text-xs">./data/</code> 目录</p>
                <p>• 建议定期下载备份，特别是进行大批量操作前</p>
              </div>
            </CardContent>
          </Card>

          {/* Data Cleanup Section */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />数据清理</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">清理不必要的数据，释放数据库空间。此操作不可撤销，请谨慎执行。</p>
              <div className="space-y-3">
                {/* Clear deleted items */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">清除已删除货品</p>
                      <p className="text-xs text-muted-foreground">彻底删除标记为删除的货品记录</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deletedItemsCount > 0 && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{deletedItemsCount} 条</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                      disabled={deletedItemsCount === 0 || cleanupLoading === 'deleted'}
                      onClick={() => setCleanupConfirm({ type: 'deleted', open: true })}
                    >
                      {cleanupLoading === 'deleted' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      清除
                    </Button>
                  </div>
                </div>
                {/* Clear old logs */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">清除操作日志(30天前)</p>
                      <p className="text-xs text-muted-foreground">删除超过30天的历史操作日志</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {oldLogsCount > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{oldLogsCount} 条</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                      disabled={oldLogsCount === 0 || cleanupLoading === 'logs'}
                      onClick={() => setCleanupConfirm({ type: 'logs', open: true })}
                    >
                      {cleanupLoading === 'logs' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      清除
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cleanup Confirm Dialog */}
          <AlertDialog open={cleanupConfirm.open} onOpenChange={open => setCleanupConfirm(prev => ({ ...prev, open }))}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认数据清理</AlertDialogTitle>
                <AlertDialogDescription>
                  {cleanupConfirm.type === 'deleted'
                    ? `确定要彻底删除 ${deletedItemsCount} 条已标记删除的货品记录吗？此操作不可撤销。`
                    : `确定要清除 ${oldLogsCount} 条超过30天的操作日志吗？此操作不可撤销。`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCleanupConfirm(prev => ({ ...prev, open: false }))}>取消</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => cleanupConfirm.type === 'deleted' ? handleCleanupDeleted() : handleCleanupOldLogs()}
                  disabled={cleanupLoading !== null}
                >
                  {cleanupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  确认清理
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
        <TabsContent value="import" className="mt-4 space-y-4">
          {/* CSV Quick Import (P0 production requirement) */}
          <Card className="border-l-4 border-l-emerald-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-500" />
                CSV批量导入货品
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">推荐</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">快速导入存量货品。<b>必填列: 名称</b>。选填列: 数量(默认1,同一货品创建N件)、SKU(留空自动生成)、材质(按名称匹配,不存在则自动创建)、器型(按名称匹配,不存在则自动创建)、成本价(单价)、零售价、柜台、采购日期、产地、证书号、匹配码(用于关联销售导入)、备注。名称+成本价+证书号相同的货品自动跳过不重复导入。</p>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleDownloadCsvTemplate}>
                  <FileDown className="h-3.5 w-3.5 mr-1" />模板下载
                </Button>
              </div>
              {/* Drag & Drop Upload Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  csvDragOver
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.01]'
                    : 'border-muted-foreground/25 hover:border-emerald-300 hover:bg-muted/30'
                }`}
                onClick={() => document.getElementById('csv-import-input')?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setCsvDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setCsvDragOver(false); }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCsvDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f && f.name.endsWith('.csv')) {
                    setCsvFile(f);
                    setCsvResult(null);
                  } else {
                    toast.error('请上传CSV文件');
                  }
                }}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 transition-colors ${csvDragOver ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
                <p className="text-sm font-medium mb-1">拖拽CSV文件到此处或点击上传</p>
                <p className="text-xs text-muted-foreground">仅支持 .csv 格式（UTF-8编码，含BOM）</p>
                <input
                  id="csv-import-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setCsvFile(f); setCsvResult(null); }
                  }}
                />
              </div>
              {/* Selected file info */}
              {csvFile && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">{csvFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => { setCsvFile(null); setCsvResult(null); }}>×</Button>
                </div>
              )}
              {/* Import button */}
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!csvFile || csvImporting}
                onClick={handleCsvImport}
              >
                {csvImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {csvImporting ? '正在导入...' : '开始导入'}
              </Button>
              {/* Import results */}
              {csvResult && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium">导入结果</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">成功: {csvResult.success}件</span>
                    </div>
                    {(csvResult.duplicated ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">重复跳过: {csvResult.duplicated}件</span>
                      </div>
                    )}
                    {csvResult.skipped > 0 && (
                      <div className="flex items-center gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">跳过: {csvResult.skipped}行</span>
                      </div>
                    )}
                    {csvResult.errors.length > 0 && (
                      <div className="flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">错误: {csvResult.errors.length}行</span>
                      </div>
                    )}
                  </div>
                  {/* Auto-created materials/types */}
                  {csvResult.autoCreated && (csvResult.autoCreated.materials.length > 0 || csvResult.autoCreated.types.length > 0) && (
                    <div className="p-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                      <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">自动创建的字典项</p>
                      {csvResult.autoCreated.materials.length > 0 && (
                        <p className="text-xs text-violet-600">材质: {csvResult.autoCreated.materials.join('、')}</p>
                      )}
                      {csvResult.autoCreated.types.length > 0 && (
                        <p className="text-xs text-violet-600">器型: {csvResult.autoCreated.types.join('、')}</p>
                      )}
                    </div>
                  )}
                  {/* Inferred fields */}
                  {csvResult.inferred && csvResult.inferred.length > 0 && (
                    <div className="p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-300 mb-1">从名称推断的字段 (共{csvResult.inferred.length}处)</p>
                      <div className="max-h-20 overflow-y-auto">
                        {csvResult.inferred.slice(0, 10).map((inf, i) => (
                          <p key={i} className="text-xs text-sky-600">第{inf.row}行: 推断{inf.field}={inf.value}</p>
                        ))}
                        {csvResult.inferred.length > 10 && (
                          <p className="text-xs text-muted-foreground">...还有 {csvResult.inferred.length - 10} 处</p>
                        )}
                      </div>
                    </div>
                  )}
                  {csvResult.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      <div className="space-y-1">
                        {csvResult.errors.slice(0, 20).map((err, i) => (
                          <p key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1">{err}</p>
                        ))}
                        {csvResult.errors.length > 20 && (
                          <p className="text-xs text-muted-foreground text-center">...还有 {csvResult.errors.length - 20} 条错误</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import type selector */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-red-500" />数据批量导入</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">上传CSV文件批量导入库存或销售数据。支持自动创建缺失的材质/器型/标签。</p>
              <div className="flex items-center gap-4 mb-4">
                <Label className="text-sm font-medium">导入类型</Label>
                <Select value={importType} onValueChange={(v: 'items' | 'sales') => { setImportType(v); setImportFile(null); setImportResult(null); setPreviewData(null); }}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="items">库存数据</SelectItem>
                    <SelectItem value="sales">销售数据</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
                  <a href={importApi.downloadTemplate(importType)} download>
                    <FileDown className="h-3.5 w-3.5 mr-1" />下载模板
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File upload area */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-red-500" />选择文件</CardTitle></CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('import-file-input')?.click()}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files[0];
                  if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) {
                    handleFileSelect(f);
                  } else {
                    toast.error('请上传CSV文件');
                  }
                }}
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">点击或拖拽CSV文件到此处上传</p>
                <p className="text-xs text-muted-foreground">支持 .csv 格式（UTF-8编码）</p>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
              {importFile && (
                <div className="mt-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">{importFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(importFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => { setImportFile(null); setPreviewData(null); }}>×</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data preview */}
          {previewData && (
            <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileDown className="h-4 w-4 text-red-500" />数据预览（前5行）</CardTitle></CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        {previewData.headers.map((h, i) => (
                          <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.rows.map((row, ri) => (
                        <TableRow key={ri}>
                          <TableCell className="text-xs text-center text-muted-foreground">{ri + 1}</TableCell>
                          {row.map((cell, ci) => (
                            <TableCell key={ci} className="text-xs whitespace-nowrap max-w-32 truncate">{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options */}
          <Card className="border-l-4 border-l-red-400 hover:shadow-sm transition-shadow duration-200">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4 text-red-500" />导入选项</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={autoCreate}
                    onCheckedChange={(checked) => setAutoCreate(!!checked)}
                  />
                  <div>
                    <p className="text-sm font-medium">自动创建缺失的材质/器型/标签</p>
                    <p className="text-xs text-muted-foreground">关闭后，遇到不存在的材质或器型时将跳过该行</p>
                  </div>
                </label>
                {importType === 'items' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={skipExisting}
                      onCheckedChange={(checked) => setSkipExisting(!!checked)}
                    />
                    <div>
                      <p className="text-sm font-medium">SKU已存在时跳过</p>
                      <p className="text-xs text-muted-foreground">关闭后，遇到已存在的SKU将更新该货品信息</p>
                    </div>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import button */}
          <div className="flex items-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!importFile || importing}
              onClick={handleImport}
            >
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing ? '正在导入...' : '开始导入'}
            </Button>
            {importFile && !importing && (
              <p className="text-sm text-muted-foreground">
                即将导入 <span className="font-medium text-foreground">{importType === 'items' ? '库存' : '销售'}</span> 数据
              </p>
            )}
          </div>

          {/* Import result */}
          {importResult && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">导入结果</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">成功: {importResult.successCount}条</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">失败: {importResult.failCount}条</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">总计: {importResult.total}条</span>
                  </div>
                </div>
                {importResult.results && importResult.results.filter((r: any) => !r.success).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 text-red-600">失败详情：</p>
                    <div className="max-h-64 overflow-y-auto border rounded-lg custom-scrollbar">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-14">行号</TableHead><TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead>失败原因</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {importResult.results.filter((r: any) => !r.success).map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-center">{r.row}</TableCell>
                              <TableCell className="text-xs font-mono">{r.skuCode || '-'}</TableCell>
                              <TableCell className="text-xs">{r.name || '-'}</TableCell>
                              <TableCell className="text-xs text-red-600">{r.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={() => {
                        const failed = importResult.results.filter((r: any) => !r.success);
                        const csv = ['行号,SKU,名称,失败原因', ...failed.map((r: any) => `${r.row},${r.skuCode || ''},${r.name || ''},${r.error || ''}`)].join('\n');
                        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `导入失败记录_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />下载失败记录
                    </Button>
                  </div>
                )}
                {importResult.results && importResult.results.filter((r: any) => r.success).length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      查看成功记录（{importResult.results.filter((r: any) => r.success).length}条）
                    </summary>
                    <div className="max-h-48 overflow-y-auto border rounded-lg mt-2 custom-scrollbar">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-14">行号</TableHead><TableHead>SKU</TableHead><TableHead>名称</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {importResult.results.filter((r: any) => r.success).map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-center">{r.row}</TableCell>
                              <TableCell className="text-xs font-mono">{r.skuCode || '-'}</TableCell>
                              <TableCell className="text-xs">{r.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {/* Help card */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-sky-600" />导入说明</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• 请先下载模板，按模板格式填写数据后再上传</p>
                <p>• CSV文件需使用 <code className="px-1 py-0.5 bg-muted rounded text-xs">UTF-8</code> 编码，Excel另存为CSV时选择"CSV UTF-8"</p>
                <p>• <b>库存导入</b>必填字段：名称；选填数量(默认1)、材质、器型、成本价(单价)、匹配码等；材质/器型可从名称自动推断</p>
                <p>• <b>销售导入</b>必填字段：名称或SKU编号、成交价；如SKU不存在则按匹配码→名称+成本价匹配，匹配不到自动创建已售货品</p>
                <p>• <b>匹配码</b>用于关联库存和销售数据：在库存CSV和销售CSV中使用相同的匹配码，系统自动关联</p>
                <p>• 开启"自动创建"后，系统会自动创建CSV中提到但字典中不存在的材质、器型</p>
                <p>• 名称+成本价+证书号相同的库存货品自动跳过不重复导入</p>
                <p>• 建议先少量测试导入，确认无误后再大批量导入</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Supplier Dialog */}
      <Dialog open={showCreateSupplier} onOpenChange={setShowCreateSupplier}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="供应商名称" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} placeholder="联系人姓名" /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="手机号码" /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSupplier(false)}>取消</Button>
            <Button onClick={handleCreateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={editSupplier !== null} onOpenChange={open => { if (!open) setEditSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑供应商</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>联系人</Label><Input value={supplierForm.contact} onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))} /></div>
              <div className="space-y-1"><Label><span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />电话</span></Label><Input value={supplierForm.phone} onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>取消</Button>
            <Button onClick={handleUpdateSupplier} className="bg-emerald-600 hover:bg-emerald-700" disabled={!supplierForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Supplier Confirm Dialog */}
      <Dialog open={deleteSupplier !== null} onOpenChange={open => { if (!open) setDeleteSupplier(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除供应商「{deleteSupplier?.name}」吗？此操作不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSupplier(null)}>取消</Button>
            <Button onClick={handleDeleteSupplier} className="bg-red-600 hover:bg-red-700">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Material Dialog */}
      <Dialog open={showCreateMaterial} onOpenChange={setShowCreateMaterial}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增材质</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 和田玉" /></div>
            <div className="space-y-1"><Label>大类</Label>
              <Select value={materialForm.category} onValueChange={v => setMaterialForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>子类</Label><Input value={materialForm.subType} onChange={e => setMaterialForm(f => ({ ...f, subType: e.target.value }))} placeholder="如: 籽料、山料" list="subTypeOptions" /></div>
            <div className="space-y-1"><Label>产地</Label><Input value={materialForm.origin} onChange={e => setMaterialForm(f => ({ ...f, origin: e.target.value }))} placeholder="如: 新疆" list="originOptions" /></div>
            <div className="space-y-1"><Label>克重单价</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} placeholder="如: 500" /></div>
          </div>
          {/* Datalists for auto-suggest */}
          <datalist id="subTypeOptions">
            <option value="籽料" /><option value="山料" /><option value="山流水" /><option value="戈壁料" />
            <option value="k999" /><option value="k990" /><option value="k916" /><option value="k750" /><option value="pt950" /><option value="pt900" />
            <option value="天然" /><option value="养殖" />
          </datalist>
          <datalist id="originOptions">
            <option value="缅甸" /><option value="新疆和田" /><option value="青海" /><option value="俄罗斯" /><option value="国内" />
            <option value="巴西" /><option value="斯里兰卡" /><option value="印度" /><option value="哥伦比亚" />
          </datalist>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateMaterial(false)}>取消</Button>
            <Button onClick={handleCreateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Material Dialog */}
      <Dialog open={editMaterial !== null} onOpenChange={open => { if (!open) setEditMaterial(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑材质</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={materialForm.name} onChange={e => setMaterialForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>大类</Label>
              <Select value={materialForm.category} onValueChange={v => setMaterialForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="选择大类" /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>子类</Label><Input value={materialForm.subType} onChange={e => setMaterialForm(f => ({ ...f, subType: e.target.value }))} list="subTypeOptionsEdit" /></div>
            <div className="space-y-1"><Label>产地</Label><Input value={materialForm.origin} onChange={e => setMaterialForm(f => ({ ...f, origin: e.target.value }))} list="originOptionsEdit" /></div>
            <div className="space-y-1"><Label>克重单价</Label><Input type="number" value={materialForm.costPerGram} onChange={e => setMaterialForm(f => ({ ...f, costPerGram: e.target.value }))} /></div>
          </div>
          <datalist id="subTypeOptionsEdit">
            <option value="籽料" /><option value="山料" /><option value="山流水" /><option value="戈壁料" />
            <option value="k999" /><option value="k990" /><option value="k916" /><option value="k750" /><option value="pt950" /><option value="pt900" />
            <option value="天然" /><option value="养殖" />
          </datalist>
          <datalist id="originOptionsEdit">
            <option value="缅甸" /><option value="新疆和田" /><option value="青海" /><option value="俄罗斯" /><option value="国内" />
            <option value="巴西" /><option value="斯里兰卡" /><option value="印度" /><option value="哥伦比亚" />
          </datalist>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMaterial(null)}>取消</Button>
            <Button onClick={handleUpdateMaterial} className="bg-emerald-600 hover:bg-emerald-700" disabled={!materialForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Type Dialog - Checkbox style */}
      <Dialog open={showCreateType} onOpenChange={setShowCreateType}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增器型</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 手镯" /></div>
            <div className="space-y-2">
              <Label>规格字段</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {SPEC_FIELD_OPTIONS.map(field => {
                  const isChecked = field.key in typeForm.specFields;
                  const isRequired = typeForm.specFields[field.key]?.required ?? false;
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <Checkbox
                        id={`spec-${field.key}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setTypeForm(f => {
                            const newFields = { ...f.specFields };
                            if (checked) {
                              newFields[field.key] = { required: false };
                            } else {
                              delete newFields[field.key];
                            }
                            return { ...f, specFields: newFields };
                          });
                        }}
                      />
                      <Label htmlFor={`spec-${field.key}`} className="text-sm flex-1 cursor-pointer">{field.label}</Label>
                      {isChecked && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={isRequired}
                            onCheckedChange={(checked) => {
                              setTypeForm(f => ({
                                ...f,
                                specFields: {
                                  ...f.specFields,
                                  [field.key]: { required: !!checked },
                                },
                              }));
                            }}
                          />
                          必填
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">勾选需要的规格字段，并标记是否必填</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateType(false)}>取消</Button>
            <Button onClick={handleCreateType} className="bg-emerald-600 hover:bg-emerald-700" disabled={!typeForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Type Dialog */}
      <Dialog open={editType !== null} onOpenChange={open => { if (!open) setEditType(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑器型</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 手镯" /></div>
            <div className="space-y-2">
              <Label>规格字段</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {SPEC_FIELD_OPTIONS.map(field => {
                  const isChecked = field.key in typeForm.specFields;
                  const isRequired = typeForm.specFields[field.key]?.required ?? false;
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <Checkbox
                        id={`edit-spec-${field.key}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          setTypeForm(f => {
                            const newFields = { ...f.specFields };
                            if (checked) {
                              newFields[field.key] = { required: false };
                            } else {
                              delete newFields[field.key];
                            }
                            return { ...f, specFields: newFields };
                          });
                        }}
                      />
                      <Label htmlFor={`edit-spec-${field.key}`} className="text-sm flex-1 cursor-pointer">{field.label}</Label>
                      {isChecked && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={isRequired}
                            onCheckedChange={(checked) => {
                              setTypeForm(f => ({
                                ...f,
                                specFields: {
                                  ...f.specFields,
                                  [field.key]: { required: !!checked },
                                },
                              }));
                            }}
                          />
                          必填
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">勾选需要的规格字段，并标记是否必填</p>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-sm">状态</span>
              <Button size="sm" variant={editType?.isActive ? 'outline' : 'default'} className={editType?.isActive ? 'text-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={async () => {
                if (!editType) return;
                try { await dictsApi.deleteType(editType.id); toast.success(editType.isActive ? '已停用' : '已启用'); const tp = await dictsApi.getTypes(true); setTypes(tp || []); setEditType(null); } catch (e: any) { toast.error(e.message); }
              }}>{editType?.isActive ? '停用' : '启用'}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditType(null)}>取消</Button>
            <Button onClick={handleUpdateType} className="bg-emerald-600 hover:bg-emerald-700" disabled={!typeForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Type Confirm Dialog */}
      <Dialog open={deleteType !== null} onOpenChange={open => { if (!open) setDeleteType(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除</DialogTitle><DialogDescription>确定要删除器型「{deleteType?.name}」吗？此操作不可恢复。</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteType(null)}>取消</Button>
            <Button onClick={handleDeleteType} className="bg-red-600 hover:bg-red-700">确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={showCreateTag} onOpenChange={setShowCreateTag}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增标签</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 限定款" /></div>
            <div className="space-y-1"><Label>分组</Label>
              {Object.keys(tagGroups).filter(g => g !== '未分组').length > 0 ? (
                <div className="flex gap-2">
                  <Select value={tagForm.groupName} onValueChange={v => setTagForm(f => ({ ...f, groupName: v === '_custom' ? '' : v }))}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="选择分组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_custom">自定义...</SelectItem>
                      {Object.keys(tagGroups).filter(g => g !== '未分组').map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(!tagForm.groupName || !Object.keys(tagGroups).includes(tagForm.groupName)) && (
                    <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" className="flex-1" />
                  )}
                </div>
              ) : (
                <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTag(false)}>取消</Button>
            <Button onClick={handleCreateTag} className="bg-emerald-600 hover:bg-emerald-700" disabled={!tagForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={editTag !== null} onOpenChange={open => { if (!open) setEditTag(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑标签</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>分组</Label>
              {Object.keys(tagGroups).filter(g => g !== '未分组').length > 0 ? (
                <div className="flex gap-2">
                  <Select value={tagForm.groupName} onValueChange={v => setTagForm(f => ({ ...f, groupName: v === '_custom' ? '' : v }))}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="选择分组" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_custom">自定义...</SelectItem>
                      {Object.keys(tagGroups).filter(g => g !== '未分组').map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(!tagForm.groupName || !Object.keys(tagGroups).includes(tagForm.groupName)) && (
                    <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} placeholder="如: 风格" className="flex-1" />
                  )}
                </div>
              ) : (
                <Input value={tagForm.groupName} onChange={e => setTagForm(f => ({ ...f, groupName: e.target.value }))} />
              )}
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-sm">状态</span>
              <Button size="sm" variant={editTag?.isActive ? 'outline' : 'default'} className={editTag?.isActive ? 'text-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={() => { if (editTag) toggleTagActive(editTag.id, editTag.isActive); }}>{editTag?.isActive ? '停用' : '启用'}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTag(null)}>取消</Button>
            <Button onClick={handleUpdateTag} className="bg-emerald-600 hover:bg-emerald-700" disabled={!tagForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Craft Dialog */}
      <Dialog open={showCreateCraft} onOpenChange={setShowCreateCraft}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增工艺</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={craftForm.name} onChange={e => setCraftForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 手工雕刻" /></div>
            <div className="space-y-1"><Label>描述</Label><Input value={craftForm.description} onChange={e => setCraftForm(f => ({ ...f, description: e.target.value }))} placeholder="工艺描述" /></div>
            <div className="space-y-1"><Label>排序</Label><Input type="number" value={craftForm.sortOrder} onChange={e => setCraftForm(f => ({ ...f, sortOrder: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCraft(false)}>取消</Button>
            <Button onClick={handleCreateCraft} className="bg-emerald-600 hover:bg-emerald-700" disabled={!craftForm.name}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Craft Dialog */}
      <Dialog open={editCraft !== null} onOpenChange={open => { if (!open) setEditCraft(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑工艺</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>名称 *</Label><Input value={craftForm.name} onChange={e => setCraftForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>描述</Label><Input value={craftForm.description} onChange={e => setCraftForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label>排序</Label><Input type="number" value={craftForm.sortOrder} onChange={e => setCraftForm(f => ({ ...f, sortOrder: e.target.value }))} /></div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-sm">状态</span>
              <Button size="sm" variant={editCraft?.isActive ? 'outline' : 'default'} className={editCraft?.isActive ? 'text-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'} onClick={() => { if (editCraft) toggleCraftActive(editCraft.id, editCraft.isActive); }}>{editCraft?.isActive ? '停用' : '启用'}</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCraft(null)}>取消</Button>
            <Button onClick={handleUpdateCraft} className="bg-emerald-600 hover:bg-emerald-700" disabled={!craftForm.name}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprice Preview Dialog */}
      <Dialog open={repricePreview !== null} onOpenChange={open => { if (!open) setRepricePreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>调价预览</DialogTitle><DialogDescription>以下货品将受影响</DialogDescription></DialogHeader>
          {repricePreview && (
            <div className="space-y-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm">
                <p>新单价: <span className="font-bold text-emerald-600">¥{repricePreview.newPrice}/克</span></p>
                <p>影响货品: <span className="font-bold">{repricePreview.affectedItems?.length || 0} 件</span></p>
              </div>
              {repricePreview.affectedItems && repricePreview.affectedItems.length > 0 ? (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>名称</TableHead><TableHead className="text-right">原价</TableHead><TableHead className="text-right">新价</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {repricePreview.affectedItems.map((item: any) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-mono text-xs">{item.skuCode}</TableCell>
                          <TableCell className="text-sm">{item.name || '-'}</TableCell>
                          <TableCell className="text-right text-sm">{formatPrice(item.oldPrice)}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-emerald-600">{formatPrice(item.newPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">没有受影响的在库货品</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepricePreview(null)}>取消</Button>
            <Button onClick={handleConfirmReprice} className="bg-emerald-600 hover:bg-emerald-700" disabled={!repricePreview?.affectedItems?.length}>确认调价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirm Dialog */}
      <Dialog open={showRestoreConfirm} onOpenChange={open => { if (!open) { setShowRestoreConfirm(false); setRestoreFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认恢复数据库</DialogTitle><DialogDescription>即将用文件「{restoreFile?.name}」覆盖当前数据库。恢复前会自动保存当前数据库为安全副本。</DialogDescription></DialogHeader>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">⚠️ 此操作将覆盖当前所有数据！恢复后需要刷新页面。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRestoreConfirm(false); setRestoreFile(null); }}>取消</Button>
            <Button onClick={async () => {
              if (!restoreFile) return;
              setRestoring(true);
              try {
                await backupApi.restore(restoreFile);
                toast.success('数据库恢复成功，页面将在3秒后刷新');
                setShowRestoreConfirm(false);
                setRestoreFile(null);
                setTimeout(() => window.location.reload(), 3000);
              } catch (e: any) {
                toast.error(e.message || '恢复失败');
              } finally {
                setRestoring(false);
              }
            }} className="bg-red-600 hover:bg-red-700" disabled={restoring}>
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              确认恢复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={showPriceHistory} onOpenChange={setShowPriceHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>价格历史 - {priceHistoryMaterial}</DialogTitle></DialogHeader>
          {priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无历史记录</p>
          ) : (
            <div className="max-h-72 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader><TableRow><TableHead>日期</TableHead><TableHead className="text-right">单价(元/克)</TableHead><TableHead>操作人</TableHead></TableRow></TableHeader>
                <TableBody>
                  {priceHistory.map((h: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{h.effectiveDate || h.createdAt?.slice(0, 10) || '-'}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">¥{h.pricePerGram}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.updatedBy || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowPriceHistory(false)}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SettingsTab;
export { SPEC_FIELD_LABEL_MAP, MATERIAL_CATEGORIES, parseSpecFields, formatSpecFieldsDisplay };
