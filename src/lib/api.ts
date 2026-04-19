// API client for jade inventory system
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };
  // Attach auth token for API middleware
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    throw new Error(`请求失败: HTTP ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(json.message || '请求失败');
  }
  return json.data as T;
}

// ========== Dicts ==========
export const dictsApi = {
  getMaterials: (includeInactive = false) =>
    request<any[]>(`/dicts/materials?include_inactive=${includeInactive}`),
  createMaterial: (data: any) =>
    request<any>('/dicts/materials', { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: number, data: any) =>
    request<any>(`/dicts/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMaterial: (id: number) =>
    request<any>(`/dicts/materials/${id}`, { method: 'DELETE' }),

  getTypes: (includeInactive = false) =>
    request<any[]>(`/dicts/types?include_inactive=${includeInactive}`),
  createType: (data: any) =>
    request<any>('/dicts/types', { method: 'POST', body: JSON.stringify(data) }),
  updateType: (id: number, data: any) =>
    request<any>(`/dicts/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteType: (id: number) =>
    request<any>(`/dicts/types/${id}`, { method: 'DELETE' }),

  getTags: (groupName?: string, includeInactive = false) =>
    request<any[]>(`/dicts/tags?${groupName ? `group_name=${groupName}&` : ''}include_inactive=${includeInactive}`),
  createTag: (data: any) =>
    request<any>('/dicts/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id: number, data: any) =>
    request<any>(`/dicts/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTag: (id: number) =>
    request<any>(`/dicts/tags/${id}`, { method: 'DELETE' }),

  getCrafts: (includeInactive = false) =>
    request<any[]>(`/dicts/crafts?include_inactive=${includeInactive}`),
  createCraft: (data: any) =>
    request<any>('/dicts/crafts', { method: 'POST', body: JSON.stringify(data) }),
  updateCraft: (id: number, data: any) =>
    request<any>(`/dicts/crafts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCraft: (id: number) =>
    request<any>(`/dicts/crafts/${id}`, { method: 'DELETE' }),

  getSellingPoints: (includeInactive = false) =>
    request<any[]>(`/dicts/selling-points?include_inactive=${includeInactive}`),
  createSellingPoint: (data: any) =>
    request<any>('/dicts/selling-points', { method: 'POST', body: JSON.stringify(data) }),
  updateSellingPoint: (id: number, data: any) =>
    request<any>(`/dicts/selling-points/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSellingPoint: (id: number) =>
    request<any>(`/dicts/selling-points/${id}`, { method: 'DELETE' }),

  getAudiences: (includeInactive = false) =>
    request<any[]>(`/dicts/audiences?include_inactive=${includeInactive}`),
  createAudience: (data: any) =>
    request<any>('/dicts/audiences', { method: 'POST', body: JSON.stringify(data) }),
  updateAudience: (id: number, data: any) =>
    request<any>(`/dicts/audiences/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAudience: (id: number) =>
    request<any>(`/dicts/audiences/${id}`, { method: 'DELETE' }),
};

// ========== Config ==========
export const configApi = {
  getConfig: () => request<any[]>('/config'),
  updateConfig: (key: string, value: string) =>
    request<any>(`/config`, { method: 'PUT', body: JSON.stringify({ key, value }) }),
};

// ========== Batches ==========
export const batchesApi = {
  getBatches: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/batches${qs}`);
  },
  getBatch: (id: number) => request<any>(`/batches/${id}`),
  createBatch: (data: any) =>
    request<any>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id: number, data: any) =>
    request<any>(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  allocateBatch: (id: number) =>
    request<any>(`/batches/${id}/allocate`, { method: 'POST' }),
  deleteBatch: (id: number) =>
    request<any>(`/batches/${id}`, { method: 'DELETE' }),
};

// ========== Items ==========
export const itemsApi = {
  getItems: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/items${qs}`);
  },
  getItem: (id: number) => request<any>(`/items/${id}`),
  createItem: (data: any) =>
    request<any>('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: number, data: any) =>
    request<any>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: number, hard?: boolean) =>
    request<any>(`/items/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
  createItemsBatch: (data: any) =>
    request<any>('/items/batch', { method: 'POST', body: JSON.stringify(data) }),
  lookupBySku: (sku: string) => request<any>(`/items/lookup?sku=${encodeURIComponent(sku)}`),
  uploadImage: async (itemId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/items/${itemId}/images`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '上传失败');
    return json.data;
  },
  deleteImage: (itemId: number, imageId: number) =>
    request<any>(`/items/${itemId}/images?image_id=${imageId}`, { method: 'DELETE' }),
  setCoverImage: (itemId: number, imageId: number) =>
    request<any>(`/items/${itemId}/images`, { method: 'PUT', body: JSON.stringify({ imageId }) }),
  updateStatus: (id: number, data: { priorityTier?: string; shootingStatus?: string; contentStatus?: string }) =>
    request<any>(`/items/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  getStatusSummary: () => request<any>('/items/stats/status-summary'),
  exportForAI: (id: number) => request<any>(`/items/${id}/export-for-ai`),
};

// ========== Sales ==========
export const salesApi = {
  getSales: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/sales${qs}`);
  },
  createSale: (data: any) =>
    request<any>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  createBundleSale: (data: any) =>
    request<any>('/sales/bundle', { method: 'POST', body: JSON.stringify(data) }),
  returnSale: (data: any) =>
    request<any>('/sales/return', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Customers ==========
export const customersApi = {
  getCustomers: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/customers${qs}`);
  },
  getCustomerDetail: (id: number) => request<any>(`/customers/${id}`),
  createCustomer: (data: any) =>
    request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: any) =>
    request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: number) =>
    request<any>(`/customers/${id}`, { method: 'DELETE' }),
};

// ========== Suppliers ==========
export const suppliersApi = {
  getSuppliers: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/suppliers${qs}`);
  },
  createSupplier: (data: any) =>
    request<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: any) =>
    request<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: number) =>
    request<any>(`/suppliers/${id}`, { method: 'DELETE' }),
};

// ========== Logs ==========
export const logsApi = {
  getLogs: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/logs${qs}`);
  },
};

// ========== Backup ==========
export const backupApi = {
  download: () => `${BASE}/backup`,
  restore: async (file: File) => {
    const formData = new FormData();
    formData.append('backup', file);
    const res = await fetch(`${BASE}/backup`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '恢复失败');
    return json.data;
  },
};

// ========== Dashboard ==========
export const dashboardApi = {
  getSummary: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/summary${qs}`);
  },
  getBatchProfit: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/batch-profit${qs}`);
  },
  getProfitByCategory: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/profit/by-category${qs}`);
  },
  getProfitByChannel: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/profit/by-channel${qs}`);
  },
  getTrend: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/trend${qs}`);
  },
  getStockAging: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/stock-aging${qs}`);
  },
  getDistributionByType: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/distribution/by-type${qs}`);
  },
  getDistributionByMaterial: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/distribution/by-material${qs}`);
  },
  getProfitByCounter: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/profit/by-counter${qs}`);
  },
  getPriceRangeCost: () => request<any[]>(`/dashboard/price-range/cost`),
  getPriceRangeSelling: () => request<any[]>(`/dashboard/price-range/selling`),
  getWeightDistribution: () => request<any>(`/dashboard/weight-distribution`),
  getAgeDistribution: () => request<any[]>(`/dashboard/age-distribution`),
  getMomComparison: () => request<any>(`/dashboard/mom-comparison`),
  getTurnover: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/turnover${qs}`);
  },
  getHeatmap: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/heatmap${qs}`);
  },
  getTopSellers: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/top-sellers${qs}`);
  },
  getCustomerFrequency: () => request<any>(`/dashboard/customer-frequency`),
  getTopCustomers: () => request<any>(`/dashboard/top-customers`),
  getAggregate: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any>(`/dashboard/aggregate${qs}`);
  },
  getInventoryValueByCategory: () => request<any[]>(`/dashboard/inventory-value-by-category`),
  getSalesByChannel: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/dashboard/sales-by-channel${qs}`);
  },
};

// ========== Metal Prices ==========
export const metalApi = {
  getCurrentPrices: () => request<any[]>('/metal-prices'),
  updatePrice: (data: any) =>
    request<any>('/metal-prices', { method: 'POST', body: JSON.stringify(data) }),
  getPriceHistory: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return request<any[]>(`/metal-prices/history${qs}`);
  },
  previewReprice: (data: any) =>
    request<any>('/metal-prices/reprice', { method: 'POST', body: JSON.stringify(data) }),
  confirmReprice: (data: any) =>
    request<any>('/metal-prices/reprice/confirm', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Pricing ==========
export const pricingApi = {
  calculate: (data: any) =>
    request<any>('/pricing', { method: 'POST', body: JSON.stringify(data) }),
};

// ========== Import ==========
export const importApi = {
  importItems: async (file: File, options?: { autoCreate?: boolean; skipExisting?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('autoCreate', String(options?.autoCreate ?? true));
    formData.append('skipExisting', String(options?.skipExisting ?? true));
    const res = await fetch(`${BASE}/import/items`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data;
  },
  importCsvItems: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/import/items-csv`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data;
  },
  importSales: async (file: File, options?: { autoCreate?: boolean }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('autoCreate', String(options?.autoCreate ?? true));
    const res = await fetch(`${BASE}/import/sales`, { method: 'POST', body: formData });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '导入失败');
    return json.data;
  },
  downloadTemplate: (type: 'items' | 'sales') => `${BASE}/import/template?type=${type}`,
};

// ========== Batch Price ==========
export const itemsApiEnhanced = {
  batchPriceAdjust: async (data: { ids: string[]; adjustmentType: 'percentage' | 'fixed'; value: number; direction: 'increase' | 'decrease' }) => {
    const res = await fetch(`${BASE}/items/batch-price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.code !== 0 && json.code !== 200) throw new Error(json.message || '批量调价失败');
    return json.data;
  },
};

// ========== Export ==========
export const exportApi = {
  inventory: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return `${BASE}/export/inventory${qs}`;
  },
  sales: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return `${BASE}/export/sales${qs}`;
  },
  batches: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString() : '';
    return `${BASE}/export/batches${qs}`;
  },
};
