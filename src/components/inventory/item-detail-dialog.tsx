'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { itemsApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatPrice, StatusBadge } from './shared';
import ImageLightbox from './image-lightbox';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { Trash2, Star, Upload, ImageIcon, ZoomIn, ImageOff, Copy, Download } from 'lucide-react';

// Image with loading state helper
function ImageWithLoading({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className={`relative ${className || ''}`} onClick={onClick}>
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center w-full h-full bg-muted/50 rounded-lg border border-dashed border-muted-foreground/20 text-muted-foreground">
          <ImageOff className="h-6 w-6 mb-1" />
          <span className="text-[10px]">加载失败</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      )}
    </div>
  );
}

// ========== Item Detail Dialog ==========
function ItemDetailDialog({ itemId, open, onOpenChange }: { itemId: number | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data = await itemsApi.getItem(id);
      setItem(data);
      // Set initial selected image to cover image or first image
      if (data.images && data.images.length > 0) {
        const coverIdx = data.images.findIndex((img: any) => img.isCover);
        setSelectedImageIndex(coverIdx >= 0 ? coverIdx : 0);
      }
    } catch {
      toast.error('加载货品详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && itemId) {
      fetchDetail(itemId);
    } else {
      setItem(null);
      setSelectedImageIndex(0);
    }
  }, [open, itemId, fetchDetail]);

  async function handleUploadImage(file: File) {
    if (!itemId) return;
    setUploading(true);
    try {
      await itemsApi.uploadImage(itemId, file);
      toast.success('图片上传成功');
      fetchDetail(itemId);
    } catch (e: any) {
      toast.error(e.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: number) {
    if (!itemId) return;
    try {
      await itemsApi.deleteImage(itemId, imageId);
      toast.success('图片已删除');
      fetchDetail(itemId);
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  }

  async function handleSetCoverImage(imageId: number) {
    if (!itemId) return;
    try {
      await itemsApi.setCoverImage(itemId, imageId);
      toast.success('已设为封面');
      fetchDetail(itemId);
    } catch (e: any) {
      toast.error(e.message || '设置封面失败');
    }
  }

  const specFieldLabels: Record<string, string> = {
    weight: '克重(g)', metalWeight: '金重(g)', size: '尺寸', braceletSize: '圈口',
    beadCount: '颗数', beadDiameter: '珠径', ringSize: '戒圈',
  };

  const images = item?.images || [];

  async function handleCopyAIFeed() {
    if (!itemId) return;
    setExporting(true);
    try {
      const data = await itemsApi.exportForAI(itemId);
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(json);
      toast.success('已复制到剪贴板');
    } catch (e: any) {
      toast.error(e.message || '复制失败');
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadJSON() {
    if (!itemId) return;
    setExporting(true);
    try {
      const data = await itemsApi.exportForAI(itemId);
      const json = JSON.stringify(data, null, 2);
      const skuCode = data['SKU编码'] || 'unknown';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skuCode}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('JSON 文件已下载');
    } catch (e: any) {
      toast.error(e.message || '下载失败');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Dialog open={open && !lightboxOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>货品详情</DialogTitle>
            <DialogDescription>{item?.skuCode || ''}</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="space-y-3 py-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-48 w-full" /></div>
          ) : item ? (
            <div className="space-y-4 py-2">
              {/* Image Viewer: Main image + Thumbnail strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">图片</p>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file);
                      e.target.value = '';
                    }} disabled={uploading} />
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={uploading} asChild>
                      <span><Upload className="h-3 w-3 mr-1" />{uploading ? '上传中...' : '上传图片'}</span>
                    </Button>
                  </label>
                </div>
                {images.length > 0 ? (
                  <>
                    {/* Main image display */}
                    <div
                      className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden cursor-zoom-in group"
                      onClick={() => setLightboxOpen(true)}
                    >
                      {uploading && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
                          <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-2" />
                          <span className="text-sm text-emerald-600 font-medium">上传中...</span>
                        </div>
                      )}
                      <ImageWithLoading
                        src={images[selectedImageIndex]?.url}
                        alt={`货品图片 ${selectedImageIndex + 1}`}
                        className="w-full h-full"
                      />
                      {images[selectedImageIndex]?.isCover && (
                        <div className="absolute top-2 left-2"><Badge className="h-5 text-[10px] bg-emerald-600"><Star className="h-3 w-3 mr-0.5" />封面</Badge></div>
                      )}
                      {/* Zoom hint */}
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <ZoomIn className="h-3 w-3" /> 点击放大
                      </div>
                    </div>

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {images.map((img: any, idx: number) => (
                          <div
                            key={img.id}
                            className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 cursor-pointer transition-all duration-200 ${idx === selectedImageIndex ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-transparent hover:border-muted-foreground/30'}`}
                            onClick={() => setSelectedImageIndex(idx)}
                          >
                            <ImageWithLoading
                              src={img.url}
                              alt={`缩略图 ${idx + 1}`}
                              className="w-full h-full"
                            />
                            {img.isCover && (
                              <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[8px] px-0.5 leading-3">★</div>
                            )}
                            {/* Hover actions */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                              {!img.isCover && (
                                <Button size="sm" variant="secondary" className="h-4 text-[8px] px-1 min-w-0" onClick={e => { e.stopPropagation(); handleSetCoverImage(img.id); }}>★</Button>
                              )}
                              <Button size="sm" variant="destructive" className="h-4 text-[8px] px-1 min-w-0" onClick={e => { e.stopPropagation(); handleDeleteImage(img.id); }}>✕</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Single image actions */}
                    {images.length === 1 && (
                      <div className="flex items-center gap-2">
                        {!images[0]?.isCover && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleSetCoverImage(images[0].id)}>
                            <Star className="h-3 w-3 mr-1" />设为封面
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-600 hover:text-red-700" onClick={() => handleDeleteImage(images[0].id)}>
                          <Trash2 className="h-3 w-3 mr-1" />删除
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1" />
                      <p className="text-xs">暂无图片</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{item.skuCode}</span></div>
                <div><span className="text-muted-foreground">名称:</span> {item.name || '-'}</div>
                <div><span className="text-muted-foreground">材质:</span> {item.materialName || '-'}</div>
                <div><span className="text-muted-foreground">器型:</span> {item.typeName || '-'}</div>
                <div><span className="text-muted-foreground">状态:</span> <StatusBadge status={item.status} /></div>
                <div><span className="text-muted-foreground">库龄:</span> {item.ageDays != null ? `${item.ageDays}天` : '-'}</div>
              </div>

              <Separator />

              {/* Batch Info */}
              {item.batchCode && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">批次:</span> <span className="font-mono">{item.batchCode}</span></div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Costs & Prices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">成本价:</span> <span className="font-medium">{formatPrice(item.costPrice)}</span></div>
                <div><span className="text-muted-foreground">分摊成本:</span> <span className="font-medium">{formatPrice(item.allocatedCost)}</span></div>
                <div><span className="text-muted-foreground">底价:</span> <span className="font-medium">{formatPrice(item.floorPrice)}</span></div>
                <div><span className="text-muted-foreground text-emerald-700">售价:</span> <span className="font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span></div>
              </div>

              <Separator />

              {/* Other Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">产地:</span> {item.origin || '-'}</div>
                <div><span className="text-muted-foreground">柜台:</span> {item.counter ?? '-'}</div>
                <div><span className="text-muted-foreground">证书号:</span> {item.certNo || '-'}</div>
                <div><span className="text-muted-foreground">供应商:</span> {item.supplierName || '-'}</div>
                <div><span className="text-muted-foreground">采购日期:</span> {item.purchaseDate || '-'}</div>
                <div><span className="text-muted-foreground">创建时间:</span> {item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '-'}</div>
              </div>

              {/* Content Attributes */}
              {(() => {
                const contentFields: { label: string; value: string | null; preWrap?: boolean; privateNote?: boolean }[] = [
                  { label: '主色', value: item.mainColor },
                  { label: '副色', value: item.subColor },
                  { label: '年代款式', value: item.era },
                  { label: '价格带', value: item.priceRange },
                  { label: '故事点', value: item.storyPoints, preWrap: true },
                  { label: '经营笔记（私用）', value: item.operationNote, preWrap: true, privateNote: true },
                ];
                const nonEmpty = contentFields.filter(f => f.value);
                const hasSellingPoints = item.sellingPoints && item.sellingPoints.length > 0;
                const hasAudiences = item.audiences && item.audiences.length > 0;
                if (nonEmpty.length === 0 && !hasSellingPoints && !hasAudiences) return null;
                return (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">内容属性</p>
                      <div className="space-y-2">
                        {nonEmpty.map(f => (
                          <div key={f.label}>
                            <span className={`text-sm text-muted-foreground ${f.privateNote ? 'italic' : ''}`}>{f.label}：</span>
                            <span className={`text-sm ${f.preWrap ? 'whitespace-pre-wrap' : ''}`}>{f.value}</span>
                          </div>
                        ))}
                        {hasSellingPoints && (
                          <div>
                            <span className="text-sm text-muted-foreground">卖点：</span>
                            <span className="text-sm">{item.sellingPoints.map((sp: any) => sp.name).join('、')}</span>
                          </div>
                        )}
                        {hasAudiences && (
                          <div>
                            <span className="text-sm text-muted-foreground">目标人群：</span>
                            <span className="text-sm">{item.audiences.map((a: any) => a.name).join('、')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Spec Details */}
              {item.spec && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">规格参数</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {Object.entries(item.spec).map(([key, val]: [string, any]) => (
                        <div key={key}><span className="text-muted-foreground">{specFieldLabels[key] || key}:</span> {String(val)}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">标签</p>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag: any) => <Badge key={tag.id} variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{tag.name}</Badge>)}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {item.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1">备注</p>
                    <p className="text-sm text-muted-foreground">{item.notes}</p>
                  </div>
                </>
              )}

              {/* Sales History */}
              {item.saleRecords && item.saleRecords.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">销售记录</p>
                    <div className="space-y-2">
                      {item.saleRecords.map((sr: any) => (
                        <div key={sr.id} className="p-2 bg-muted/50 rounded text-sm">
                          <div className="flex justify-between"><span className="font-mono text-xs">{sr.saleNo}</span><span className="font-medium">{formatPrice(sr.actualPrice)}</span></div>
                          <div className="text-xs text-muted-foreground">{sr.saleDate} · {sr.channel === 'store' ? '门店' : '微信'}{sr.customerName ? ` · ${sr.customerName}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">未找到货品信息</div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyAIFeed} disabled={exporting || !item}>
                <Copy className="h-4 w-4 mr-1" />复制AI喂料
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadJSON} disabled={exporting || !item}>
                <Download className="h-4 w-4 mr-1" />下载JSON
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox overlay - key forces remount when opened so state resets */}
      {lightboxOpen && (
        <ImageLightbox
          key={`lightbox-${selectedImageIndex}`}
          images={images.map((img: any) => ({ url: img.url, id: img.id, isCover: img.isCover }))}
          initialIndex={selectedImageIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export default ItemDetailDialog;
