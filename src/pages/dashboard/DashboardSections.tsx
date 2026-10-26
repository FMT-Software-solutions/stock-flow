import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AiSummary, DashboardSummary, PeriodFigures } from '@/hooks/useDashboardSummary';
import type { DashboardPeriod } from './period';
import type { ChartRow } from './useChartData';

type Money = (amount: number) => string;

const SALES = 'text-blue-600 dark:text-blue-400';
const CASH = 'text-emerald-600 dark:text-emerald-400';
const DEBT = 'text-red-600 dark:text-red-400';
const WARN = 'text-amber-600 dark:text-amber-400';
const EXPENSE = 'text-orange-600 dark:text-orange-400';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};
const PAYMENT_COLORS = ['bg-emerald-500', 'bg-violet-500', 'bg-blue-500', 'bg-amber-500', 'bg-slate-400'];

const paymentLabel = (method: string) =>
  PAYMENT_LABELS[method] ?? method.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function SectionCard({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col gap-3 p-5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const SectionLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
    {children}
  </Link>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
);

// ---------------------------------------------------------------------------
// AI summary
// ---------------------------------------------------------------------------

export function AiSummaryCard({
  open,
  onToggle,
  summary,
  loading,
  error,
  refreshing,
  onRefresh,
}: {
  open: boolean;
  onToggle: () => void;
  summary?: AiSummary;
  loading: boolean;
  error?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const busy = loading || refreshing;
  return (
    <Card className="gap-0 px-3 py-1.5">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="dashboard-ai-summary"
          className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-muted/50"
        >
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <span className="text-[15px] font-semibold">Summary</span>
          {open && summary && !busy && (
            <span className="text-xs text-muted-foreground">{format(new Date(summary.createdAt), 'd MMM, HH:mm')}</span>
          )}
        </button>
        {open && (
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={busy}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </div>
      {open && (
        <div id="dashboard-ai-summary" className="pb-3 pl-8 pr-2" aria-live="polite">
          {busy ? (
            <div className="space-y-2 py-1" aria-label="Writing summary">
              <Skeleton className="h-3 w-[92%]" />
              <Skeleton className="h-3 w-[84%]" />
              <Skeleton className="h-3 w-[60%]" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {summary?.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Key figures
// ---------------------------------------------------------------------------

function changeText(current: number, previous: number | undefined, prevLabel: string | null, lowerIsBetter = false) {
  if (previous === undefined || !prevLabel) return null;
  if (previous === 0 && current === 0) return { text: `Same as ${prevLabel}`, className: 'text-muted-foreground' };
  if (previous === 0) return { text: `Up from 0 in ${prevLabel}`, className: lowerIsBetter ? DEBT : CASH };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: `Same as ${prevLabel}`, className: 'text-muted-foreground' };
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return {
    text: `${up ? '▲' : '▼'} ${Math.abs(pct).toLocaleString()}% vs ${prevLabel}`,
    className: good ? CASH : DEBT,
  };
}

function Spark({ values, className }: { values: number[]; className: string }) {
  if (values.length < 2) return null;
  const step = Math.max(1, Math.ceil(values.length / 14));
  const points: number[] = [];
  for (let i = 0; i < values.length; i += step) points.push(Math.max(...values.slice(i, i + step)));
  const max = Math.max(1, ...points);
  return (
    <div aria-hidden className="flex h-7 w-24 items-end gap-0.5">
      {points.map((v, i) => (
        <div
          key={i}
          className={cn('flex-1 rounded-sm bg-current', className, v === 0 && 'opacity-20')}
          style={{ height: `${Math.max(v > 0 ? 8 : 4, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function KpiTiles({
  current,
  previous,
  prevLabel,
  netSeries,
  orderSeries,
  money,
  loading,
}: {
  current?: PeriodFigures;
  previous?: PeriodFigures | null;
  prevLabel: string | null;
  netSeries: number[];
  orderSeries: number[];
  money: Money;
  loading: boolean;
}) {
  const avg = current && current.orders ? current.net / current.orders : 0;
  const prevAvg = previous && previous.orders ? previous.net / previous.orders : undefined;
  const tiles = [
    { label: 'Net sales', value: current && money(current.net), change: current && changeText(current.net, previous?.net, prevLabel), spark: netSeries, tone: SALES, to: '/reports?report=sales_overview' },
    { label: 'Orders', value: current?.orders.toLocaleString(), change: current && changeText(current.orders, previous?.orders, prevLabel), spark: orderSeries, tone: SALES, to: '/orders' },
    { label: 'Average sale', value: current && money(avg), change: current && changeText(avg, prevAvg, prevLabel), spark: [], tone: SALES, to: '/reports?report=sales_list' },
    { label: 'Cash collected', value: current && money(current.collected), change: current && changeText(current.collected, previous?.collected, prevLabel), spark: [], tone: CASH, valueTone: CASH, to: '/reports?report=payments' },
    { label: 'Owed from period', value: current && money(current.owed), change: current && changeText(current.owed, previous?.owed, prevLabel, true), spark: [], tone: DEBT, valueTone: current && current.owed > 0 ? DEBT : undefined, to: '/reports?report=customers' },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 [&>*]:min-w-0">
      {tiles.map((t) => (
        <Link
          key={t.label}
          to={t.to}
          className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <span className="text-[13px] text-muted-foreground">{t.label}</span>
          {loading && !current ? (
            <Skeleton className="h-7 w-32" />
          ) : (
            <span className={cn('text-2xl font-bold tabular-nums tracking-tight', t.valueTone)}>{t.value}</span>
          )}
          <div className="flex min-h-7 items-end justify-between gap-2">
            <span className={cn('text-xs font-semibold', t.change?.className ?? 'text-muted-foreground')}>
              {t.change?.text ?? ''}
            </span>
            <Spark values={t.spark} className={t.tone} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sales over time
// ---------------------------------------------------------------------------

type Measure = 'net' | 'orders';

export function SalesChart({
  period,
  data,
  money,
  loading,
}: {
  period: DashboardPeriod;
  data: ChartRow[];
  money: Money;
  loading: boolean;
}) {
  const [measure, setMeasure] = useState<Measure>('net');
  const hasPrev = !!period.prevLabel;
  const compact = (v: number) =>
    measure === 'orders' ? String(v) : v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(v);

  return (
    <SectionCard
      title={measure === 'net' ? 'Sales' : 'Orders'}
      className="min-w-0 flex-[999_1_560px]"
      action={
        <div role="group" aria-label="Chart measure" className="inline-flex gap-0.5 rounded-md bg-muted p-0.5">
          {(['net', 'orders'] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={measure === m}
              onClick={() => setMeasure(m)}
              className={cn(
                'h-7 rounded px-2.5 text-xs font-medium',
                measure === m ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {m === 'net' ? 'Revenue' : 'Orders'}
            </button>
          ))}
        </div>
      }
    >
      <span className="-mt-2 text-xs text-muted-foreground">
        {period.label}
        {hasPrev ? ` compared with ${period.prevLabel}` : ''}
      </span>
      {loading && data.length === 0 ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <div className={cn('h-56 w-full', SALES)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis xAxisId="prev" dataKey="label" hide />
              <XAxis xAxisId="cur" dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} className="fill-muted-foreground" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={compact} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                content={({ active, payload }) => {
                  const row = active && payload?.[0]?.payload;
                  if (!row) return null;
                  const show = (v: number | null) => (v === null ? '—' : measure === 'net' ? money(v) : `${v} orders`);
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                      <div className="font-medium">{row.label}: {show(measure === 'net' ? row.net : row.orders)}</div>
                      {row.prevLabel && (
                        <div className="text-muted-foreground">
                          {row.prevLabel}: {show(measure === 'net' ? row.prevNet : row.prevOrders)}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              {hasPrev && (
                <Bar xAxisId="prev" dataKey={measure === 'net' ? 'prevNet' : 'prevOrders'} fill="currentColor" fillOpacity={0.22} radius={[3, 3, 0, 0]} maxBarSize={30} isAnimationActive={false} />
              )}
              <Bar xAxisId="cur" dataKey={measure === 'net' ? 'net' : 'orders'} fill="currentColor" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm bg-current', SALES)} />
          {period.label}
        </span>
        {hasPrev && (
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-sm bg-current opacity-25', SALES)} />
            {period.prevLabel}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

export function NeedsAttention({ attention, money, loading }: { attention?: DashboardSummary['attention']; money: Money; loading: boolean }) {
  const rows = useMemo(() => {
    if (!attention) return [];
    const out = attention.stock.reduce((s, b) => s + Number(b.out), 0);
    const low = attention.stock.reduce((s, b) => s + Number(b.low), 0);
    const perBranch = (key: 'out' | 'low') =>
      attention.stock
        .filter((b) => Number(b[key]) > 0)
        .sort((a, b) => Number(b[key]) - Number(a[key]))
        .map((b) => `${b.branch.replace(/ Branch$/i, '')} ${b[key]}`)
        .join(' · ');
    const owed = Number(attention.owed.amount);
    return [
      out > 0 && { key: 'out', count: String(out), title: 'Out of stock', detail: perBranch('out'), tone: DEBT, to: '/reports?report=stock_on_hand' },
      low > 0 && { key: 'low', count: String(low), title: 'Running low', detail: perBranch('low'), tone: WARN, to: '/reports?report=stock_on_hand' },
      owed > 0 && {
        key: 'owed',
        count: money(owed),
        title: `Owed on ${attention.owed.sales} ${Number(attention.owed.sales) === 1 ? 'sale' : 'sales'}`,
        detail: attention.owed.top.map((t) => `${t.name} ${money(Number(t.amount))}`).join(' · '),
        tone: DEBT,
        to: '/reports?report=customers',
      },
      Number(attention.pending) > 0 && { key: 'pending', count: String(attention.pending), title: 'Pending orders', detail: 'Not completed yet', tone: WARN, to: '/orders' },
      attention.discounts_ending.length > 0 && {
        key: 'discounts',
        count: String(attention.discounts_ending.length),
        title: 'Discounts ending this week',
        detail: attention.discounts_ending.map((d) => `${d.name} ${format(new Date(d.ends_at), 'd MMM')}`).join(' · '),
        tone: WARN,
        to: '/discounts',
      },
    ].filter(Boolean) as { key: string; count: string; title: string; detail: string; tone: string; to: string }[];
  }, [attention, money]);

  return (
    <SectionCard title="Needs attention" className="min-w-0 flex-[1_1_320px] px-3 pb-3" action={<span className="pr-2 text-xs text-muted-foreground">Now</span>}>
      {loading && !attention ? (
        <div className="space-y-3 px-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Empty>All clear</Empty>
      ) : (
        <div className="-mt-1 flex flex-col">
          {rows.map((r) => (
            <Link key={r.key} to={r.to} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <span className={cn('inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-md bg-muted px-2 text-[13px] font-bold tabular-nums', r.tone)}>
                {r.count}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{r.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Insight panels
// ---------------------------------------------------------------------------

function Meter({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted">
      <div className={cn('h-1.5 rounded-full', className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TopProducts({ items, money, loading }: { items?: DashboardSummary['top_products']; money: Money; loading: boolean }) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.net));
  return (
    <SectionCard title="Top products" action={<SectionLink to="/reports?report=product_sales">Product sales</SectionLink>}>
      {loading && !items ? (
        <Skeleton className="h-32 w-full" />
      ) : !items?.length ? (
        <Empty>No sales in this period</Empty>
      ) : (
        items.map((p) => (
          <div key={p.product_id ?? p.name} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="truncate" title={p.name}>{p.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{money(p.net)}</span>
            </div>
            <Meter value={p.net} max={max} className="bg-blue-500" />
          </div>
        ))
      )}
    </SectionCard>
  );
}

export function PaymentsCard({ items, money, loading }: { items?: DashboardSummary['payments']; money: Money; loading: boolean }) {
  const total = (items ?? []).reduce((s, p) => s + p.amount, 0);
  return (
    <SectionCard
      title="Payments received"
      action={<span className="text-xs tabular-nums text-muted-foreground">{items?.length ? money(total) : ''}</span>}
    >
      {loading && !items ? (
        <Skeleton className="h-32 w-full" />
      ) : !items?.length ? (
        <Empty>No payments in this period</Empty>
      ) : (
        <>
          <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
            {items.map((p, i) => (
              <div key={p.method} className={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} style={{ width: `${(p.amount / total) * 100}%` }} />
            ))}
          </div>
          {items.map((p, i) => (
            <div key={p.method} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn('h-2.5 w-2.5 rounded-sm', PAYMENT_COLORS[i % PAYMENT_COLORS.length])} />
              <span className="flex-1">{paymentLabel(p.method)}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round((p.amount / total) * 100)}%</span>
              <span className="min-w-28 text-right font-semibold tabular-nums">{money(p.amount)}</span>
            </div>
          ))}
        </>
      )}
    </SectionCard>
  );
}

export function BranchesCard({
  items,
  expenses,
  money,
  loading,
}: {
  items?: DashboardSummary['branches'];
  expenses?: number;
  money: Money;
  loading: boolean;
}) {
  const max = Math.max(1, ...(items ?? []).map((b) => b.net));
  return (
    <SectionCard title="Branches" action={<span className="text-xs text-muted-foreground">Sales · orders</span>}>
      {loading && !items ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        (items ?? []).map((b) => (
          <div key={b.id} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3 text-[13px]">
              <span className="truncate">{b.name}</span>
              <span className="shrink-0 tabular-nums">
                <strong>{money(b.net)}</strong> <span className="text-muted-foreground">· {b.orders}</span>
              </span>
            </div>
            <Meter value={b.net} max={max} className="bg-emerald-500" />
          </div>
        ))
      )}
      <div className="mt-1 flex justify-between border-t pt-3 text-[13px]">
        <span className="text-muted-foreground">Expenses in period</span>
        <span className={cn('font-semibold tabular-nums', EXPENSE)}>{expenses === undefined ? '' : money(expenses)}</span>
      </div>
    </SectionCard>
  );
}

const PAY_STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: CASH },
  partial: { label: 'Part paid', tone: WARN },
  unpaid: { label: 'Unpaid', tone: DEBT },
  refunded: { label: 'Refunded', tone: 'text-muted-foreground' },
};

export function RecentSales({ items, money, loading }: { items?: DashboardSummary['recent']; money: Money; loading: boolean }) {
  return (
    <SectionCard title="Recent sales" action={<SectionLink to="/orders">All sales</SectionLink>}>
      {loading && !items ? (
        <Skeleton className="h-40 w-full" />
      ) : !items?.length ? (
        <Empty>No sales yet</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Sale</th>
                <th className="p-2 font-medium">Customer</th>
                <th className="p-2 font-medium">Branch</th>
                <th className="p-2 font-medium">When</th>
                <th className="p-2 font-medium">Payment</th>
                <th className="py-2 pl-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const pay = PAY_STATUS[r.payment_status] ?? { label: r.payment_status, tone: 'text-muted-foreground' };
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-2 tabular-nums">
                      <Link to={`/orders/${r.id}`} className="text-primary underline-offset-2 hover:underline">
                        {r.order_number}
                      </Link>
                    </td>
                    <td className="p-2">{r.customer ?? 'Walk-in'}</td>
                    <td className="p-2 text-muted-foreground">{r.branch?.replace(/ Branch$/i, '') ?? '—'}</td>
                    <td className="p-2 text-muted-foreground">{format(new Date(r.date), 'd MMM, HH:mm')}</td>
                    <td className="p-2">
                      <span className={cn('rounded-full bg-muted px-2 py-0.5 text-xs font-semibold', pay.tone)}>{pay.label}</span>
                    </td>
                    <td className="py-2 pl-2 text-right font-semibold tabular-nums">{money(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function CountsStrip({ counts }: { counts?: DashboardSummary['counts'] }) {
  if (!counts) return null;
  const items: [number, string, string][] = [
    [counts.customers, 'customers', '/customers'],
    [counts.products, 'products', '/products'],
    [counts.suppliers, 'suppliers', '/suppliers'],
    [counts.branches, 'branches', '/branches'],
    [counts.users, 'users', '/user-management'],
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-[13px] text-muted-foreground">
      {items.map(([n, label, to]) => (
        <Link key={label} to={to} className="hover:text-foreground">
          <strong className="text-foreground">{Number(n).toLocaleString()}</strong> {label}
        </Link>
      ))}
    </div>
  );
}

