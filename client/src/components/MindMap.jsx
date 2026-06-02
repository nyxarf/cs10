/**
 * MindMap.jsx
 *
 * An interactive radial SVG mind map renderer.
 * - Radial layout: root at center, branches radiate outward
 * - Pan (drag) + Zoom (wheel/pinch)
 * - Hover tooltips for long labels
 * - Click leaf → fires onNodeClick(label)
 * - Staggered fade-in animation on mount / data change
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';

/* ─── Palette ────────────────────────────────────────────────────────────── */
const COLORS = {
  root:   { fill: '#6366f1', stroke: '#818cf8', text: '#fff' },
  branch: [
    { fill: '#0ea5e9', stroke: '#38bdf8', text: '#fff' },
    { fill: '#10b981', stroke: '#34d399', text: '#fff' },
    { fill: '#f59e0b', stroke: '#fbbf24', text: '#fff' },
    { fill: '#8b5cf6', stroke: '#a78bfa', text: '#fff' },
    { fill: '#ef4444', stroke: '#f87171', text: '#fff' },
    { fill: '#ec4899', stroke: '#f472b6', text: '#fff' },
  ],
  leaf:   { fill: 'rgba(30,30,50,0.85)', stroke: '#334155', text: '#cbd5e1' },
  edge:   'rgba(148,163,184,0.25)',
  edgeHighlight: '#6366f1',
  bg:     'transparent',
};

/* ─── Layout constants ────────────────────────────────────────────────────── */
const ROOT_R    = 44;
const BRANCH_R  = 32;
const LEAF_R    = 22;
const BRANCH_D  = 180;  // distance root→branch centers
const LEAF_D    = 130;  // distance branch→leaf centers
const W         = 900;
const H         = 680;
const CX        = W / 2;
const CY        = H / 2;

/* ─── Utility: wrap text into lines ─────────────────────────────────────── */
function wrapLabel(label, maxChars = 18) {
  const words = label.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3); // max 3 lines
}

/* ─── Compute node positions (radial) ───────────────────────────────────── */
function computeLayout(tree) {
  const nodes = [];
  const edges = [];

  if (!tree || !tree.root) return { nodes, edges };

  // Root
  nodes.push({
    id: '__root__', label: tree.root,
    x: CX, y: CY, r: ROOT_R,
    depth: 0, color: COLORS.root,
    branchIdx: -1,
  });

  const branches = tree.children || [];
  const bCount   = branches.length;

  branches.forEach((branch, bi) => {
    const bColor = COLORS.branch[bi % COLORS.branch.length];
    // Evenly space branches around the circle
    const bAngle = (2 * Math.PI / bCount) * bi - Math.PI / 2;
    const bx = CX + Math.cos(bAngle) * BRANCH_D;
    const by = CY + Math.sin(bAngle) * BRANCH_D;

    nodes.push({
      id: branch.id || `b${bi}`, label: branch.label,
      x: bx, y: by, r: BRANCH_R,
      depth: 1, color: bColor,
      branchIdx: bi,
    });
    edges.push({ from: '__root__', to: branch.id || `b${bi}`, color: bColor.stroke });

    const leaves = branch.children || [];
    const lCount = leaves.length;

    leaves.forEach((leaf, li) => {
      // Fan leaves around the branch, pointed away from center
      const spread = Math.min(Math.PI * 0.65, (lCount - 1) * 0.32);
      const lAngle = bAngle + (lCount > 1 ? -spread / 2 + (spread / (lCount - 1)) * li : 0);
      const lx = bx + Math.cos(lAngle) * LEAF_D;
      const ly = by + Math.sin(lAngle) * LEAF_D;

      nodes.push({
        id: leaf.id || `b${bi}l${li}`, label: leaf.label,
        x: lx, y: ly, r: LEAF_R,
        depth: 2, color: COLORS.leaf,
        branchIdx: bi,
        leafColor: bColor, // used for accent stroke
        isLeaf: true,
      });
      edges.push({ from: branch.id || `b${bi}`, to: leaf.id || `b${bi}l${li}`, color: bColor.stroke + '80' });
    });
  });

  return { nodes, edges };
}

/* ─── Node component ─────────────────────────────────────────────────────── */
function MindNode({ node, onNodeClick, hoveredId, setHoveredId, animDelay }) {
  const isHovered  = hoveredId === node.id;
  const isRoot     = node.depth === 0;
  const isBranch   = node.depth === 1;
  const isLeaf     = node.isLeaf;
  const lines      = wrapLabel(node.label, isRoot ? 12 : isBranch ? 14 : 18);
  const lh         = 13; // line height
  const textY0     = node.y - ((lines.length - 1) * lh) / 2;
  const strokeColor = isLeaf
    ? (isHovered ? node.leafColor.stroke : node.color.stroke)
    : node.color.stroke;
  const fillColor   = isLeaf && isHovered ? '#1e2035' : node.color.fill;
  const scale       = isHovered ? 1.12 : 1;

  return (
    <g
      style={{
        cursor: isLeaf ? 'pointer' : 'default',
        transform: `scale(${scale})`,
        transformOrigin: `${node.x}px ${node.y}px`,
        transition: 'transform 0.18s ease',
        animation: `mmFadeIn 0.45s ease ${animDelay}s both`,
      }}
      onClick={() => isLeaf && onNodeClick && onNodeClick(node.label)}
      onMouseEnter={() => setHoveredId(node.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      {/* Shadow / glow */}
      {(isRoot || isHovered) && (
        <circle
          cx={node.x} cy={node.y} r={node.r + 8}
          fill="none"
          stroke={node.color.stroke}
          strokeWidth={isRoot ? 2 : 1}
          opacity={isRoot ? 0.3 : 0.4}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Main circle */}
      <circle
        cx={node.x} cy={node.y} r={node.r}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isLeaf ? (isHovered ? 1.5 : 0.8) : 2}
        style={{ transition: 'all 0.18s ease' }}
      />

      {/* Inner ring on root */}
      {isRoot && (
        <circle
          cx={node.x} cy={node.y} r={node.r - 6}
          fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1}
        />
      )}

      {/* Label text */}
      {lines.map((line, i) => (
        <text
          key={i}
          x={node.x}
          y={textY0 + i * lh}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isLeaf ? (isHovered ? '#e2e8f0' : node.color.text) : node.color.text}
          fontSize={isRoot ? 12 : isBranch ? 10 : 8.5}
          fontWeight={isRoot ? 800 : isBranch ? 700 : 500}
          fontFamily="Inter, system-ui, sans-serif"
          style={{ userSelect: 'none', pointerEvents: 'none', transition: 'fill 0.15s' }}
        >
          {line}
        </text>
      ))}

      {/* Leaf click hint */}
      {isLeaf && isHovered && (
        <text
          x={node.x} y={node.y + node.r + 12}
          textAnchor="middle"
          fill="#6366f1" fontSize={7.5} fontFamily="Inter, system-ui, sans-serif"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          click to highlight
        </text>
      )}
    </g>
  );
}

/* ─── Edge (curved bezier) ───────────────────────────────────────────────── */
function MindEdge({ fromNode, toNode, color, animDelay }) {
  if (!fromNode || !toNode) return null;

  // Cubic bezier with control points aimed at each node's direction
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const cx1 = fromNode.x + dx * 0.4;
  const cy1 = fromNode.y + dy * 0.1;
  const cx2 = fromNode.x + dx * 0.6;
  const cy2 = fromNode.y + dy * 0.9;

  return (
    <path
      d={`M ${fromNode.x} ${fromNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toNode.x} ${toNode.y}`}
      fill="none"
      stroke={color || COLORS.edge}
      strokeWidth={toNode.depth === 2 ? 1 : 1.5}
      strokeLinecap="round"
      opacity={0.55}
      style={{ animation: `mmFadeIn 0.4s ease ${animDelay}s both` }}
    />
  );
}

/* ─── Loading skeleton ───────────────────────────────────────────────────── */
function MindMapSkeleton() {
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <circle cx={CX} cy={CY} r={ROOT_R} fill="rgba(99,102,241,0.15)" />
      {[0, 1, 2, 3, 4].map(i => {
        const a = (2 * Math.PI / 5) * i - Math.PI / 2;
        const bx = CX + Math.cos(a) * BRANCH_D;
        const by = CY + Math.sin(a) * BRANCH_D;
        return (
          <g key={i}>
            <line x1={CX} y1={CY} x2={bx} y2={by} stroke="rgba(148,163,184,0.12)" strokeWidth={1.5} />
            <circle cx={bx} cy={by} r={BRANCH_R} fill="rgba(99,102,241,0.08)"
              style={{ animation: `mmPulse 1.5s ease ${i * 0.15}s infinite` }} />
          </g>
        );
      })}
      <style>{`
        @keyframes mmPulse {
          0%,100% { opacity:0.4; }
          50% { opacity:0.9; }
        }
      `}</style>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MindMap COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function MindMap({ tree, loading, onNodeClick, height = 520 }) {
  const svgRef = useRef(null);
  const [hoveredId, setHoveredId]   = useState(null);
  const [transform, setTransform]   = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  /* ── Layout ── */
  const { nodes, edges } = useMemo(() => computeLayout(tree), [tree]);

  /* ── Lookup map for edges ── */
  const nodeMap = useMemo(() => {
    const m = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  /* ── Wheel zoom ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({
      ...t,
      scale: Math.min(3, Math.max(0.35, t.scale * delta)),
    }));
  }, []);

  /* ── Drag pan ── */
  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setTransform(t => ({
      ...t,
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    }));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  /* ── Reset view ── */
  const resetView = useCallback(() => setTransform({ x: 0, y: 0, scale: 1 }), []);

  /* ── Attach non-passive wheel listener ── */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  if (loading) return <MindMapSkeleton />;
  if (!tree || !nodes.length) return null;

  const { x: tx, y: ty, scale } = transform;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Controls */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { label: '+', action: () => setTransform(t => ({ ...t, scale: Math.min(3, t.scale * 1.2) })) },
          { label: '−', action: () => setTransform(t => ({ ...t, scale: Math.max(0.35, t.scale / 1.2) })) },
          { label: '⊙', action: resetView },
        ].map(({ label, action }) => (
          <button key={label} onClick={action} style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'rgba(30,30,50,0.85)',
            border: '1px solid rgba(99,102,241,0.35)',
            color: '#94a3b8', fontSize: label === '⊙' ? '0.8rem' : '1.1rem',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        fontSize: '0.68rem', color: 'rgba(148,163,184,0.6)', pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        Scroll to zoom · Drag to pan · Click a leaf to highlight
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{
          display: 'block',
          height,
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.04) 0%, transparent 70%)',
          borderRadius: 16,
          border: '1px solid rgba(99,102,241,0.12)',
          cursor: dragging.current ? 'grabbing' : 'grab',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <style>{`
          @keyframes mmFadeIn {
            from { opacity: 0; transform: scale(0.7); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Subtle radial grid lines */}
        {[0.5, 1, 1.5].map(r => (
          <circle key={r} cx={CX} cy={CY} r={r * BRANCH_D}
            fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={1} strokeDasharray="4 6" />
        ))}

        {/* Pan/zoom group */}
        <g transform={`translate(${tx},${ty}) scale(${scale})`}
          style={{ transformOrigin: `${CX}px ${CY}px` }}>

          {/* Edges first (behind nodes) */}
          {edges.map((e, i) => (
            <MindEdge
              key={`${e.from}→${e.to}`}
              fromNode={nodeMap[e.from]}
              toNode={nodeMap[e.to]}
              color={e.color}
              animDelay={0.05 * i}
            />
          ))}

          {/* Nodes */}
          {nodes.map((n, i) => (
            <MindNode
              key={n.id}
              node={n}
              onNodeClick={onNodeClick}
              hoveredId={hoveredId}
              setHoveredId={setHoveredId}
              animDelay={0.06 * i}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
