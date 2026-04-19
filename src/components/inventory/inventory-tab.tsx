'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { itemsApi, salesApi, dictsApi, batchesApi, exportApi, customersApi } from '@/lib/api';
import { CustomerSearchSelect } from './customer-search-select';
import { itemsApiEnhanced } from '@/lib/api';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { formatPrice, StatusBadge, EmptyState, LoadingSkeleton, ConfirmDialog } from './shared';
import ItemCreateDialog from './item-create-dialog';
import ItemDetailDialog from './item-detail-dialog';
import ItemEditDialog from './item-edit-dialog';
import LabelPrintDialog from './label-print-dialog';
// BarcodeScanner loaded dynamically when scanner dialog opens (avoids html5-qrcode chunk loading at tab load)
import ImageLightbox from './image-lightbox';
import { MATERIAL_CATEGORIES } from './settings-tab';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Package, CheckCircle, DollarSign, BarChart3, Plus, Search, Eye,
  Pencil, DollarSign as DollarSignIcon, RotateCcw, Trash2, FileDown, Barcode, Printer, ArrowUp, ArrowDown, ArrowUpDown, Camera, Layers,
  ShoppingCart, Tag, MapPin, X, Gem, CheckSquare, ChevronDown, ChevronUp, SlidersHorizontal,
  Info, FileText, FileCheck, CalendarDays, Target, MoreHorizontal, Copy, FileSpreadsheet, Loader2, Clock,
  CircleDot,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// ========== Tag Color Map ==========
const TAG_COLOR_PALETTE = [
  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
];
const TAG_COLOR_CACHE: Record<string, string> = {};
function getTagColor(tagName: string): string {
  if (!TAG_COLOR_CACHE[tagName]) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash += tagName.charCodeAt(i);
    }
    TAG_COLOR_CACHE[tagName] = TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
  }
  return TAG_COLOR_CACHE[tagName];
}

// ========== Active Filter Tags Component ==========
function ActiveFilterTags({ filters, materials, allBatches, allCounters, onClearAll, onClear }: {
  filters: { materialCategory: string; materialId: string; status: string; keyword: string; counter: string; batchId: string; minPrice: string; maxPrice: string; purchaseStartDate: string; purchaseEndDate: string };
  materials: any[];
  allBatches: any[];
  allCounters: number[];
  onClearAll: () => void;
  onClear: (key: string) => void;
}) {
  // Build active tags
  const tags: { key: string; label: string }[] = [];
  if (filters.keyword) tags.push({ key: 'keyword', label: `关键词: ${filters.keyword}` });
  if (filters.materialCategory) {
    const cat = MATERIAL_CATEGORIES.find(c => c.value === filters.materialCategory);
    tags.push({ key: 'materialCategory', label: cat?.label || filters.materialCategory });
  }
  if (filters.materialId) {
    const mat = materials.find((m: any) => String(m.id) === filters.materialId);
    tags.push({ key: 'materialId', label: mat?.name || filters.materialId });
  }
  if (filters.counter) tags.push({ key: 'counter', label: `${filters.counter}号柜` });
  if (filters.batchId) {
    const batch = allBatches.find((b: any) => String(b.id) === filters.batchId);
    tags.push({ key: 'batchId', label: batch?.batchCode || filters.batchId });
  }
  if (filters.minPrice) tags.push({ key: 'minPrice', label: `最低价: ¥${filters.minPrice}` });
  if (filters.maxPrice) tags.push({ key: 'maxPrice', label: `最高价: ¥${filters.maxPrice}` });
  if (filters.purchaseStartDate) tags.push({ key: 'purchaseStartDate', label: `采购起始: ${filters.purchaseStartDate}` });
  if (filters.purchaseEndDate) tags.push({ key: 'purchaseEndDate', label: `采购截止: ${filters.purchaseEndDate}` });

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs px-2 py-0.5">
        筛选中 ({tags.length})
      </Badge>
      {tags.map(tag => (
        <button
          key={tag.key}
          onClick={() => onClear(tag.key)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted/80 hover:bg-muted text-foreground transition-colors group"
        >
          <span>{tag.label}</span>
          <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
      >
        清除全部
      </button>
    </div>
  );
}

// ========== Inventory Tab ==========
function InventoryTab() {
  const { setActiveTab } = useAppStore();
  const [items, setItems] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, size: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ materialCategory: '', materialId: '', status: '', keyword: '', counter: '', batchId: '', minPrice: '', maxPrice: '', purchaseStartDate: '', purchaseEndDate: '', priorityTier: '', shootingStatus: '', contentStatus: '' });
  const [searchField, setSearchField] = useState('all');
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(['in_stock']));
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [detailItemId, setDetailItemId] = useState<number | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [returnConfirmItem, setReturnConfirmItem] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [saleDialog, setSaleDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [saleForm, setSaleForm] = useState({ actualPrice: 0, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
  const [scanSku, setScanSku] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [printLabelItem, setPrintLabelItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerComponent, setScannerComponent] = useState<React.ComponentType<any> | null>(null);

  // Open scanner - dynamic import of local barcode-scanner component
  async function openScanner() {
    if (!scannerComponent) {
      try {
        const mod = await import('@/components/inventory/barcode-scanner');
        setScannerComponent(() => mod.default || mod.BarcodeScanner);
      } catch {
        toast.error('扫码组件加载失败，请刷新页面重试');
        return;
      }
    }
    setShowScanner(true);
  }

  // Batch operation dialogs
  const [batchSellOpen, setBatchSellOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchPriceOpen, setBatchPriceOpen] = useState(false);
  const [batchCounterOpen, setBatchCounterOpen] = useState(false);

  // Batch sell form
  const [batchSellForm, setBatchSellForm] = useState({ channel: 'store', saleDate: new Date().toISOString().slice(0, 10), useCurrentPrice: true, customerId: '' });
  const [customers, setCustomers] = useState<any[]>([]);

  // Batch delete options
  const [batchDeleteHard, setBatchDeleteHard] = useState(false);

  // Batch price adjust form
  const [batchPriceForm, setBatchPriceForm] = useState({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' as 'increase' | 'decrease' });

  // Batch counter form
  const [batchCounterForm, setBatchCounterForm] = useState({ counter: '' });

  // Batch operation loading state
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Batch sell individual prices
  const [batchSellPrices, setBatchSellPrices] = useState<Record<number, number>>({});

  // Batch label print dialog
  const [batchLabelPrintOpen, setBatchLabelPrintOpen] = useState(false);

  // Delete confirmation dialog
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any>(null);

  // Slide-in detail panel
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Image lightbox gallery
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ id: number; url: string; isCover?: boolean }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => { dictsApi.getMaterials().then(setMaterials).catch(() => {}); }, []);
  useEffect(() => { customersApi.getCustomers().then((d: any) => setCustomers(d?.items || d || [])).catch(() => {}); }, []);
  useEffect(() => { batchesApi.getBatches({ page: 1, size: 1000 }).then(d => setAllBatches(d.items || [])).catch(() => {}); }, []);

  // Listen for escape key to close detail panel
  useEffect(() => {
    const handler = () => setSelectedItemId(null);
    window.addEventListener('escape-press', handler);
    return () => window.removeEventListener('escape-press', handler);
  }, []);

  // Listen for shortcut-new-item to open create dialog
  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener('shortcut-new-item', handler);
    return () => window.removeEventListener('shortcut-new-item', handler);
  }, []);

  // Listen for shortcut-export to trigger CSV export
  useEffect(() => {
    const handler = () => handleExportCSV();
    window.addEventListener('shortcut-export', handler);
    return () => window.removeEventListener('shortcut-export', handler);
  }, [handleExportCSV]);

  // Extract unique counters from loaded items
  const allCounters = useMemo(() => {
    const counterSet = new Set<number>();
    items.forEach(i => { if (i.counter != null) counterSet.add(i.counter); });
    return Array.from(counterSet).sort((a, b) => a - b);
  }, [items]);

  // Status counts for filter buttons
  const statusCounts = useMemo(() => ({
    in_stock: items.filter(i => i.status === 'in_stock').length,
    sold: items.filter(i => i.status === 'sold').length,
    returned: items.filter(i => i.status === 'returned').length,
  }), [items]);

  // Toggle status filter
  function toggleStatusFilter(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  // Client-side filter for price range, purchase date, and multi-status (applied after server fetch)
  const filteredItems = useMemo(() => {
    let result = items;
    // Multi-status filter
    if (activeStatuses.size > 0 && activeStatuses.size < 3) {
      result = result.filter(i => activeStatuses.has(i.status));
    }
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!isNaN(min)) result = result.filter(i => (i.sellingPrice || 0) >= min);
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!isNaN(max)) result = result.filter(i => (i.sellingPrice || 0) <= max);
    }
    if (filters.purchaseStartDate) {
      result = result.filter(i => (i.purchaseDate || '') >= filters.purchaseStartDate);
    }
    if (filters.purchaseEndDate) {
      result = result.filter(i => (i.purchaseDate || '') <= filters.purchaseEndDate);
    }
    return result;
  }, [items, activeStatuses, filters.minPrice, filters.maxPrice, filters.purchaseStartDate, filters.purchaseEndDate]);

  // Client-side sort for table display
  const sortedItems = useMemo(() => {
    if (!filteredItems.length) return filteredItems;
    const sorted = [...filteredItems];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'selling_price':
          cmp = (a.sellingPrice || 0) - (b.sellingPrice || 0);
          break;
        case 'cost_price':
          cmp = (a.allocatedCost || a.estimatedCost || a.costPrice || 0) - (b.allocatedCost || b.estimatedCost || b.costPrice || 0);
          break;
        case 'purchase_date':
          cmp = (a.purchaseDate || '').localeCompare(b.purchaseDate || '');
          break;
        case 'sku_code':
          cmp = (a.skuCode || '').localeCompare(b.skuCode || '');
          break;
        case 'name':
          cmp = (a.name || a.skuCode || '').localeCompare(b.name || b.skuCode || '');
          break;
        case 'created_at':
        default:
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredItems, sortBy, sortOrder]);

  // 根据大类筛选材质
  const filteredMaterials = materials.filter((m: any) => {
    if (!filters.materialCategory) return true;
    return m.category === filters.materialCategory;
  });

  // Selected items (memoized)
  const selectedItems = useMemo(() => filteredItems.filter(i => selectedIds.has(i.id)), [filteredItems, selectedIds]);

  // Only in_stock items among selected
  const selectedInStockItems = useMemo(() => selectedItems.filter(i => i.status === 'in_stock'), [selectedItems]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, size: pagination.size };
      if (filters.materialId) params.material_id = filters.materialId;
      // Status: only send if exactly one active status; otherwise fetch all and filter client-side
      if (activeStatuses.size === 1) params.status = Array.from(activeStatuses)[0];
      if (filters.keyword) {
        params.keyword = filters.keyword;
        if (searchField !== 'all') params.search_field = searchField;
      }
      if (filters.counter) params.counter = filters.counter;
      if (filters.batchId) params.batch_id = filters.batchId;
      if (filters.priorityTier) params.priorityTier = filters.priorityTier;
      if (filters.shootingStatus) params.shootingStatus = filters.shootingStatus;
      if (filters.contentStatus) params.contentStatus = filters.contentStatus;
      params.sort_by = sortBy;
      params.sort_order = sortOrder;
      const data = await itemsApi.getItems(params);
      setItems(data.items || []);
      setPagination(data.pagination || { total: 0, page: 1, size: 20, pages: 0 });
    } catch {
      toast.error('加载库存失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.size, filters, activeStatuses, sortBy, sortOrder, searchField]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Clear selection when page/filters change
  useEffect(() => { setSelectedIds(new Set()); }, [pagination.page, filters, activeStatuses, sortBy, sortOrder]);

  // Selection handlers
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ========== Image Lightbox Gallery ==========
  const galleryImages = useMemo(() => {
    return sortedItems
      .filter((item: any) => item.coverImage)
      .map((item: any, idx: number) => ({ id: idx, url: item.coverImage, isCover: true, itemId: item.id, skuCode: item.skuCode }));
  }, [sortedItems]);

  function openLightbox(itemId: number) {
    const idx = galleryImages.findIndex((img: any) => img.itemId === itemId);
    if (idx >= 0) {
      setLightboxImages(galleryImages);
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  }

  async function handleSale() {
    if (!saleDialog.item) return;
    if (!saleForm.actualPrice || isNaN(saleForm.actualPrice) || saleForm.actualPrice <= 0) {
      toast.error('请输入有效的成交价');
      return;
    }
    if (!saleForm.saleDate) {
      toast.error('请选择销售日期');
      return;
    }
    try {
      const salePayload: any = { itemId: saleDialog.item.id, actualPrice: saleForm.actualPrice, channel: saleForm.channel, saleDate: saleForm.saleDate, note: saleForm.note };
      if (saleForm.customerId) salePayload.customerId = Number(saleForm.customerId);
      await salesApi.createSale(salePayload);
      toast.success('出库成功！');
      setSaleDialog({ open: false, item: null });
      fetchItems();
    } catch (e: any) { toast.error(e.message || '出库失败'); }
  }

  async function handleDelete(id: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setDeleteConfirmItem(item);
  }

  async function confirmDelete() {
    if (!deleteConfirmItem) return;
    try {
      await itemsApi.deleteItem(deleteConfirmItem.id);
      toast.success('删除成功');
      setDeleteConfirmItem(null);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  }

  async function handleReturn() {
    if (!returnConfirmItem.item) return;
    try {
      await itemsApi.updateItem(returnConfirmItem.item.id, { status: 'returned' });
      toast.success('退货成功！');
      setReturnConfirmItem({ open: false, item: null });
      fetchItems();
    } catch (e: any) { toast.error(e.message || '退货失败'); }
  }

  async function handleScanSku() {
    if (!scanSku.trim()) return;
    setScanLoading(true);
    try {
      const item = await itemsApi.lookupBySku(scanSku.trim());
      if (item.status === 'in_stock') {
        setSaleDialog({ open: true, item });
        setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
        setScanSku('');
      } else {
        toast.error(`货品 ${item.skuCode} 当前状态为「${item.status === 'sold' ? '已售' : item.status === 'returned' ? '已退' : item.status}」，无法出库`);
      }
    } catch {
      toast.error('未找到该SKU对应的货品');
    } finally {
      setScanLoading(false);
    }
  }

  async function handleBarcodeScan(code: string) {
    setShowScanner(false);
    setScanLoading(true);
    try {
      const item = await itemsApi.lookupBySku(code.trim());
      if (item.status === 'in_stock') {
        setSaleDialog({ open: true, item });
        setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' });
      } else {
        toast.error(`货品 ${item.skuCode} 当前状态为「${item.status === 'sold' ? '已售' : item.status === 'returned' ? '已退' : item.status}」，无法出库`);
      }
    } catch {
      toast.error(`未找到条码「${code}」对应的货品`);
    } finally {
      setScanLoading(false);
    }
  }

  function toggleSortOrder() {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  }

  // ========== CSV Export ==========
  function handleExportCSV() {
    if (sortedItems.length === 0) {
      toast.error('没有可导出的数据');
      return;
    }
    const statusMap: Record<string, string> = { in_stock: '在库', sold: '已售', returned: '已退' };
    const header = 'SKU,名称,器型,材质,状态,成本,售价,采购日期,柜台号';
    const rows = sortedItems.map(item => {
      const name = item.name || item.skuCode;
      const typeName = item.typeName || '';
      const materialName = item.materialName || '';
      const status = statusMap[item.status] || item.status;
      const cost = item.allocatedCost || item.estimatedCost || item.costPrice || 0;
      const sellingPrice = item.sellingPrice || 0;
      const purchaseDate = item.purchaseDate || '';
      const counter = item.counter || '';
      // Escape commas/quotes in CSV
      const escape = (v: string) => {
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };
      return [item.skuCode, escape(name), escape(typeName), escape(materialName), status, cost, sellingPrice, purchaseDate, counter].join(',');
    });
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `库存数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${sortedItems.length} 条库存数据`);
  }

  // ========== Excel Export (HTML table approach) ==========
  function handleExportExcel() {
    if (sortedItems.length === 0) {
      toast.error('没有可导出的数据');
      return;
    }
    const statusMap: Record<string, string> = { in_stock: '在库', sold: '已售', returned: '已退' };
    const headers = ['SKU', '名称', '器型', '材质', '状态', '成本', '售价', '采购日期', '柜台号', '证书号'];
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>库存数据</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
    html += '<body><table border="1" cellspacing="0" cellpadding="4">';
    html += '<tr style="background-color:#059669;color:#fff;font-weight:bold">';
    headers.forEach(h => { html += `<td>${h}</td>`; });
    html += '</tr>';
    sortedItems.forEach(item => {
      html += '<tr>';
      html += `<td>${item.skuCode || ''}</td>`;
      html += `<td>${item.name || ''}</td>`;
      html += `<td>${item.typeName || ''}</td>`;
      html += `<td>${item.materialName || ''}</td>`;
      html += `<td>${statusMap[item.status] || item.status || ''}</td>`;
      html += `<td>${item.allocatedCost || item.estimatedCost || item.costPrice || 0}</td>`;
      html += `<td>${item.sellingPrice || 0}</td>`;
      html += `<td>${item.purchaseDate || ''}</td>`;
      html += `<td>${item.counter != null ? item.counter : ''}</td>`;
      html += `<td>${item.certNo || ''}</td>`;
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `库存数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出Excel ${sortedItems.length} 条库存数据`);
  }

  // ========== Batch Operations ==========

  async function handleBatchSell() {
    if (selectedInStockItems.length === 0) {
      toast.error('没有可出库的在库货品');
      return;
    }
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedInStockItems.length });
    let successCount = 0;
    let failCount = 0;
    const selectedCustomer = customers.find((c: any) => String(c.id) === batchSellForm.customerId);
    const customerName = selectedCustomer?.name || '';
    for (let i = 0; i < selectedInStockItems.length; i++) {
      const item = selectedInStockItems[i];
      setBatchProgress({ current: i + 1, total: selectedInStockItems.length });
      try {
        const price = batchSellForm.useCurrentPrice
          ? item.sellingPrice
          : (batchSellPrices[item.id] ?? item.sellingPrice);
        await salesApi.createSale({
          itemId: item.id,
          actualPrice: price,
          channel: batchSellForm.channel,
          saleDate: batchSellForm.saleDate,
          customerId: batchSellForm.customerId ? Number(batchSellForm.customerId) : undefined,
          note: `批量出库${customerName ? ` - ${customerName}` : ''}`,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchSellOpen(false);
    setBatchSellPrices({});
    setBatchSellForm(f => ({ ...f, customerId: '' }));
    clearSelection();
    fetchItems();
    if (failCount === 0) {
      toast.success(`批量出库成功！共 ${successCount} 件`);
    } else {
      toast.warning(`批量出库完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  async function handleBatchDelete() {
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedItems.length });
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      setBatchProgress({ current: i + 1, total: selectedItems.length });
      try {
        await itemsApi.deleteItem(item.id, batchDeleteHard);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchDeleteOpen(false);
    setBatchDeleteHard(false);
    clearSelection();
    fetchItems();
    if (failCount === 0) {
      toast.success(`批量删除成功！共 ${successCount} 件${batchDeleteHard ? '（彻底删除）' : '（标记删除）'}`);
    } else {
      toast.warning(`批量删除完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  async function handleBatchPriceAdjust() {
    const adjustValue = parseFloat(batchPriceForm.value);
    if (isNaN(adjustValue) || adjustValue < 0) {
      toast.error('请输入有效的调整值（正数）');
      return;
    }
    setBatchLoading(true);
    try {
      const result = await itemsApiEnhanced.batchPriceAdjust({
        ids: Array.from(selectedIds).map(String),
        adjustmentType: batchPriceForm.mode as 'percentage' | 'fixed',
        value: adjustValue,
        direction: batchPriceForm.direction,
      });
      setBatchLoading(false);
      setBatchProgress(null);
      setBatchPriceOpen(false);
      setBatchPriceForm({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' });
      clearSelection();
      fetchItems();
      if (result.errors && result.errors.length > 0) {
        toast.warning(`批量调价完成：成功 ${result.success} 件，${result.errors.length} 件失败`);
      } else {
        toast.success(`批量调价成功！共 ${result.success} 件`);
      }
    } catch (e: any) {
      setBatchLoading(false);
      toast.error(e.message || '批量调价失败');
    }
  }

  async function handleBatchCounter() {
    const counter = parseInt(batchCounterForm.counter);
    if (isNaN(counter)) {
      toast.error('请输入有效的柜台号');
      return;
    }
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: selectedItems.length });
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      setBatchProgress({ current: i + 1, total: selectedItems.length });
      try {
        await itemsApi.updateItem(item.id, { counter: String(counter) });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchLoading(false);
    setBatchProgress(null);
    setBatchCounterOpen(false);
    setBatchCounterForm({ counter: '' });
    clearSelection();
    fetchItems();
    if (failCount === 0) {
      toast.success(`批量修改柜台成功！共 ${successCount} 件`);
    } else {
      toast.warning(`批量修改柜台完成：成功 ${successCount} 件，失败 ${failCount} 件`);
    }
  }

  // Price preview for batch adjust
  const pricePreview = useMemo(() => {
    const adjustValue = parseFloat(batchPriceForm.value);
    if (isNaN(adjustValue)) return [];
    return selectedItems.slice(0, 10).map(item => {
      const field = batchPriceForm.target === 'sellingPrice' ? 'sellingPrice' : 'minimumPrice';
      const oldPrice = item[field] || 0;
      let newPrice: number;
      if (batchPriceForm.mode === 'percent') {
        newPrice = batchPriceForm.direction === 'increase'
          ? Math.round(oldPrice * (1 + adjustValue / 100))
          : Math.round(oldPrice * (1 - adjustValue / 100));
      } else {
        newPrice = batchPriceForm.direction === 'increase'
          ? Math.round(oldPrice + adjustValue)
          : Math.round(oldPrice - adjustValue);
      }
      newPrice = Math.max(0, newPrice);
      return { id: item.id, name: item.name || item.skuCode, sku: item.skuCode, oldPrice, newPrice };
    });
  }, [selectedItems, batchPriceForm]);

  function SortableHead({ field, children, align }: { field: string; children: React.ReactNode; align?: 'left' | 'right' }) {
    const isActive = sortBy === field;
    return (
      <TableHead
        className={`${align === 'right' ? 'text-right' : ''} cursor-pointer select-none hover:bg-muted/50 transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
        onClick={() => {
          if (sortBy === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
          } else {
            setSortBy(field);
            setSortOrder('desc');
          }
        }}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {children}
          {isActive ? (
            sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </div>
      </TableHead>
    );
  }

  if (loading && items.length === 0) return <LoadingSkeleton />;

  const totalValue = filteredItems.reduce((sum, i) => sum + (i.allocatedCost || i.estimatedCost || i.costPrice || 0), 0);

  const sortFieldLabels: Record<string, string> = {
    created_at: '入库时间',
    selling_price: '售价',
    cost_price: '成本',
    purchase_date: '采购日期',
    sku_code: 'SKU编号',
    name: '名称',
  };

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="space-y-6">
      {/* Scan-to-Sell */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Barcode className="h-4 w-4 text-emerald-600" />
            <Input
              placeholder="扫码/输入SKU快速出库"
              value={scanSku}
              onChange={e => setScanSku(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleScanSku(); }}
              className="h-9 flex-1"
              disabled={scanLoading}
            />
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={handleScanSku} disabled={scanLoading || !scanSku.trim()}>
              {scanLoading ? '查询中...' : '出库'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 md:hidden border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3"
              onClick={openScanner}
              disabled={scanLoading}
            >
              <Camera className="h-4 w-4 mr-1" /> 扫码
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 hidden md:flex border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={openScanner}
              disabled={scanLoading}
              title="摄像头扫码"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 hover:shadow-md hover:border-emerald-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><Package className="h-16 w-16 text-emerald-500" /></div>
            <p className="text-sm text-muted-foreground">总库存</p><p className="text-2xl font-bold">{pagination.total}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md hover:border-sky-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><CheckCircle className="h-16 w-16 text-sky-500" /></div>
            <p className="text-sm text-muted-foreground">在库中</p><p className="text-2xl font-bold text-emerald-600">{items.filter(i => i.status === 'in_stock').length}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 hover:shadow-md hover:border-amber-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><DollarSign className="h-16 w-16 text-amber-500" /></div>
            <p className="text-sm text-muted-foreground">库存价值</p><p className="text-2xl font-bold text-emerald-600">{formatPrice(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-md hover:border-purple-400 transition-all duration-200">
          <CardContent className="p-4">
            <div className="absolute -right-1 -bottom-1 opacity-10"><BarChart3 className="h-16 w-16 text-purple-500" /></div>
            <p className="text-sm text-muted-foreground">当前页</p><p className="text-2xl font-bold">{pagination.page}/{pagination.pages || 1}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Actions */}
      <Card>
        <CardContent className="p-4">
          {/* Status Filter Toggle Buttons */}
          <div className="flex items-center gap-2 mb-3">
            <CircleDot className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">状态筛选</span>
            {[
              { key: 'in_stock', label: '在库', activeClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600', count: statusCounts.in_stock },
              { key: 'sold', label: '已售', activeClass: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500', count: statusCounts.sold },
              { key: 'returned', label: '已退', activeClass: 'bg-red-500 hover:bg-red-600 text-white border-red-500', count: statusCounts.returned },
            ].map(s => {
              const isActive = activeStatuses.has(s.key);
              return (
                <Button
                  key={s.key}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={`h-7 text-xs px-3 rounded-full transition-all duration-150 ${isActive ? s.activeClass : ''}`}
                  onClick={() => toggleStatusFilter(s.key)}
                >
                  {s.label}
                  <Badge variant="secondary" className={`ml-1.5 h-4 min-w-[18px] px-1 text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {s.count}
                  </Badge>
                </Button>
              );
            })}
            {activeStatuses.size === 0 && (
              <span className="text-xs text-muted-foreground ml-1">显示全部状态</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
            <div className="space-y-1 relative">
              <Label className="text-xs">关键词</Label>
              <div className="relative flex gap-1.5">
                <Select value={searchField} onValueChange={setSearchField}>
                  <SelectTrigger className="w-20 h-9 text-xs shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="name">名称</SelectItem>
                    <SelectItem value="material">材质</SelectItem>
                    <SelectItem value="type">器型</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Input placeholder={searchField === 'all' ? 'SKU/名称/证书' : searchField === 'sku' ? '搜索SKU...' : searchField === 'name' ? '搜索名称...' : searchField === 'material' ? '搜索材质...' : '搜索器型...'} value={filters.keyword} onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} className="h-9 pr-8" />
                {filters.keyword && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      setFilters(f => ({ ...f, keyword: '' }));
                      const input = document.querySelector('input[placeholder*="SKU"]') as HTMLInputElement;
                      if (input) input.focus();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                </div>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">材质大类</Label>
              <Select value={filters.materialCategory || '_all'} onValueChange={v => {
                const cat = v === '_all' ? '' : v;
                setFilters(f => ({ ...f, materialCategory: cat, materialId: '' }));
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="全部大类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">全部大类</SelectItem>
                  {MATERIAL_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">材质</Label>
              <Select value={filters.materialId || 'all'} onValueChange={v => setFilters(f => ({ ...f, materialId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="全部材质" /></SelectTrigger>
                <SelectContent><SelectItem value="all">全部材质</SelectItem>{filteredMaterials.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">状态</Label>
              <Select value={activeStatuses.size === 1 ? Array.from(activeStatuses)[0] : activeStatuses.size === 0 ? 'all' : 'multi'} onValueChange={v => { if (v === 'all') setActiveStatuses(new Set()); else setActiveStatuses(new Set([v])); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="in_stock">在库</SelectItem><SelectItem value="sold">已售</SelectItem><SelectItem value="returned">已退</SelectItem><SelectItem value="multi" disabled>多选(用上方按钮)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">柜台</Label>
              <Select value={filters.counter || 'all'} onValueChange={v => setFilters(f => ({ ...f, counter: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部柜台</SelectItem>
                  {allCounters.map(c => <SelectItem key={c} value={String(c)}>{c}号柜</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">批次</Label>
              <Select value={filters.batchId || 'all'} onValueChange={v => setFilters(f => ({ ...f, batchId: v === 'all' ? '' : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="全部批次" /></SelectTrigger>
                <SelectContent><SelectItem value="all">全部批次</SelectItem>{allBatches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => { setPagination(p => ({ ...p, page: 1 })); fetchItems(); }} className="h-9"><Search className="h-3 w-3 mr-1" />搜索</Button>
              <Button size="sm" variant="outline" onClick={() => { setFilters({ materialCategory: '', materialId: '', status: '', keyword: '', counter: '', batchId: '', minPrice: '', maxPrice: '', purchaseStartDate: '', purchaseEndDate: '', priorityTier: '', shootingStatus: '', contentStatus: '' }); setActiveStatuses(new Set(['in_stock'])); }} className="h-9">重置</Button>
            </div>
          </div>
          {/* More Filters Toggle */}
          <div className="mt-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>更多筛选</span>
              {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {(filters.minPrice || filters.maxPrice || filters.purchaseStartDate || filters.purchaseEndDate) && (
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1.5 py-0">已启用</Badge>
              )}
            </button>
          </div>
          {/* Collapsible More Filters */}
          {showMoreFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 p-3 bg-muted/30 rounded-lg animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <div className="space-y-1"><Label className="text-xs">最低售价</Label><Input type="number" placeholder="¥" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} className="h-9" min="0" /></div>
              <div className="space-y-1"><Label className="text-xs">最高售价</Label><Input type="number" placeholder="¥" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} className="h-9" min="0" /></div>
              <div className="space-y-1"><Label className="text-xs">采购起始日期</Label><Input type="date" value={filters.purchaseStartDate} onChange={e => setFilters(f => ({ ...f, purchaseStartDate: e.target.value }))} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">采购截止日期</Label><Input type="date" value={filters.purchaseEndDate} onChange={e => setFilters(f => ({ ...f, purchaseEndDate: e.target.value }))} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">档位</Label>
                <Select value={filters.priorityTier || 'all'} onValueChange={v => setFilters(f => ({ ...f, priorityTier: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="未定">未定</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">拍摄状态</Label>
                <Select value={filters.shootingStatus || 'all'} onValueChange={v => setFilters(f => ({ ...f, shootingStatus: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="未拍">未拍</SelectItem>
                    <SelectItem value="白底完成">白底完成</SelectItem>
                    <SelectItem value="细节完成">细节完成</SelectItem>
                    <SelectItem value="场景完成">场景完成</SelectItem>
                    <SelectItem value="全套完成">全套完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">内容状态</Label>
                <Select value={filters.contentStatus || 'all'} onValueChange={v => setFilters(f => ({ ...f, contentStatus: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="全部" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="未生产">未生产</SelectItem>
                    <SelectItem value="已生产">已生产</SelectItem>
                    <SelectItem value="已发布">已发布</SelectItem>
                    <SelectItem value="多平台发布">多平台发布</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Active filter tags */}
          <ActiveFilterTags filters={filters} materials={materials} allBatches={allBatches} allCounters={allCounters} onClearAll={() => { setFilters({ materialCategory: '', materialId: '', status: '', keyword: '', counter: '', batchId: '', minPrice: '', maxPrice: '', purchaseStartDate: '', purchaseEndDate: '', priorityTier: '', shootingStatus: '', contentStatus: '' }); setActiveStatuses(new Set(['in_stock'])); }} onClear={(key: string) => setFilters(f => ({ ...f, [key]: '' }))} />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9" onClick={() => setShowCreate(true)}><Plus className="h-3 w-3 mr-1" />新增入库</Button>
              <Button size="sm" variant="outline" className="h-9" onClick={handleExportCSV} disabled={sortedItems.length === 0}><FileDown className="h-3 w-3 mr-1" />导出CSV</Button>
              <Button size="sm" variant="outline" className="h-9" onClick={handleExportExcel} disabled={sortedItems.length === 0}><FileSpreadsheet className="h-3 w-3 mr-1" />导出Excel</Button>
              <a href={exportApi.inventory()} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-9">完整导出</Button>
              </a>
              {/* Mobile Select All */}
              <Button size="sm" variant="outline" className="h-9 md:hidden" onClick={toggleSelectAll}>
                <CheckSquare className="h-3 w-3 mr-1" />
                {isAllSelected ? '取消全选' : '选择全部'}
              </Button>
            </div>
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">排序</Label>
              <Select value={sortBy} onValueChange={v => setSortBy(v)}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(sortFieldLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={toggleSortOrder} title={sortOrder === 'desc' ? '降序' : '升序'}>
                {sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Summary Bar */}
      {!loading && filteredItems.length > 0 && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/50 rounded-lg px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">共 {filteredItems.length} 件</p>
              <p className="text-sm font-medium tabular-nums">{pagination.total} 件总计</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">总货值</p>
              <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                ¥{filteredItems.reduce((s, i) => s + (i.sellingPrice || 0), 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">总成本</p>
              <p className="text-sm font-medium tabular-nums text-amber-600 dark:text-amber-400">
                ¥{filteredItems.reduce((s, i) => s + (i.allocatedCost || i.estimatedCost || i.costPrice || 0), 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">潜在利润</p>
              {(() => {
                const totalValue = filteredItems.reduce((s, i) => s + (i.sellingPrice || 0), 0);
                const totalCost = filteredItems.reduce((s, i) => s + (i.allocatedCost || i.estimatedCost || i.costPrice || 0), 0);
                const profit = totalValue - totalCost;
                return (
                  <p className={`text-sm font-medium tabular-nums ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {profit >= 0 ? '+' : ''}¥{profit.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      {sortedItems.length === 0 ? (
        <EmptyState icon={Package} title="暂无货品" desc="还没有入库任何货品，点击「新增入库」开始" />
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 px-3">
                      <Checkbox
                        checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
                      />
                    </TableHead>
                    <TableHead className="w-12 px-2">图</TableHead>
                    <SortableHead field="sku_code">SKU</SortableHead>
                    <SortableHead field="name">名称</SortableHead>
                    <TableHead>材质</TableHead><TableHead>器型</TableHead><TableHead>所属批次</TableHead>
                    <TableHead>标签</TableHead>
                    <SortableHead field="cost_price" align="right">成本</SortableHead>
                    <SortableHead field="selling_price" align="right">售价</SortableHead>
                    <TableHead className="text-center">毛利</TableHead>
                    <SortableHead field="purchase_date">采购日期</SortableHead>
                    <TableHead>状态</TableHead><TableHead>档位</TableHead><TableHead>拍摄</TableHead><TableHead>内容</TableHead><TableHead>库龄</TableHead><TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item, idx) => (
                    <TableRow key={item.id} className={`group hover:bg-muted/50 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-emerald-400 ${idx % 2 === 1 ? 'even:bg-muted/20' : ''} ${selectedIds.has(item.id) ? 'bg-emerald-50 dark:bg-emerald-950/20 hover:border-l-emerald-500' : item.status === 'sold' ? 'hover:border-l-gray-400' : item.status === 'returned' ? 'hover:border-l-red-400' : ''} cursor-pointer`} onClick={() => setSelectedItemId(item.id)}>
                      <TableCell className="w-10 px-3" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                                      <TableCell className="w-12 px-2" onClick={e => e.stopPropagation()}>
                        {item.coverImage ? (
                          <div className="relative group/img">
                            <button
                              type="button"
                              className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md"
                              onClick={(e) => { e.stopPropagation(); openLightbox(item.id); }}
                            >
                              <Gem className="absolute h-3.5 w-3.5 text-muted-foreground/30 pointer-events-none" style={{ left: '9px', top: '9px' }} />
                              <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-10 h-10 rounded-md object-cover aspect-square bg-muted hover:ring-2 hover:ring-emerald-400 transition-all duration-300 opacity-0" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <Camera className="h-3.5 w-3.5 text-white drop-shadow-md" />
                              </div>
                            </button>
                            <div className="absolute left-14 top-0 z-10 hidden group-hover/img:block pointer-events-none">
                              <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-[200px] h-[200px] rounded-lg object-cover shadow-lg border border-border bg-background" loading="lazy" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted/60 border border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors" title="可添加图片">
                            <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制到剪贴板')).catch(() => toast.error('复制失败')); }}
                          title="点击复制SKU"
                        >
                          {item.skuCode}
                        </button>
                      </TableCell>
                      <TableCell>{item.name || item.skuCode}</TableCell>
                      <TableCell>{item.materialName}</TableCell>
                      <TableCell>{item.typeName || '-'}</TableCell>
                      <TableCell>{item.batchCode ? (
                        <Badge variant="outline" className="cursor-pointer hover:bg-muted font-mono text-xs" onClick={() => { setActiveTab('batches'); }} title="点击查看批次详情">
                          <Layers className="h-2.5 w-2.5 mr-1" />{item.batchCode}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {(() => {
                          const tgs: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
                          const tagLabels: string[] = tgs.map((t: any) => typeof t === 'string' ? t : t.name || '');
                          if (tagLabels.length === 0) return <span className="text-muted-foreground">—</span>;
                          return <div className="flex flex-wrap gap-1 max-w-[160px]">{tagLabels.slice(0, 3).map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className={`text-[10px] h-5 px-1.5 ${getTagColor(t)}`}>{t}</Badge>
                          ))}{tagLabels.length > 3 && <span className="text-[10px] text-muted-foreground">+{tagLabels.length - 3}</span>}</div>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">{item.allocatedCost ? formatPrice(item.allocatedCost) : item.estimatedCost ? <span className="text-muted-foreground" title="预估成本">{formatPrice(item.estimatedCost)}~</span> : formatPrice(item.costPrice)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const cost = item.allocatedCost || item.estimatedCost || item.costPrice || 0;
                          const sp = item.sellingPrice || 0;
                          if (sp === 0 || cost === 0) return <span className="text-xs text-muted-foreground">—</span>;
                          const margin = ((sp - cost) / sp) * 100;
                          const colorClass = margin > 30 ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800' : margin > 10 ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800' : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40 border-red-200 dark:border-red-800';
                          return <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${colorClass}`}>{margin.toFixed(0)}%</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.purchaseDate || '-'}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell>
                        {(() => {
                          const tier = item.priorityTier || '未定';
                          const tierColors: Record<string, string> = {
                            'A': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
                            'B': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
                            'C': 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
                            '未定': 'bg-slate-100 text-slate-500 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800',
                          };
                          return <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${tierColors[tier] || tierColors['未定']}`}>{tier}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">{item.shootingStatus || '未拍'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">{item.contentStatus || '未生产'}</Badge>
                      </TableCell>
                      <TableCell className={item.ageDays > 90 ? 'text-red-600 font-medium' : ''}>{item.ageDays != null ? `${item.ageDays}天` : '-'}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditItemId(item.id); }}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                <span>编辑</span>
                              </DropdownMenuItem>
                              {item.status === 'in_stock' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSaleDialog({ open: true, item }); setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' }); }}>
                                  <ShoppingCart className="h-3.5 w-3.5 mr-2" />
                                  <span>出库</span>
                                </DropdownMenuItem>
                              )}
                              {item.status === 'in_stock' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setReturnConfirmItem({ open: true, item }); }}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                                  <span>退货</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                <span>删除</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制')).catch(() => toast.error('复制失败')); }}>
                                <Copy className="h-3.5 w-3.5 mr-2" />
                                <span>复制SKU</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDetailItemId(item.id); }}>
                                <Eye className="h-3.5 w-3.5 mr-2" />
                                <span>查看详情</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedItems.map(item => (
            <Card key={item.id} className={`hover:shadow-md transition-shadow ${selectedIds.has(item.id) ? 'ring-2 ring-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20' : ''} cursor-pointer`} onClick={() => setSelectedItemId(item.id)}>
              <CardContent className="p-4 space-y-3">
                {/* Header: Thumbnail + Checkbox + SKU + Status */}
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  {item.coverImage ? (
                    <button
                      type="button"
                      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md shrink-0 relative"
                      onClick={(e) => { e.stopPropagation(); openLightbox(item.id); }}
                    >
                      <Gem className="absolute h-4 w-4 text-muted-foreground/30 pointer-events-none" style={{ left: '10px', top: '10px' }} />
                      <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-12 h-12 rounded-md object-cover aspect-square bg-muted hover:ring-2 hover:ring-emerald-400 transition-all opacity-0" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Camera className="h-4 w-4 text-white drop-shadow-md" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-muted/60 border border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors" title="可添加图片">
                      <Plus className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </div>
                      <span
                        className="font-mono text-xs text-muted-foreground hover:text-emerald-600 transition-colors truncate cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制到剪贴板')).catch(() => toast.error('复制失败')); }}
                        title="点击复制SKU"
                      >{item.skuCode}</span>
                    </div>
                    <p className="font-medium text-sm truncate mt-0.5">{item.name || item.skuCode}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {/* Material + Type + Batch */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                  <span>{item.materialName}</span>
                  <span>·</span>
                  <span>{item.typeName || '-'}</span>
                  {item.batchCode && (
                    <>
                      <span>·</span>
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 cursor-pointer hover:bg-muted" onClick={() => setActiveTab('batches')}>
                        <Layers className="h-2 w-2 mr-0.5" />{item.batchCode}
                      </Badge>
                    </>
                  )}
                </div>
                {/* Tags */}
                {(() => {
                  const tgs: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
                  const tagLabels: string[] = tgs.map((t: any) => typeof t === 'string' ? t : t.name || '');
                  if (tagLabels.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {tagLabels.slice(0, 4).map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className={`text-[10px] h-4 px-1.5 ${getTagColor(t)}`}>{t}</Badge>
                      ))}
                      {tagLabels.length > 4 && <span className="text-[10px] text-muted-foreground">+{tagLabels.length - 4}</span>}
                    </div>
                  );
                })()}
                {/* Price row: cost + selling + age */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.allocatedCost
                        ? formatPrice(item.allocatedCost)
                        : item.estimatedCost
                          ? <span className="text-muted-foreground">{formatPrice(item.estimatedCost)}~</span>
                          : formatPrice(item.costPrice)}
                    </span>
                  </div>
                  <span className={`text-xs ${item.ageDays != null && item.ageDays > 90 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{item.ageDays != null ? `${item.ageDays}天` : '-'}</span>
                </div>
                {/* Action buttons with DropdownMenu */}
                <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailItemId(item.id)}><Eye className="h-3 w-3 mr-1" />详情</Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-sky-600" onClick={() => setPrintLabelItem(item)}><Printer className="h-3 w-3 mr-1" />标签</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 px-1.5 text-xs">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setEditItemId(item.id)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /><span>编辑</span>
                      </DropdownMenuItem>
                      {item.status === 'in_stock' && (
                        <DropdownMenuItem onClick={() => { setSaleDialog({ open: true, item }); setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '', customerId: '' }); }}>
                          <ShoppingCart className="h-3.5 w-3.5 mr-2" /><span>出库</span>
                        </DropdownMenuItem>
                      )}
                      {item.status === 'in_stock' && (
                        <DropdownMenuItem onClick={() => setReturnConfirmItem({ open: true, item })}>
                          <RotateCcw className="h-3.5 w-3.5 mr-2" /><span>退货</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /><span>删除</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(item.skuCode || '').then(() => toast.success('SKU已复制')).catch(() => toast.error('复制失败')); }}>
                        <Copy className="h-3.5 w-3.5 mr-2" /><span>复制SKU</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>上一页</Button>
          <span className="text-sm text-muted-foreground">{pagination.page} / {pagination.pages}</span>
          <Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>下一页</Button>
        </div>
      )}

      {/* Floating Bulk Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-emerald-600 dark:bg-emerald-700 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-white whitespace-nowrap">
              已选择 <span className="font-bold text-white">{selectedIds.size}</span> 件货品
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                className="h-7 bg-white text-emerald-700 hover:bg-emerald-50"
                onClick={() => setBatchSellOpen(true)}
                disabled={selectedInStockItems.length === 0}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />批量出库
              </Button>
              <Button
                size="sm"
                className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" />批量删除
              </Button>
              <Button
                size="sm"
                className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
                onClick={() => setBatchPriceOpen(true)}
              >
                <Tag className="h-3 w-3 mr-1" />批量调价
              </Button>
              <Button
                size="sm"
                className="h-7 bg-white/15 text-white hover:bg-white/25 border border-white/30"
                onClick={() => setBatchLabelPrintOpen(true)}
              >
                <Printer className="h-3 w-3 mr-1" />批量标签打印
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-white/80 hover:text-white hover:bg-white/10"
                onClick={clearSelection}
              >
                取消选择
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Dialog */}
      <Dialog open={saleDialog.open} onOpenChange={open => setSaleDialog({ open, item: open ? saleDialog.item : null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>销售出库</DialogTitle><DialogDescription>货品: {saleDialog.item?.skuCode} - {saleDialog.item?.name || saleDialog.item?.skuCode}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>成交价 <span className="text-red-500">*</span></Label><Input type="number" min="0" step="0.01" value={saleForm.actualPrice || ''} onChange={e => setSaleForm(f => ({ ...f, actualPrice: e.target.value ? parseFloat(e.target.value) : 0 }))} placeholder="必填" /></div>
            <div className="space-y-1"><Label>客户</Label>
              <CustomerSearchSelect
                value={saleForm.customerId}
                onChange={id => setSaleForm(f => ({ ...f, customerId: id }))}
                placeholder="搜索客户（姓名/手机号/微信）"
              />
            </div>
            <div className="space-y-1"><Label>销售渠道 <span className="text-red-500">*</span></Label>
              <Select value={saleForm.channel} onValueChange={v => setSaleForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>销售日期 <span className="text-red-500">*</span></Label><Input type="date" value={saleForm.saleDate} onChange={e => setSaleForm(f => ({ ...f, saleDate: e.target.value }))} /></div>
            <div className="space-y-1"><Label>备注</Label><Textarea value={saleForm.note} onChange={e => setSaleForm(f => ({ ...f, note: e.target.value }))} placeholder="可选" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialog({ open: false, item: null })}>取消</Button>
            <Button onClick={handleSale} className="bg-emerald-600 hover:bg-emerald-700">确认出库</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Sell Dialog */}
      <Dialog open={batchSellOpen} onOpenChange={setBatchSellOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              批量出库
            </DialogTitle>
            <DialogDescription>将选中的在库货品批量出库销售</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Progress indicator */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>处理进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            {/* Selected items list */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">选中货品（{selectedInStockItems.length} 件可出库）</Label>
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {selectedItems.map(item => (
                    <div key={item.id} className={`flex items-center justify-between text-sm py-1 px-2 rounded ${item.status === 'in_stock' ? 'bg-muted/50' : 'bg-muted/20 opacity-50'}`}>
                      <span className="font-mono text-xs">{item.skuCode}</span>
                      <span className="truncate mx-2 text-xs">{item.name || item.skuCode}</span>
                      {!batchSellForm.useCurrentPrice && item.status === 'in_stock' ? (
                        <Input
                          type="number"
                          className="h-7 w-24 text-xs text-right"
                          value={batchSellPrices[item.id] ?? item.sellingPrice}
                          onChange={e => setBatchSellPrices(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                          disabled={batchLoading}
                        />
                      ) : (
                        <span className="font-medium text-emerald-600 whitespace-nowrap">{formatPrice(item.sellingPrice)}</span>
                      )}
                      {item.status !== 'in_stock' && <span className="text-xs text-red-500 ml-1">(非在库)</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {/* Common fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>客户</Label>
                <CustomerSearchSelect
                  value={batchSellForm.customerId}
                  onChange={id => setBatchSellForm(f => ({ ...f, customerId: id }))}
                  placeholder="搜索客户（姓名/手机号/微信）"
                />
              </div>
              <div className="space-y-1">
                <Label>销售渠道</Label>
                <Select value={batchSellForm.channel} onValueChange={v => setBatchSellForm(f => ({ ...f, channel: v }))} disabled={batchLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="store">门店</SelectItem><SelectItem value="wechat">微信</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>销售日期</Label>
              <Input type="date" value={batchSellForm.saleDate} onChange={e => setBatchSellForm(f => ({ ...f, saleDate: e.target.value }))} disabled={batchLoading} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="useCurrentPrice"
                checked={batchSellForm.useCurrentPrice}
                onCheckedChange={(checked) => {
                  setBatchSellForm(f => ({ ...f, useCurrentPrice: !!checked }));
                  if (checked) setBatchSellPrices({});
                }}
                disabled={batchLoading}
              />
              <Label htmlFor="useCurrentPrice" className="text-sm cursor-pointer">使用当前售价作为成交价</Label>
            </div>
            {selectedInStockItems.length > 0 && (() => {
              const totalValue = selectedInStockItems.reduce((sum, i) => {
                if (batchSellForm.useCurrentPrice) return sum + (i.sellingPrice || 0);
                return sum + (batchSellPrices[i.id] ?? (i.sellingPrice || 0));
              }, 0);
              const selectedCustomer = customers.find((c: any) => String(c.id) === batchSellForm.customerId);
              return (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    {selectedInStockItems.length} 件货品，总售价 {formatPrice(totalValue)}
                    {selectedCustomer && <span className="ml-1">→ 客户：{selectedCustomer.name}</span>}
                  </p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSellOpen(false)} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchSell} disabled={batchLoading || selectedInStockItems.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {batchLoading ? `处理中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : `确认出库 ${selectedInStockItems.length} 件`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              批量删除确认
            </AlertDialogTitle>
            <AlertDialogDescription>
              即将删除 <span className="text-red-600 font-bold">{selectedIds.size}</span> 件货品，请确认操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Progress indicator */}
          {batchProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>删除进度</span>
                <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {/* Scrollable list of items */}
          <ScrollArea className="max-h-48">
            <div className="space-y-1 py-2">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-red-50 dark:bg-red-950/20">
                  <span className="font-mono text-xs">{item.skuCode}</span>
                  <span className="truncate mx-2 text-xs">{item.name || item.skuCode}</span>
                  <span className="font-medium whitespace-nowrap">{formatPrice(item.sellingPrice)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          {/* Soft/Hard delete toggle */}
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="hardDelete"
              checked={batchDeleteHard}
              onCheckedChange={(checked) => setBatchDeleteHard(!!checked)}
              disabled={batchLoading}
            />
            <Label htmlFor="hardDelete" className="text-sm cursor-pointer text-red-600 font-medium">彻底删除</Label>
            <span className="text-xs text-muted-foreground">（不勾选则为仅标记删除，可恢复）</span>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteOpen(false)} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchDelete} disabled={batchLoading} className="bg-red-600 hover:bg-red-700">
              {batchLoading ? `删除中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : `确认删除 ${selectedIds.size} 件`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Price Adjust Dialog */}
      <Dialog open={batchPriceOpen} onOpenChange={setBatchPriceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-600" />
              批量调价
            </DialogTitle>
            <DialogDescription>对选中的 {selectedIds.size} 件货品进行价格调整</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Progress indicator */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>调价进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">调整方式</Label>
                <Select value={batchPriceForm.mode} onValueChange={v => setBatchPriceForm(f => ({ ...f, mode: v }))} disabled={batchLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">按比例调整 (%)</SelectItem>
                    <SelectItem value="fixed">按固定金额 (元)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">调整方向</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 h-9 rounded-md border text-xs font-medium transition-colors ${batchPriceForm.direction === 'increase' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                    onClick={() => setBatchPriceForm(f => ({ ...f, direction: 'increase' }))}
                    disabled={batchLoading}
                  >
                    <ArrowUp className="h-3 w-3 mr-1 inline" />加价
                  </button>
                  <button
                    type="button"
                    className={`flex-1 h-9 rounded-md border text-xs font-medium transition-colors ${batchPriceForm.direction === 'decrease' ? 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-700 dark:text-red-300' : 'bg-background border-border text-muted-foreground hover:bg-muted/50'}`}
                    onClick={() => setBatchPriceForm(f => ({ ...f, direction: 'decrease' }))}
                    disabled={batchLoading}
                  >
                    <ArrowDown className="h-3 w-3 mr-1 inline" />减价
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">调整对象</Label>
                <Select value={batchPriceForm.target} onValueChange={v => setBatchPriceForm(f => ({ ...f, target: v }))} disabled={batchLoading}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sellingPrice">售价</SelectItem>
                    <SelectItem value="minimumPrice">底价</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  调整值
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={batchPriceForm.mode === 'percent' ? '如 10 表示10%' : '如 500 表示500元'}
                  value={batchPriceForm.value}
                  onChange={e => setBatchPriceForm(f => ({ ...f, value: e.target.value }))}
                  disabled={batchLoading}
                />
              </div>
            </div>
            {/* Preview summary */}
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              <p className="text-muted-foreground">选中 <span className="font-medium text-foreground">{selectedIds.size}</span> 件货品，预计调整...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {batchPriceForm.direction === 'increase' ? '加价' : '减价'}
                {batchPriceForm.mode === 'percent' ? `${batchPriceForm.value || 0}%` : `¥${batchPriceForm.value || 0}`}
              </p>
            </div>
            {/* Preview */}
            {pricePreview.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">价格预览（前10件）</Label>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {pricePreview.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-amber-50 dark:bg-amber-950/20">
                        <span className="text-xs truncate mr-2">{p.sku}</span>
                        <span className="text-muted-foreground">{formatPrice(p.oldPrice)}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className={`font-medium ${p.newPrice >= p.oldPrice ? 'text-emerald-600' : 'text-red-600'}`}>{formatPrice(p.newPrice)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedItems.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">...还有 {selectedItems.length - 10} 件</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBatchPriceOpen(false); setBatchPriceForm({ mode: 'percent', target: 'sellingPrice', value: '', direction: 'increase' }); }} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchPriceAdjust} disabled={batchLoading || !batchPriceForm.value} className="bg-amber-600 hover:bg-amber-700 text-white">
              {batchLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : '确认调价'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Change Counter Dialog */}
      <Dialog open={batchCounterOpen} onOpenChange={setBatchCounterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-600" />
              批量修改柜台
            </DialogTitle>
            <DialogDescription>将选中的 {selectedIds.size} 件货品统一修改到指定柜台</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Progress indicator */}
            {batchProgress && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>修改进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>新柜台号</Label>
              <Input
                type="number"
                placeholder="输入柜台号"
                value={batchCounterForm.counter}
                onChange={e => setBatchCounterForm(f => ({ ...f, counter: e.target.value }))}
                disabled={batchLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBatchCounterOpen(false); setBatchCounterForm({ counter: '' }); }} disabled={batchLoading}>取消</Button>
            <Button onClick={handleBatchCounter} disabled={batchLoading || !batchCounterForm.counter} className="bg-sky-600 hover:bg-sky-700 text-white">
              {batchLoading ? `修改中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}` : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Label Print Dialog */}
      <Dialog open={batchLabelPrintOpen} onOpenChange={setBatchLabelPrintOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              批量标签打印
            </DialogTitle>
            <DialogDescription>预览并打印选中货品的标签（共 {selectedItems.length} 件）</DialogDescription>
          </DialogHeader>
          <div id="batch-label-print-area" className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
            {selectedItems.map(item => (
              <div key={item.id} className="batch-label-card border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-lg p-3 bg-white dark:bg-gray-950 print:border-solid print:border-black print:dark:bg-white print:dark:text-black">
                <div className="text-center space-y-1.5">
                  <p className="font-mono text-xs font-bold tracking-widest">{item.skuCode || ''}</p>
                  <p className="text-sm font-medium truncate">{item.name || item.skuCode}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(item.sellingPrice)}</p>
                  {item.counter != null && (
                    <p className="text-xs text-muted-foreground print:text-black">柜台: {item.counter}号</p>
                  )}
                  {item.materialName && (
                    <p className="text-xs text-muted-foreground print:text-black">{item.materialName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchLabelPrintOpen(false)}>取消</Button>
            <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700">
              <Printer className="h-4 w-4 mr-1" />打印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Gallery */}
      <ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      {/* Item Create Dialog */}
      <ItemCreateDialog open={showCreate} onOpenChange={setShowCreate} onSuccess={fetchItems} />

      {/* Item Detail Dialog */}
      <ItemDetailDialog itemId={detailItemId} open={detailItemId !== null} onOpenChange={open => { if (!open) setDetailItemId(null); }} />

      {/* Item Edit Dialog */}
      <ItemEditDialog itemId={editItemId} open={editItemId !== null} onOpenChange={open => { if (!open) setEditItemId(null); }} onSuccess={fetchItems} />

      {/* Return Confirmation Dialog */}
      <Dialog open={returnConfirmItem.open} onOpenChange={open => setReturnConfirmItem({ open, item: open ? returnConfirmItem.item : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退货</DialogTitle>
            <DialogDescription>确定将此货品标记为退货？</DialogDescription>
          </DialogHeader>
          {returnConfirmItem.item && (
            <div className="py-2">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{returnConfirmItem.item.skuCode}</span></p>
                <p><span className="text-muted-foreground">名称:</span> {returnConfirmItem.item.name || returnConfirmItem.item.skuCode}</p>
                <p><span className="text-muted-foreground">售价:</span> <span className="font-medium text-emerald-600">{formatPrice(returnConfirmItem.item.sellingPrice)}</span></p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnConfirmItem({ open: false, item: null })}>取消</Button>
            <Button onClick={handleReturn} className="bg-orange-600 hover:bg-orange-700">确认退货</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmItem !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmItem(null); }}
        title="确认删除"
        description={deleteConfirmItem
          ? `此操作不可撤销，确定要删除货品「${deleteConfirmItem.name || deleteConfirmItem.skuCode}」(${deleteConfirmItem.skuCode})吗？`
          : ''}
        confirmText="确认删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Label Print Dialog */}
      <LabelPrintDialog item={printLabelItem} open={printLabelItem !== null} onOpenChange={open => { if (!open) setPrintLabelItem(null); }} />

      {/* Barcode Scanner Dialog - dynamically imported to avoid loading html5-qrcode at tab load */}
      {showScanner && scannerComponent && (
        <scannerComponent open={showScanner} onClose={() => setShowScanner(false)} onScan={handleBarcodeScan} />
      )}

      {/* ===== Slide-in Detail Panel ===== */}
      {selectedItemId !== null && (() => {
        const item = sortedItems.find(i => i.id === selectedItemId);
        if (!item) return null;
        const cost = item.allocatedCost || item.estimatedCost || item.costPrice || 0;
        const margin = item.sellingPrice > 0 ? ((item.sellingPrice - cost) / item.sellingPrice * 100) : 0;
        const itemTagsRaw: any[] = item.tags ? (Array.isArray(item.tags) ? item.tags : typeof item.tags === 'string' ? item.tags.split(',').filter(Boolean) : []) : [];
        const itemTags: string[] = itemTagsRaw.map((t: any) => typeof t === 'string' ? t : t.name || '');
        const specFields = item.specFields ? (typeof item.specFields === 'string' ? (() => { try { return JSON.parse(item.specFields); } catch { return {}; } })() : item.specFields) : {};
        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
              onClick={() => setSelectedItemId(null)}
            />
            {/* Panel - Desktop: right side slide */}
            <div className="hidden md:block fixed top-0 right-0 bottom-0 w-[320px] bg-card border-l border-border z-40 shadow-xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between gap-2 z-10">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{item.name || item.skuCode}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.skuCode}</p>
                </div>
                <button onClick={() => setSelectedItemId(null)} className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Cover Image */}
              {item.coverImage && (
                <div className="px-4 pt-4">
                  <Gem className="h-8 w-8 text-muted-foreground/20" />
                  <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-full aspect-square object-cover rounded-lg bg-muted opacity-0 -mt-10 relative z-10" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setSelectedItemId(null); setEditItemId(item.id); }}>
                  <Pencil className="h-3 w-3 mr-1" />编辑
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => {
                  navigator.clipboard.writeText(item.skuCode);
                  toast.success('SKU已复制到剪贴板');
                }}>
                  <Copy className="h-3 w-3 mr-1" />复制SKU
                </Button>
                {item.status === 'in_stock' && (
                  <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                    setSelectedItemId(null);
                    setSaleDialog({ open: true, item });
                    setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '' });
                  }}>
                    <DollarSignIcon className="h-3 w-3 mr-1" />快速出库
                  </Button>
                )}
              </div>
              {/* Details */}
              <div className="px-4 py-4 space-y-4">
                {/* Status + Inventory Days */}
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  {item.ageDays != null && (
                    <Badge variant="outline" className={`text-xs ${item.ageDays < 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : item.ageDays <= 90 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
                      <Clock className="h-3 w-3 mr-1" />
                      库龄 {item.ageDays}天
                    </Badge>
                  )}
                </div>
                {/* Profit/Loss for sold/returned items */}
                {(item.status === 'sold' || item.status === 'returned') && item.sellingPrice > 0 && (
                  <div className={`p-3 rounded-lg ${item.status === 'sold' ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'}`}>
                    <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                      {item.status === 'sold' ? <ArrowUp className="h-3 w-3 text-emerald-600" /> : <RotateCcw className="h-3 w-3 text-amber-600" />}
                      {item.status === 'sold' ? '销售记录' : '已退货' }
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">售价</span>
                        <span className="font-medium text-emerald-600">{formatPrice(item.sellingPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">成本</span>
                        <span className="font-medium">{formatPrice(cost)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">利润</span>
                        <span className={`font-bold ${(item.sellingPrice - cost) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {(item.sellingPrice - cost) >= 0 ? '+' : ''}{formatPrice(item.sellingPrice - cost)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Price Info */}
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">成本</span>
                    <span className="font-medium">{formatPrice(cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">售价</span>
                    <span className="font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">毛利率</span>
                    <span className={`font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Material & Type */}
                <div className="space-y-2 text-sm">
                  {item.materialName && (
                    <div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">材质:</span><span>{item.materialName}</span></div>
                  )}
                  {item.typeName && (
                    <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">器型:</span><span>{item.typeName}</span></div>
                  )}
                  {item.batchCode && (
                    <div className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">批次:</span><Badge variant="outline" className="font-mono text-xs">{item.batchCode}</Badge></div>
                  )}
                  {item.counter != null && (
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">柜台:</span><span>{item.counter}号柜</span></div>
                  )}
                  {item.purchaseDate && (
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">采购日期:</span><span>{item.purchaseDate}</span></div>
                  )}
                  {item.certNo && (
                    <div className="flex items-center gap-2"><FileCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-muted-foreground">证书编号:</span><span className="font-mono text-xs">{item.certNo}</span></div>
                  )}
                </div>
                {/* Spec Fields */}
                {Object.keys(specFields).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-muted-foreground" />规格参数</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(specFields).map(([key, val]) => {
                        const specLabelMap: Record<string, string> = { weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口', beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈' };
                        const displayVal = typeof val === 'object' ? (val as any)?.value || '' : val;
                        return (
                          <div key={key} className="text-xs p-1.5 bg-muted/50 rounded">
                            <span className="text-muted-foreground">{specLabelMap[key] || key}:</span> {displayVal}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Tags */}
                {itemTags.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-purple-500" />标签</p>
                    <div className="flex flex-wrap gap-1">
                      {itemTags.map((tag: string) => (
                        <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Notes */}
                {item.notes && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">备注</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Panel - Mobile: bottom slide */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card rounded-t-2xl border-t border-border shadow-xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* Drag indicator */}
              <div className="sticky top-0 bg-card pt-2 pb-1 px-4 z-10 flex justify-center">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
              {/* Header */}
              <div className="px-4 pb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate">{item.name || item.skuCode}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.skuCode}</p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={item.status} />
                  <button onClick={() => setSelectedItemId(null)} className="p-1 rounded-md hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* Cover Image */}
              {item.coverImage && (
                <div className="px-4">
                  <Gem className="h-10 w-10 text-muted-foreground/20" />
                  <img src={item.coverImage} alt={item.name || item.skuCode || '货品图片'} className="w-40 h-40 object-cover rounded-lg bg-muted opacity-0 -mt-12 relative z-10" loading="lazy" onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.classList.replace('opacity-0', 'opacity-100'); }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}
              {/* Actions - Mobile */}
              <div className="px-4 py-3 flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setSelectedItemId(null); setEditItemId(item.id); }}>
                  <Pencil className="h-3 w-3 mr-1" />编辑
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => {
                  navigator.clipboard.writeText(item.skuCode);
                  toast.success('SKU已复制到剪贴板');
                }}>
                  <Copy className="h-3 w-3 mr-1" />复制SKU
                </Button>
                {item.status === 'in_stock' && (
                  <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                    setSelectedItemId(null);
                    setSaleDialog({ open: true, item });
                    setSaleForm({ actualPrice: item.sellingPrice, channel: 'store', saleDate: new Date().toISOString().slice(0, 10), note: '' });
                  }}>
                    <DollarSignIcon className="h-3 w-3 mr-1" />快速出库
                  </Button>
                )}
              </div>
              {/* Mobile: Status + Inventory Days */}
              <div className="px-4 flex items-center gap-2">
                <StatusBadge status={item.status} />
                {item.ageDays != null && (
                  <Badge variant="outline" className={`text-xs ${item.ageDays < 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' : item.ageDays <= 90 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'}`}>
                    <Clock className="h-3 w-3 mr-1" />
                    库龄 {item.ageDays}天
                  </Badge>
                )}
              </div>
              {/* Details */}
              <div className="px-4 pb-8 space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div><span className="text-muted-foreground">成本</span><br/><span className="font-medium">{formatPrice(cost)}</span></div>
                  <div><span className="text-muted-foreground">售价</span><br/><span className="font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span></div>
                  <div><span className="text-muted-foreground">毛利率</span><br/><span className={`font-medium ${margin >= 30 ? 'text-emerald-600' : margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</span></div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {item.materialName && <p><span className="text-muted-foreground">材质:</span> {item.materialName}</p>}
                  {item.typeName && <p><span className="text-muted-foreground">器型:</span> {item.typeName}</p>}
                  {item.batchCode && <p><span className="text-muted-foreground">批次:</span> <Badge variant="outline" className="font-mono text-xs">{item.batchCode}</Badge></p>}
                  {item.counter != null && <p><span className="text-muted-foreground">柜台:</span> {item.counter}号柜</p>}
                  {item.purchaseDate && <p><span className="text-muted-foreground">采购日期:</span> {item.purchaseDate}</p>}
                  {item.certNo && <p><span className="text-muted-foreground">证书:</span> <span className="font-mono text-xs">{item.certNo}</span></p>}
                </div>
                {Object.keys(specFields).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(specFields).map(([key, val]) => {
                      const specLabelMap: Record<string, string> = { weight: '克重', metalWeight: '金重', size: '尺寸', braceletSize: '圈口', beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈' };
                      const displayVal = typeof val === 'object' ? (val as any)?.value || '' : val;
                      return <span key={key} className="text-xs px-2 py-0.5 bg-muted/50 rounded">{specLabelMap[key] || key}: {displayVal}</span>;
                    })}
                  </div>
                )}
                {itemTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {itemTags.map((tag: string) => (
                      <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
                    ))}
                  </div>
                )}
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default InventoryTab;
