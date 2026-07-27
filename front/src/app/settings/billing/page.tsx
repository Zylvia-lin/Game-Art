'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Image as ImageIcon, DollarSign, Calendar, ArrowLeft, Download, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { billingApi, projectsApi } from '@/lib/api';

interface BillingSummary {
  total_tasks: number;
  total_images: number;
  total_input_cost: number;
  total_output_cost: number;
  total_cost: number;
}

interface BillingStatItem {
  period: string;
  task_count: number;
  total_images: number;
  total_input_cost: number;
  total_output_cost: number;
  total_cost: number;
}

interface BillingRecord {
  id: string;
  project_id: string;
  task_id: string;
  tool_key: string;
  tool_name: string;
  image_count: number;
  resolution: string;
  total_pixels: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  model_id: string | null;
  model_name: string | null;
  unit_type: string | null;
  input_units: number;
  output_units: number;
  status: string;
  created_at: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

const MODEL_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'per_image', label: '图片模型' },
  { value: 'per_1M_tokens', label: '文本模型' },
  { value: 'per_1k_calls', label: '工具模型' },
];

type PeriodType = 'daily' | 'monthly';

export default function BillingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [stats, setStats] = useState<BillingStatItem[]>([]);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterModelType, setFilterModelType] = useState('');

  // Export
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load project list for filter
  useEffect(() => {
    projectsApi.list().then(ps => {
      setProjects(ps.map(p => ({ id: p.id, name: p.name })));
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pid = filterProjectId || undefined;
      const mt = filterModelType || undefined;
      const [sumRes, statsRes, recRes] = await Promise.all([
        billingApi.getSummary(pid, mt),
        billingApi.getStats(period, days, pid, mt),
        billingApi.getRecords(50, 0, pid, mt),
      ]);
      setSummary(sumRes);
      setStats(statsRes.data || []);
      setRecords(recRes.records || []);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  }, [period, days, filterProjectId, filterModelType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    const url = billingApi.getExportUrl(exportFrom, exportTo, filterProjectId || undefined, filterModelType || undefined);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_${exportFrom}_${exportTo}.csv`;
    a.click();
    setTimeout(() => setExporting(false), 1000);
  };

  const formatCost = (n: number) => {
    const v = Number(n || 0);
    if (v === 0) return '¥0';
    if (v < 0.01) return `¥${v.toFixed(5)}`;
    if (v < 1) return `¥${v.toFixed(4)}`;
    return `¥${v.toFixed(2)}`;
  };
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const maxCost = Math.max(...stats.map((s) => Number(s.total_cost || 0)), 0.01);
  const maxImages = Math.max(...stats.map((s) => Number(s.total_images || 0)), 1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">账单统计</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriod('daily')}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                period === 'daily'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              按日
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                period === 'monthly'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              按月
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Filters + Export bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">全部项目</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterModelType}
            onChange={(e) => setFilterModelType(e.target.value)}
            className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            {MODEL_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">导出:</span>
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              max={today}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">至</span>
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              max={today}
              className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleExport}
              disabled={exporting || !exportFrom || !exportTo}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? '导出中...' : '导出CSV'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={<DollarSign className="h-5 w-5" />}
                label="总消耗"
                value={formatCost(summary?.total_cost || 0)}
                accent="primary"
              />
              <SummaryCard
                icon={<ImageIcon className="h-5 w-5" />}
                label="生成图片"
                value={`${summary?.total_images || 0} 张`}
                accent="blue"
              />
              <SummaryCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="生成任务"
                value={`${summary?.total_tasks || 0} 次`}
                accent="green"
              />
              <SummaryCard
                icon={<Calendar className="h-5 w-5" />}
                label="输入图消耗"
                value={formatCost(summary?.total_input_cost || 0)}
                accent="amber"
              />
            </div>

            {/* Chart */}
            <div className="mb-8 rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  {period === 'daily' ? '每日' : '每月'}消耗趋势
                </h2>
                <span className="text-xs text-muted-foreground">最近 {days} 天</span>
              </div>

              {stats.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  暂无数据
                </div>
              ) : (
                <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: '200px' }}>
                  {stats.slice().reverse().map((stat) => {
                    const costHeight = (Number(stat.total_cost || 0) / maxCost) * 160;
                    const imgHeight = (Number(stat.total_images || 0) / maxImages) * 160;
                    const label = period === 'monthly'
                      ? stat.period
                      : `${stat.period.slice(5)}`;
                    return (
                      <div
                        key={stat.period}
                        className="group relative flex flex-1 flex-col items-center gap-1"
                        style={{ minWidth: '44px' }}
                      >
                        {/* Hover tooltip */}
                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs opacity-0 shadow-xl backdrop-blur transition-all group-hover:opacity-100">
                          <div className="font-semibold text-foreground text-xs">{stat.period}</div>
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-orange-400/70 inline-block" />
                              费用: <span className="text-foreground font-medium">{formatCost(stat.total_cost)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-chart-2/70 inline-block" />
                              图片: <span className="text-foreground font-medium">{stat.total_images || 0} 张</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-chart-3/70 inline-block" />
                              任务: <span className="text-foreground font-medium">{stat.task_count || 0} 次</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full justify-center gap-0.5 h-5">
                          <span
                            className="text-[9px] text-orange-400/90 font-medium text-center leading-tight"
                            style={{ width: '14px' }}
                            title={formatCost(stat.total_cost)}
                          >
                            {Number(stat.total_cost) > 0 ? (Number(stat.total_cost) < 1 ? Number(stat.total_cost).toFixed(1) : Math.round(Number(stat.total_cost))) : ''}
                          </span>
                          <span
                            className="text-[9px] text-chart-2/80 font-medium text-center leading-tight"
                            style={{ width: '14px' }}
                          >
                            {Number(stat.total_images) > 0 ? stat.total_images : ''}
                          </span>
                        </div>

                        <div className="flex h-36 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-3 rounded-t bg-orange-400/70 transition-all duration-300 hover:bg-orange-400"
                            style={{ height: `${costHeight}px` }}
                          />
                          <div
                            className="w-3 rounded-t bg-chart-2/70 transition-all duration-300 hover:bg-chart-2"
                            style={{ height: `${imgHeight}px` }}
                          />
                        </div>

                        <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-orange-400/70" />
                  费用（元）
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-chart-2/70" />
                  图片数（张）
                </span>
              </div>
            </div>

            {/* Records Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">消费明细</h2>
              </div>
              {records.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  暂无记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-6 py-3 font-medium">时间</th>
                        <th className="px-6 py-3 font-medium">类别</th>
                        <th className="px-6 py-3 font-medium">工具</th>
                        <th className="px-6 py-3 font-medium">模型</th>
                        <th className="px-6 py-3 font-medium">分辨率</th>
                        <th className="px-6 py-3 font-medium text-center">消耗</th>
                        <th className="px-6 py-3 font-medium text-right">输入费用</th>
                        <th className="px-6 py-3 font-medium text-right">输出费用</th>
                        <th className="px-6 py-3 font-medium text-right">合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec) => (
                        <tr
                          key={rec.id}
                          className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(rec.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              rec.unit_type === 'per_1M_tokens'
                                ? 'bg-blue-500/10 text-blue-400'
                                : rec.unit_type === 'per_1k_calls'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-primary/10 text-primary'
                            }`}>
                              {rec.unit_type === 'per_1M_tokens' ? '文本' : rec.unit_type === 'per_1k_calls' ? '工具' : '图片'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-foreground">
                            {rec.tool_name || rec.tool_key}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">
                            {rec.model_name || '-'}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                            {rec.resolution || '-'}
                          </td>
                          <td className="px-6 py-3 text-center text-muted-foreground text-xs">
                            {rec.unit_type === 'per_1M_tokens'
                              ? `${rec.input_units?.toFixed(2) || 0}M/${rec.output_units?.toFixed(2) || 0}M tokens`
                              : rec.unit_type === 'per_1k_calls'
                                ? `${((rec.output_units || 0) * 1000).toFixed(0)} 次`
                                : `${rec.image_count} 张`}
                          </td>
                          <td className="px-6 py-3 text-right text-muted-foreground">
                            {formatCost(rec.input_cost)}
                          </td>
                          <td className="px-6 py-3 text-right text-muted-foreground">
                            {formatCost(rec.output_cost)}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-foreground">
                            {formatCost(rec.total_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'primary' | 'blue' | 'green' | 'amber';
}) {
  const accentClasses = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-chart-2/10 text-chart-2',
    green: 'bg-chart-3/10 text-chart-3',
    amber: 'bg-chart-4/10 text-chart-4',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClasses[accent]}`}>
          {icon}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
