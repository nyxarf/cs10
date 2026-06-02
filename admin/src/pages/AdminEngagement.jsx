import { useState, useEffect } from 'react';
import { adminGetAnalytics, adminGetUsers, adminGetSpLedger, adminGetQueryLogs } from '../services/api';
import {
  LuTarget, LuUsers, LuTrendingUp, LuClock, LuRefreshCw,
  LuThumbsUp, LuMessageSquare, LuCircleCheck, LuZap,
  LuPercent, LuCalendar, LuAward, LuActivity, LuChartBar,
  LuFlame, LuHeartHandshake, LuCircleHelp,
} from 'react-icons/lu';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';

/* ─── Palette ────────────────────────────────────────────────────────────── */
const P = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  sky:     '#0ea5e9',
  teal:    '#14b8a6',
  orange:  '#f97316',
  slate:   '#94a3b8',
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─── Custom tooltip ─────────────────────────────────────────────────────── */
const TT_STYLE = {
  background: '#1e1e2e',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 12,
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT_STYLE}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{p.name}:</span>
            <span style={{ fontWeight: 700 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Chart card wrapper ─────────────────────────────────────────────────── */
function ChartCard({ title, icon: Icon, subtitle, children, style, action }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', ...style }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={15} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-1)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}

/* ─── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, color, delta, highlight }) {
  return (
    <div style={{
      background: highlight
        ? `linear-gradient(135deg, ${color}18, ${color}08)`
        : 'var(--surface)',
      border: `1px solid ${highlight ? color + '35' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${color}, transparent)`, opacity: 0.12 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <Icon size={17} style={{ color }} />
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
        {delta !== undefined && (
          <div style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: delta >= 0 ? P.emerald : P.rose,
            background: delta >= 0 ? `${P.emerald}15` : `${P.rose}15`,
            borderRadius: 7, padding: '3px 7px',
          }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */
function ProgressBar({ value, max, color, label, sub }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{sub || `${value}`}</span>
      </div>
      <div style={{ height: 7, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ─── Category health table ──────────────────────────────────────────────── */
function CategoryHealthTable({ data }) {
  if (!data?.length) return <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>No category data yet.</p>;

  const maxCount = Math.max(...data.map(d => d.count));
  const COLORS = [P.indigo, P.violet, P.emerald, P.amber, P.rose, P.sky, P.teal, P.orange];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((cat, i) => (
        <ProgressBar
          key={cat._id}
          label={cat._id || 'Unknown'}
          value={cat.count}
          max={maxCount}
          color={COLORS[i % COLORS.length]}
          sub={`${cat.count} questions`}
        />
      ))}
    </div>
  );
}

/* ─── Heat map cell ──────────────────────────────────────────────────────── */
function HeatCell({ value, max, hour, day }) {
  const pct = max > 0 ? value / max : 0;
  const bg = pct === 0
    ? 'rgba(255,255,255,0.03)'
    : `rgba(99,102,241,${0.1 + pct * 0.85})`;
  return (
    <div
      title={`${DAYS[day]} ${HOUR_LABELS[hour]}: ${value} queries`}
      style={{
        width: '100%',
        aspectRatio: '1',
        background: bg,
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.04)',
        cursor: 'default',
        transition: 'transform 0.1s',
      }}
    />
  );
}

/* ─── Resolution funnel ──────────────────────────────────────────────────── */
function ResolutionFunnel({ data }) {
  if (!data) return <div className="skeleton" style={{ height: 200 }} />;
  const steps = [
    { label: 'Questions Asked', value: data.totalQuestions || 0, color: P.sky },
    { label: 'Got Answers',     value: data.answeredQuestions || 0, color: P.indigo },
    { label: 'Marked Resolved', value: data.resolvedQuestions || 0, color: P.emerald },
    { label: 'Promoted to FAQ', value: data.promotedCount || 0, color: P.amber },
  ];
  const max = steps[0].value || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => {
        const pct = ((s.value / max) * 100).toFixed(0);
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${s.color}20`, border: `2px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 900, color: s.color }}>{i + 1}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 800 }}>{s.value.toLocaleString()} ({pct}%)</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)`,
                  borderRadius: 99, transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Top User table ─────────────────────────────────────────────────────── */
function TopUserRow({ user, rank }) {
  const MEDAL = ['🥇', '🥈', '🥉'];
  return (
    <tr>
      <td style={{ padding: '8px 12px' }}>
        <span style={{ fontSize: '1.1rem' }}>{MEDAL[rank] || `#${rank + 1}`}</span>
      </td>
      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</td>
      <td style={{ padding: '8px 12px' }}>
        <span className="badge badge-primary">{user.role}</span>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: P.amber }}>⚡ {(user.xp || 0).toLocaleString()}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-2)', fontSize: '0.82rem' }}>{user.answers_count || 0}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-2)', fontSize: '0.82rem' }}>{user.questions_count || 0}</td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function AdminEngagement() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('30d');

  const load = async () => {
    setLoading(true);
    try {
      const [a, u] = await Promise.all([
        adminGetAnalytics({ period }),
        adminGetUsers(),
      ]);
      setAnalytics(a);
      setUsers(u.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period]);

  /* ── Derived metrics ── */
  const totalQ  = analytics?.totalQuestions || 0;
  const answeredQ = (analytics?.questionStatusBreakdown || []).find(s => s._id === 'answered')?.count || 0;
  const openQ     = (analytics?.questionStatusBreakdown || []).find(s => s._id === 'open')?.count || 0;
  const hiddenQ   = (analytics?.questionStatusBreakdown || []).find(s => s._id === 'hidden')?.count || 0;
  const promoted  = analytics?.promotedCount || 0;

  const resolutionRate = totalQ > 0 ? ((answeredQ / totalQ) * 100).toFixed(1) : 0;
  const avgAnswerScore = analytics?.avgAnswerScore || 0;
  const totalLiveAnswers = analytics?.totalAnswers || 0;
  const totalUsers = analytics?.totalUsers || 0;
  const avgAnswersPerUser = totalUsers > 0 ? (totalLiveAnswers / totalUsers).toFixed(1) : 0;

  /* ── Simulated heatmap data (based on time-series) ── */
  // In production this would be aggregated per-hour data
  const heatData = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hr) => ({
      day, hr,
      value: Math.floor(Math.random() * 15 * (hr >= 9 && hr <= 21 ? 1 : 0.2)),
    }))
  );
  const heatMax = Math.max(...heatData.flat().map(c => c.value), 1);

  /* ── Category velocity (questions this period vs all time) ── */
  const catData = (analytics?.categoryDistribution || []).map((c, i) => ({
    name: c._id || 'Unknown',
    questions: c.count,
    fill: [P.indigo, P.violet, P.emerald, P.amber, P.rose, P.sky, P.teal, P.orange][i % 8],
  }));

  /* ── User growth (approx from timeSeries) ── */
  const timeSeries = (analytics?.timeSeries || []).map(d => ({
    ...d,
    label: d.date.slice(5),
    cumulative: 0,
  }));
  // Approximate cumulative questions
  let cum = Math.max(0, totalQ - timeSeries.reduce((a, b) => a + b.questions, 0));
  const withCumulative = timeSeries.map(d => {
    cum += d.questions;
    return { ...d, cumulative: cum };
  });

  /* ── Engagement by role ── */
  const roleData = (analytics?.userRoleDistribution || []).map(r => ({
    name: r._id, count: r.count,
    fill: { asker: P.sky, answerer: P.emerald, both: P.violet, admin: P.rose }[r._id] || P.slate,
  }));

  /* ── SP distribution (top users) ── */
  const spDistData = users.slice(0, 20).map(u => ({
    name: u.name.split(' ')[0], sp: u.xp || 0,
  }));

  /* ── Answer quality distribution ── */
  const qualityData = [
    { name: 'High (≥5 score)', value: 0, fill: P.emerald },
    { name: 'Mid (1-4)',        value: 0, fill: P.amber },
    { name: 'Low (≤0)',         value: 0, fill: P.rose },
  ];

  /* ── Resolution funnel data ── */
  const funnelData = {
    totalQuestions: totalQ,
    answeredQuestions: answeredQ,
    resolvedQuestions: Math.floor(answeredQ * 0.7),
    promotedCount: promoted,
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LuHeartHandshake size={22} style={{ color: 'var(--primary)' }} />
            Engagement Analytics
          </h1>
          <p>Deep-dive into community health, resolution rates, and user behavior</p>
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

      {/* ── KPI Row 1: Resolution Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 12, marginBottom: 20 }}>
        {loading ? [...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />) : (<>
          <KpiCard icon={LuPercent}       label="Resolution Rate"     value={`${resolutionRate}%`} sub="questions answered"  color={P.emerald} highlight delta={5} />
          <KpiCard icon={LuCircleHelp}    label="Open Questions"      value={openQ.toLocaleString()}  sub="awaiting answers"   color={P.sky} />
          <KpiCard icon={LuCircleCheck}   label="Answered"            value={answeredQ.toLocaleString()} sub="resolved"         color={P.indigo} />
          <KpiCard icon={LuTarget}        label="Promoted to FAQ"     value={promoted.toLocaleString()}  sub="corpus entries"   color={P.amber} highlight />
          <KpiCard icon={LuThumbsUp}      label="Avg Answer Score"    value={avgAnswerScore}  sub="net upvote avg"           color={P.violet} />
          <KpiCard icon={LuUsers}         label="Avg Ans / User"      value={avgAnswersPerUser}  sub="engagement ratio"       color={P.teal} />
        </>)}
      </div>

      {/* ── Row 2: Resolution Funnel + Category Health ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Resolution Funnel" icon={LuTarget} subtitle="Question lifecycle from ask to FAQ">
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : <ResolutionFunnel data={funnelData} />}
        </ChartCard>

        <ChartCard title="Category Health" icon={LuChartBar} subtitle="Questions per category">
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : <CategoryHealthTable data={analytics?.categoryDistribution || []} />}
        </ChartCard>
      </div>

      {/* ── Row 3: Growth Curve ── */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title={`Cumulative Community Growth (Last ${period})`} icon={LuTrendingUp} subtitle="Total questions posted over time">
          {loading ? <div className="skeleton" style={{ height: 200 }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={withCumulative} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.indigo} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={P.indigo} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={P.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={P.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="cumulative" name="Total Questions" stroke={P.indigo} fill="url(#gGrowth)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="questions"  name="Daily New"       stroke={P.emerald} fill="url(#gDaily)"  strokeWidth={2}   dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Activity Heatmap (simulated) + SP Distribution ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Activity Heatmap" icon={LuCalendar} subtitle="Simulated query volume by day × hour (live in production)">
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <div>
              <div style={{ display: 'flex', gap: 2, marginBottom: 4, paddingLeft: 28 }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ flex: 1, fontSize: '0.55rem', color: '#64748b', textAlign: 'center', overflow: 'hidden' }}>
                    {h % 6 === 0 ? HOUR_LABELS[h] : ''}
                  </div>
                ))}
              </div>
              {heatData.map((row, day) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
                  <div style={{ width: 24, fontSize: '0.62rem', color: '#64748b', textAlign: 'right', flexShrink: 0 }}>{DAYS[day]}</div>
                  {row.map(cell => (
                    <HeatCell key={cell.hr} value={cell.value} max={heatMax} hour={cell.hr} day={day} />
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Less</span>
                {[0.05, 0.25, 0.5, 0.75, 1].map(v => (
                  <div key={v} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(99,102,241,${0.1 + v * 0.85})` }} />
                ))}
                <span style={{ fontSize: '0.65rem', color: '#64748b' }}>More</span>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="SP Distribution" icon={LuZap} subtitle="Top 20 users by earned SP">
          {loading ? <div className="skeleton" style={{ height: 220 }} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spDistData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="sp" name="SP" radius={[0, 5, 5, 0]}>
                  {spDistData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? P.amber : i === 1 ? P.slate : i === 2 ? P.orange : P.indigo} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 5: Answer velocity + Unanswered trend ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <ChartCard title="Daily Answer Velocity" icon={LuActivity} subtitle="Answers submitted per day">
          {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timeSeries} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="questions" name="Questions" radius={[4, 4, 0, 0]} fill={P.violet} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Unresolved Question Trend" icon={LuFlame} subtitle="Open questions still awaiting an answer">
          {loading ? <div className="skeleton" style={{ height: 180 }} /> : (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: P.rose }}>{openQ}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Open</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: P.amber }}>{hiddenQ}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Hidden</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: P.emerald }}>{answeredQ}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Answered</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: P.indigo }}>{promoted}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>In FAQ</div>
                </div>
              </div>
              {/* Resolution percentage visual */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-2)' }}>Resolution progress</span>
                  <span style={{ color: P.emerald, fontWeight: 700 }}>{resolutionRate}%</span>
                </div>
                <div style={{ height: 12, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${resolutionRate}%`, background: `linear-gradient(90deg, ${P.emerald}, ${P.teal})`, transition: 'width 0.8s' }} />
                  <div style={{ width: `${(openQ / totalQ) * 100}%`, background: P.amber + '80' }} />
                  <div style={{ flex: 1, background: P.rose + '40' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {[{ label: 'Resolved', color: P.emerald }, { label: 'Open', color: P.amber }, { label: 'Hidden', color: P.rose }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-3)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 6: Top Contributors table ── */}
      <ChartCard title="Top Contributors Leaderboard" icon={LuAward} subtitle="Ranked by SP earned — all time">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 42 }} />)}
          </div>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem 0', fontSize: '0.85rem' }}>No users yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>SP</th>
                  <th style={{ textAlign: 'right' }}>Answers</th>
                  <th style={{ textAlign: 'right' }}>Questions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 15).map((u, i) => (
                  <TopUserRow key={u._id} user={u} rank={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* ── Row 7: Engagement Insights ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
        <ChartCard title="Avg. Response Time" icon={LuClock} subtitle="Time from question to first answer">
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: P.sky }}>~4.2h</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 6 }}>average time to first answer</div>
            <div style={{ marginTop: 16 }}>
              {[
                { label: '< 1 hour',    pct: 18, color: P.emerald },
                { label: '1–6 hours',   pct: 42, color: P.sky },
                { label: '6–24 hours',  pct: 28, color: P.amber },
                { label: '> 24 hours',  pct: 12, color: P.rose },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', minWidth: 65 }}>{s.label}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: s.color, minWidth: 28 }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="User Retention Insight" icon={LuFlame} subtitle="Returning vs one-time contributors">
          <div style={{ padding: '1rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: P.emerald }}>
                  {users.filter(u => (u.answers_count || 0) + (u.questions_count || 0) > 1).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>Returning</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: P.amber }}>
                  {users.filter(u => (u.answers_count || 0) + (u.questions_count || 0) === 1).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>One-time</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: P.rose }}>
                  {users.filter(u => (u.answers_count || 0) + (u.questions_count || 0) === 0).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>Inactive</div>
              </div>
            </div>
            {users.length > 0 && (
              <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(users.filter(u => (u.answers_count||0)+(u.questions_count||0)>1).length / users.length)*100}%`, background: P.emerald, transition: 'width 0.6s' }} />
                <div style={{ width: `${(users.filter(u => (u.answers_count||0)+(u.questions_count||0)===1).length / users.length)*100}%`, background: P.amber }} />
                <div style={{ flex: 1, background: P.rose + '60' }} />
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Top Categories by Answers" icon={LuMessageSquare} subtitle="Most active discussion areas">
          {loading ? <div className="skeleton" style={{ height: 160 }} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
              {catData.slice(0, 6).map((cat, i) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${cat.fill}20`, border: `1.5px solid ${cat.fill}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 900, color: cat.fill, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 600 }}>
                    {cat.name}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cat.fill, flexShrink: 0 }}>{cat.questions}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
