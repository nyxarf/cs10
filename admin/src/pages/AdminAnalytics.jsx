import { useState, useEffect } from 'react';
import { adminGetAnalytics, adminGetQueryLogs, adminGetSpLedger, adminGetGroqLogs } from '../services/api';
import {
  LuMessageSquare, LuCircleHelp, LuUsers, LuTrendingUp,
  LuRefreshCw, LuSearch, LuDatabase, LuCoins, LuSparkles,
  LuCircleCheck, LuCircleX, LuTriangleAlert, LuBrain,
  LuZap, LuActivity, LuChartBar, LuRocket,
} from 'react-icons/lu';

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

/* ─── Colour Palette ─────────────────────────────────────────────────────── */
const P = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  sky:     '#0ea5e9',
  teal:    '#14b8a6',
  orange:  '#f97316',
};
const CAT_COLORS  = [P.indigo, P.violet, P.emerald, P.amber, P.rose, P.sky, P.teal, P.orange];
const PIE_COLORS  = { live: P.emerald, flagged: P.amber, hidden: '#94a3b8', pending: P.sky };
const Q_PIE       = { open: P.sky, answered: P.emerald, closed: '#94a3b8', review: P.amber, hidden: '#64748b' };
const ROLE_COLORS = { asker: P.indigo, answerer: P.emerald, both: P.violet, admin: P.rose };

/* ─── Tooltip helpers ────────────────────────────────────────────────────── */
const TooltipStyle = {
  background: '#1e1e2e',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
};
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TooltipStyle}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((p) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{p.name}:</span>
            <span style={{ fontWeight: 700 }}>{p.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── StatCard ───────────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color, gradient, trend }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.18s, box-shadow 0.18s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Gradient orb */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: gradient, opacity: 0.15, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: `${color}18`, marginBottom: 12 }}>
            <Icon size={19} style={{ color }} />
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700,
            color: trend >= 0 ? P.emerald : P.rose,
            background: trend >= 0 ? `${P.emerald}15` : `${P.rose}15`,
            borderRadius: 8, padding: '4px 8px', marginTop: 4,
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ChartCard wrapper ──────────────────────────────────────────────────── */
function ChartCard({ title, icon: Icon, children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} style={{ color: 'var(--primary)' }} />
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ─── Custom PieLabel ─────────────────────────────────────────────────────── */
const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  if (percent < 0.06) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ─── Tab button ─────────────────────────────────────────────────────────── */
function TabBtn({ active, onClick, icon: Icon, children, count }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-2)',
      border: 'none', cursor: 'pointer',
      padding: '7px 14px', borderRadius: 8,
      fontWeight: 600, fontSize: '0.8125rem',
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 0.15s',
    }}>
      <Icon size={14} />
      {children}
      {count > 0 && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.2)' : 'var(--border)',
          color: active ? '#fff' : 'var(--text-3)',
          borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800,
        }}>{count}</span>
      )}
    </button>
  );
}

/* ─── Status icon ────────────────────────────────────────────────────────── */
function StatusIcon({ status }) {
  if (status === 'answer')  return <LuCircleCheck  size={13} style={{ color: P.emerald, flexShrink: 0 }} />;
  if (status === 'clarify') return <LuTriangleAlert size={13} style={{ color: P.amber,   flexShrink: 0 }} />;
  return <LuCircleX size={13} style={{ color: P.rose, flexShrink: 0 }} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function AdminAnalytics() {
  const [analytics, setAnalytics]     = useState(null);
  const [logs, setLogs]               = useState([]);
  const [ledgerLogs, setLedgerLogs]   = useState([]);
  const [groqLogs, setGroqLogs]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [search, setSearch]           = useState('');
  const [period, setPeriod]           = useState('7d');
  const [activeTab, setActiveTab]     = useState('queries');

  const load = async () => {
    setLoading(true);
    setLogsLoading(true);
    try {
      const d = new Date();
      if (period === '7d') d.setDate(d.getDate() - 7);
      else if (period === '30d') d.setDate(d.getDate() - 30);
      else d.setDate(d.getDate() - 90);

      const [a, l, sp, gl] = await Promise.all([
        adminGetAnalytics({ period }),
        adminGetQueryLogs({ limit: 100, period }),
        adminGetSpLedger({ limit: 100, fromDate: d.toISOString() }),
        adminGetGroqLogs({ limit: 100 }),
      ]);
      setAnalytics(a);
      setLogs(l.items || l.logs || []);
      setLedgerLogs(sp.data || []);
      setGroqLogs(gl.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); setLogsLoading(false); }
  };

  useEffect(() => { load(); }, [period]);

  /* ── Derived ── */
  const filteredLogs    = logs.filter(l => !search || (l.originalQuery || '').toLowerCase().includes(search.toLowerCase()));
  const filteredLedger  = ledgerLogs.filter(l => !search || (l.reason || '').toLowerCase().includes(search.toLowerCase()) || (l.user?.name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredGroq    = groqLogs.filter(l => !search || (l.action || '').toLowerCase().includes(search.toLowerCase()));

  const categoryData    = (analytics?.categoryDistribution || []).map((c, i) => ({ name: c._id || 'Unknown', value: c.count, fill: CAT_COLORS[i % CAT_COLORS.length] }));
  const answerPieData   = (analytics?.answerStatusBreakdown || []).map(s => ({ name: s._id, value: s.count, fill: PIE_COLORS[s._id] || '#94a3b8' }));
  const qStatusData     = (analytics?.questionStatusBreakdown || []).map(s => ({ name: s._id, value: s.count, fill: Q_PIE[s._id] || '#94a3b8' }));
  const userRoleData    = (analytics?.userRoleDistribution || []).map(r => ({ name: r._id, value: r.count, fill: ROLE_COLORS[r._id] || '#94a3b8' }));
  const topEarners      = analytics?.topEarners || [];
  const timeSeries      = analytics?.timeSeries || [];
  const groqDailyTokens = analytics?.groqDailyTokens || [];
  const radarData       = categoryData.map(c => ({ subject: c.name, questions: c.value }));

  /* merge groq tokens into timeseries */
  const mergedSeries = timeSeries.map(d => {
    const g = groqDailyTokens.find(x => x._id === d.date);
    return { ...d, tokens: g?.tokens || 0, groqCalls: g?.calls || 0, label: d.date.slice(5) };
  });

  /* top earner chart data */
  const earnerData = topEarners.map(u => ({ name: u.name.split(' ')[0], xp: u.xp }));

  const totalCacheQueries = analytics?.totalQueries ?? '—';

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LuChartBar size={22} style={{ color: 'var(--primary)' }} /> Analytics
          </h1>
          <p>Live insights from every layer of the Samagama platform</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['7d', '30d', '90d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: 700,
                background: period === p ? 'var(--primary)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}>{p}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LuRefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 130, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
          <KpiCard icon={LuMessageSquare} label="AI Cache Hits"   value={totalCacheQueries}               color={P.indigo}  gradient={`radial-gradient(circle, ${P.indigo}, transparent)`} />
          <KpiCard icon={LuCircleHelp}    label="Community Qs"    value={analytics?.totalQuestions}       color={P.violet}  gradient={`radial-gradient(circle, ${P.violet}, transparent)`} />
          <KpiCard icon={LuCircleCheck}   label="Live Answers"    value={analytics?.totalAnswers}         color={P.emerald} gradient={`radial-gradient(circle, ${P.emerald}, transparent)`} />
          <KpiCard icon={LuDatabase}      label="FAQ Corpus"       value={analytics?.totalFaqs}            color={P.sky}     gradient={`radial-gradient(circle, ${P.sky}, transparent)`} />
          <KpiCard icon={LuUsers}         label="Registered Users" value={analytics?.totalUsers}           color={P.teal}    gradient={`radial-gradient(circle, ${P.teal}, transparent)`} />
          <KpiCard icon={LuRocket}        label="Promoted Answers" value={analytics?.promotedCount}        color={P.amber}   gradient={`radial-gradient(circle, ${P.amber}, transparent)`} />
          <KpiCard icon={LuBrain}         label="Groq API Calls"   value={analytics?.groqStats?.totalCalls?.toLocaleString()} color={P.rose}  gradient={`radial-gradient(circle, ${P.rose}, transparent)`} />
          <KpiCard icon={LuZap}           label="Tokens Used"      value={analytics?.groqStats?.totalTokens ? `${(analytics.groqStats.totalTokens / 1000).toFixed(1)}k` : '0'} color={P.orange} gradient={`radial-gradient(circle, ${P.orange}, transparent)`} sub="total Groq tokens" />
        </div>
      )}

      {/* ── Row 1: Time Series ── */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title={`Activity Over Last ${period}`} icon={LuActivity}>
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mergedSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.indigo}  stopOpacity={0.35} />
                    <stop offset="95%" stopColor={P.indigo}  stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={P.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
                <Area type="monotone" dataKey="queries"   name="AI Queries"   stroke={P.indigo}  fill="url(#gQ)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="questions" name="Community Qs" stroke={P.emerald} fill="url(#gC)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Category bar + Answer Pie + Question Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Category bar */}
        <ChartCard title="Questions by Category" icon={LuChartBar}>
          {loading ? <div className="skeleton" style={{ height: 240 }} /> : categoryData.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No community questions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" name="Questions" radius={[0, 6, 6, 0]}>
                  {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Answer Status Pie */}
        <ChartCard title="Answer Status" icon={LuCircleCheck}>
          {loading ? <div className="skeleton" style={{ height: 240 }} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={answerPieData} cx="50%" cy="48%" innerRadius={50} outerRadius={88} paddingAngle={3} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {answerPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Question Status Pie */}
        <ChartCard title="Question Status" icon={LuCircleHelp}>
          {loading ? <div className="skeleton" style={{ height: 240 }} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={qStatusData} cx="50%" cy="48%" innerRadius={50} outerRadius={88} paddingAngle={3} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {qStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: Top Earners + User Role Pie + Radar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Top SP earners bar */}
        <ChartCard title="Top SP Earners" icon={LuCoins}>
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : earnerData.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No users yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={earnerData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="xp" name="SP" radius={[6, 6, 0, 0]}>
                  {earnerData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* User Role Distribution */}
        <ChartCard title="User Roles" icon={LuUsers}>
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={userRoleData} cx="50%" cy="45%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value" labelLine={false} label={<PieLabel />}>
                  {userRoleData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Category Radar */}
        <ChartCard title="Category Spread" icon={LuActivity}>
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : radarData.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData.slice(0, 8)}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Radar name="Questions" dataKey="questions" stroke={P.violet} fill={P.violet} fillOpacity={0.22} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Groq Token Usage ── */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="Groq API Token Usage Over Time" icon={LuBrain}>
          {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={mergedSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="tokens"    name="Tokens"     stroke={P.rose}   strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="groqCalls" name="API Calls"  stroke={P.orange} strokeWidth={2}   dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Log Tables ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
            <TabBtn active={activeTab === 'queries'} onClick={() => setActiveTab('queries')} icon={LuDatabase} count={filteredLogs.length}>AI Query Logs</TabBtn>
            <TabBtn active={activeTab === 'ledger'}  onClick={() => setActiveTab('ledger')}  icon={LuCoins}    count={filteredLedger.length}>SP Ledger</TabBtn>
            <TabBtn active={activeTab === 'groq'}    onClick={() => setActiveTab('groq')}    icon={LuSparkles} count={filteredGroq.length}>Groq Logs</TabBtn>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="search-wrap" style={{ minWidth: 220 }}>
              <LuSearch size={13} />
              <input className="input" placeholder="Filter…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {logsLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : activeTab === 'queries' ? (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Query</th><th>Category</th><th>Action</th><th>Confidence</th><th style={{ textAlign: 'right' }}>Time</th>
              </tr></thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No query logs yet.</td></tr>
                ) : filteredLogs.map(log => (
                  <tr key={log._id}>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <StatusIcon status={log.actionTaken} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.originalQuery}</span>
                      </div>
                    </td>
                    <td>{log.category ? <span className="badge badge-violet">{log.category}</span> : <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={`badge ${log.actionTaken === 'answer' ? 'badge-success' : log.actionTaken === 'clarify' ? 'badge-warning' : 'badge-danger'}`}>
                        {log.actionTaken || '—'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div className="progress" style={{ width: 52 }}>
                          <div className="progress-fill" style={{ width: `${(log.confidence || 0) * 100}%`, background: log.confidence > 0.7 ? P.emerald : log.confidence > 0.4 ? P.amber : P.rose }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)' }}>{((log.confidence || 0) * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'ledger' ? (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>User</th><th>Amount</th><th>Reason</th><th>Admin</th><th style={{ textAlign: 'right' }}>Time</th>
              </tr></thead>
              <tbody>
                {filteredLedger.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No SP transactions yet.</td></tr>
                ) : filteredLedger.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontWeight: 600 }}>{log.user?.name || 'Unknown'}</td>
                    <td><span className={`badge ${log.amount > 0 ? 'badge-success' : 'badge-danger'}`}>{log.amount > 0 ? `+${log.amount} SP` : `${log.amount} SP`}</span></td>
                    <td style={{ color: 'var(--text-2)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason || 'N/A'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{log.admin?.name || 'System'}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Action</th><th>Model</th><th>Tokens (P/C/T)</th><th>Prompt / Response</th><th style={{ textAlign: 'right' }}>Time</th>
              </tr></thead>
              <tbody>
                {filteredGroq.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No Groq API logs yet.</td></tr>
                ) : filteredGroq.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{log.action}</td>
                    <td><span className="badge badge-gray">{log.model}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {log.tokens_prompt} / {log.tokens_completion} / <strong style={{ color: 'var(--text-1)' }}>{log.tokens_total}</strong>
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong style={{ color: 'var(--text-3)' }}>P:</strong> {log.prompt_summary}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong style={{ color: 'var(--text-3)' }}>R:</strong> {log.response_summary}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
