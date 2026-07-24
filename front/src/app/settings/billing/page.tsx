'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Image as ImageIcon, DollarSign, Calendar, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { billingApi } from '@/lib/api';

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
  status: string;
  created_at: string;
}

type PeriodType = 'daily' | 'monthly';

export default function BillingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [stats, setStats] = useState<BillingStatItem[]>([]);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, statsRes, recRes] = await Promise.all([
        billingApi.getSummary(),
        billingApi.getStats(period, days),
        billingApi.getRecords(50, 0),
      ]);
      setSummary(sumRes);
      setStats(statsRes.data || []);
      setRecords(recRes.records || []);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  }, [period, days]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCost = (n: number) => `¥${Number(n || 0).toFixed(2)}`;
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Calculate max for chart scaling
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
                        style={{ minWidth: '40px' }}
                      >
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-popover px-3 py-2 text-xs opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                          <div className="font-medium text-foreground">{stat.period}</div>
                          <div className="mt-1 text-muted-foreground">
                            <span className="text-foreground">{stat.total_images || 0}</span> 张图
                          </div>
                          <div className="text-muted-foreground">
                            <span className="text-foreground">{formatCost(stat.total_cost)}</span>
                          </div>
                        </div>

                        {/* Bars */}
                        <div className="flex h-40 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-3 rounded-t bg-primary/70 transition-all duration-300 hover:bg-primary"
                            style={{ height: `${costHeight}px` }}
                            title={`费用: ${formatCost(stat.total_cost)}`}
                          />
                          <div
                            className="w-3 rounded-t bg-chart-2/70 transition-all duration-300 hover:bg-chart-2"
                            style={{ height: `${imgHeight}px` }}
                            title={`图片: ${stat.total_images || 0} 张`}
                          />
                        </div>

                        {/* Label */}
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-primary/70" />
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
                        <th className="px-6 py-3 font-medium">工具</th>
                        <th className="px-6 py-3 font-medium">分辨率</th>
                        <th className="px-6 py-3 font-medium text-center">图片数</th>
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
                          <td className="px-6 py-3 text-foreground">
                            {rec.tool_name || rec.tool_key}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                            {rec.resolution || '-'}
                          </td>
                          <td className="px-6 py-3 text-center text-foreground">
                            {rec.image_count}
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
