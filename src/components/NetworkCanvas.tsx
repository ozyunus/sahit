import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Witness, WitnessEdge } from '../types';
import { soundAdapter } from '../services/soundAdapter';

interface NetworkCanvasProps {
  witnesses: Witness[];
  selectedWitness: Witness | null;
  highlightedIds?: Set<string>;
  connectedEdges: WitnessEdge[];
  onSelectWitness: (witness: Witness | null) => void;
  reducedMotion?: boolean;
  activeClusterTheme?: string | null;
  isPersonalView?: boolean;
  activeWeatherFilter?: string;
}

interface CanvasNode {
  witness: Witness;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  color: string;
  glowColor: string;
  alpha: number;
  labelAlpha: number;
  // Organic breathing parameters (math-driven, zero React re-render overhead)
  breathPhase: number;
  breathSpeed: number;
  envelopePhase: number;
  envelopeSpeed: number;
}

interface BackgroundStar {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

// Celestial organic palette
export const THEME_PALETTE: Record<string, { fill: string; glow: string; label: string; count: number }> = {
  şehir: { fill: '#38bdf8', glow: 'rgba(56, 189, 248, 0.40)', label: 'Şehir', count: 3421 },
  aile: { fill: '#fbbf24', glow: 'rgba(251, 191, 36, 0.40)', label: 'Aile', count: 2318 },
  doğa: { fill: '#34d399', glow: 'rgba(52, 211, 153, 0.40)', label: 'Doğa', count: 1904 },
  insanlar: { fill: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.40)', label: 'İnsanlar', count: 1732 },
  insan: { fill: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.40)', label: 'İnsanlar', count: 1732 },
  yalnızlık: { fill: '#818cf8', glow: 'rgba(129, 140, 248, 0.40)', label: 'Yalnızlık', count: 1281 },
  hayvanlar: { fill: '#f43f5e', glow: 'rgba(244, 63, 94, 0.40)', label: 'Hayvanlar', count: 984 },
  zaman: { fill: '#c084fc', glow: 'rgba(192, 132, 252, 0.40)', label: 'Zaman', count: 841 },
  iş: { fill: '#6366f1', glow: 'rgba(99, 102, 241, 0.40)', label: 'İş', count: 697 },
  diğer: { fill: '#e2e8f0', glow: 'rgba(226, 232, 240, 0.30)', label: 'Diğer', count: 1283 },
};

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  witnesses,
  selectedWitness,
  highlightedIds,
  connectedEdges,
  onSelectWitness,
  reducedMotion = false,
  activeClusterTheme,
  isPersonalView = false,
  activeWeatherFilter = 'all',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport transformation state
  const transformRef = useRef({
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0,
    targetScale: 1,
  });

  const mouseRef = useRef({
    x: -9999,
    y: -9999,
    isDown: false,
    dragStartX: 0,
    dragStartY: 0,
    hasMoved: false,
  });

  const hoveredNodeRef = useRef<CanvasNode | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const starsRef = useRef<BackgroundStar[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const [hoveredWitness, setHoveredWitness] = useState<Witness | null>(null);

  const getThemePalette = (theme?: string, isUser?: boolean) => {
    if (activeWeatherFilter === 'rain') {
      return { fill: '#38bdf8', glow: 'rgba(56, 189, 248, 0.40)' };
    }
    if (isUser && isPersonalView) {
      const lower = theme?.toLowerCase() || 'diğer';
      if (THEME_PALETTE[lower]) return THEME_PALETTE[lower];
    }
    const lower = theme?.toLowerCase() || 'diğer';
    return THEME_PALETTE[lower] || THEME_PALETTE.diğer;
  };

  // Convert raw coordinates to canvas world coordinates
  const syncNodesFromWitnesses = useCallback(() => {
    const width = containerRef.current?.clientWidth || 1000;
    const height = containerRef.current?.clientHeight || 700;
    const spreadX = width * 0.44;
    const spreadY = height * 0.44;

    const existingMap = new Map<string, CanvasNode>();
    for (const n of nodesRef.current) {
      existingMap.set(n.witness.id, n);
    }

    const newNodes: CanvasNode[] = witnesses.map((w, index) => {
      const baseX = width / 2 + w.demo_x * spreadX;
      const baseY = height / 2 + w.demo_y * spreadY;
      const palette = getThemePalette(w.demo_theme, w.is_user);

      const existing = existingMap.get(w.id);
      if (existing) {
        existing.witness = w;
        existing.baseX = baseX;
        existing.baseY = baseY;
        existing.color = palette.fill;
        existing.glowColor = palette.glow;
        return existing;
      }

      // Unique asynchronous breathing parameters for each node
      const breathPhase = (index * 1.7) % (Math.PI * 2);
      const breathSpeed = 0.012 + ((index * 3) % 7) * 0.002;
      const envelopePhase = (index * 2.3) % (Math.PI * 2);
      const envelopeSpeed = 0.0025 + (index % 5) * 0.0006;

      return {
        witness: w,
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        radius: w.is_user ? 4.2 : 3.0,
        color: palette.fill,
        glowColor: palette.glow,
        alpha: 0.85,
        labelAlpha: 0,
        breathPhase,
        breathSpeed,
        envelopePhase,
        envelopeSpeed,
      };
    });

    nodesRef.current = newNodes;

    // Generate cosmic background stars
    if (starsRef.current.length === 0) {
      const starCount = 180;
      const stars: BackgroundStar[] = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width * 2 - width * 0.5,
          y: Math.random() * height * 2 - height * 0.5,
          radius: Math.random() * 1.4 + 0.4,
          baseAlpha: Math.random() * 0.5 + 0.2,
          twinkleSpeed: Math.random() * 0.03 + 0.01,
          phase: Math.random() * Math.PI * 2,
        });
      }
      starsRef.current = stars;
    }
  }, [witnesses, activeWeatherFilter, isPersonalView]);

  useEffect(() => {
    syncNodesFromWitnesses();
  }, [syncNodesFromWitnesses]);

  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      syncNodesFromWitnesses();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncNodesFromWitnesses]);

  // Center on selected witness if selected externally
  useEffect(() => {
    if (!selectedWitness || !containerRef.current) return;
    const targetNode = nodesRef.current.find((n) => n.witness.id === selectedWitness.id);
    if (targetNode) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      transformRef.current.targetScale = Math.max(transformRef.current.scale, 1.3);
      transformRef.current.targetX = width / 2 - targetNode.baseX * transformRef.current.targetScale;
      transformRef.current.targetY = height / 2 - targetNode.baseY * transformRef.current.targetScale;
    }
  }, [selectedWitness]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let frame = 0;

    const render = () => {
      if (!isRunning) return;
      frame++;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Smooth viewport interpolation
      const t = transformRef.current;
      const lerpSpeed = reducedMotion ? 1 : 0.12;
      t.x += (t.targetX - t.x) * lerpSpeed;
      t.y += (t.targetY - t.y) * lerpSpeed;
      t.scale += (t.targetScale - t.scale) * lerpSpeed;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep space black background with subtle cosmic radial gradient
      ctx.fillStyle = '#04060a';
      ctx.fillRect(0, 0, width, height);

      // Background Stars (twinkling)
      ctx.save();
      for (const s of starsRef.current) {
        const twinkle = Math.sin(frame * s.twinkleSpeed + s.phase);
        const currentAlpha = Math.max(0.1, s.baseAlpha + twinkle * 0.25);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 240, 255, ${currentAlpha})`;
        ctx.fill();
      }
      ctx.restore();

      // World Transform
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);

      const worldMouseX = (mouseRef.current.x - t.x) / t.scale;
      const worldMouseY = (mouseRef.current.y - t.y) / t.scale;
      const fisheyeRadius = 140 / Math.sqrt(t.scale);

      const connectedTargetIds = new Set(connectedEdges.map((e) => e.target_id));
      const isAnySelected = Boolean(selectedWitness);

      // Group centroids for gentle nebula glow
      const clusterCenters: Record<string, { count: number; sumX: number; sumY: number; color: string; glow: string }> = {};

      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const themeKey = node.witness.demo_theme?.toLowerCase() || 'diğer';
        if (!clusterCenters[themeKey]) {
          const pal = THEME_PALETTE[themeKey] || THEME_PALETTE.diğer;
          clusterCenters[themeKey] = { count: 0, sumX: 0, sumY: 0, color: pal.fill, glow: pal.glow };
        }
        clusterCenters[themeKey].count++;
        clusterCenters[themeKey].sumX += node.baseX;
        clusterCenters[themeKey].sumY += node.baseY;
      }

      // 1. Draw Soft Nebula Glow Clouds behind clusters
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const themeKey in clusterCenters) {
        const c = clusterCenters[themeKey];
        if (c.count < 3) continue;
        const avgX = c.sumX / c.count;
        const avgY = c.sumY / c.count;
        const cloudRadius = Math.min(220, 70 + Math.sqrt(c.count) * 14);

        const cloudGrad = ctx.createRadialGradient(avgX, avgY, 10, avgX, avgY, cloudRadius);
        cloudGrad.addColorStop(0, c.glow);
        cloudGrad.addColorStop(0.5, c.glow.replace(/[\d\.]+\)$/, '0.10)'));
        cloudGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.arc(avgX, avgY, cloudRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Default durumda genel edge'ler çizilmez; yalnızca dikkat merceği içindeki yakın node'lar arasında çok hafif alt ilişkiler belirir
      if (!mouseRef.current.isDown && worldMouseX > -9000) {
        ctx.save();
        ctx.lineWidth = 0.8;
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          const distA = Math.hypot(a.baseX - worldMouseX, a.baseY - worldMouseY);
          if (distA > fisheyeRadius) continue;

          for (let j = i + 1; j < Math.min(nodes.length, i + 6); j++) {
            const b = nodes[j];
            const distB = Math.hypot(b.baseX - worldMouseX, b.baseY - worldMouseY);
            if (distB > fisheyeRadius) continue;

            const distAB = Math.hypot(a.x - b.x, a.y - b.y);
            if (distAB < 60) {
              const lensAlpha = (1 - Math.max(distA, distB) / fisheyeRadius) * 0.22;
              ctx.strokeStyle = `rgba(255, 255, 255, ${lensAlpha})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // 3. Fisheye Physics & Nearest Hover Detection
      let closestHoverNode: CanvasNode | null = null;
      let minMouseDist = Infinity;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const dx = node.baseX - worldMouseX;
        const dy = node.baseY - worldMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetPosX = node.baseX;
        let targetPosY = node.baseY;
        let targetLabelAlpha = 0;

        if (dist < fisheyeRadius && !mouseRef.current.isDown) {
          const factor = (1 - dist / fisheyeRadius) * 26;
          const angle = Math.atan2(dy, dx);
          targetPosX += Math.cos(angle) * factor;
          targetPosY += Math.sin(angle) * factor;
          targetLabelAlpha = Math.max(0, 1 - dist / (fisheyeRadius * 0.85));

          if (dist < minMouseDist) {
            minMouseDist = dist;
            closestHoverNode = node;
          }
        }

        const isSelected = selectedWitness?.id === node.witness.id;
        const isConnected = connectedTargetIds.has(node.witness.id);
        const isHighlighted = highlightedIds ? highlightedIds.has(node.witness.id) : true;

        if (isSelected || isConnected) {
          targetLabelAlpha = 1;
        }

        if (reducedMotion) {
          node.x = targetPosX;
          node.y = targetPosY;
          node.labelAlpha = targetLabelAlpha;
        } else {
          node.x += (targetPosX - node.x) * 0.16;
          node.y += (targetPosY - node.y) * 0.16;
          node.labelAlpha += (targetLabelAlpha - node.labelAlpha) * 0.14;
        }

        if (isAnySelected) {
          if (isSelected) {
            node.alpha = 1.0;
          } else if (isConnected) {
            node.alpha = 0.95;
          } else {
            node.alpha = 0.15;
          }
        } else if (!isHighlighted) {
          node.alpha = 0.1;
        } else if (activeClusterTheme && node.witness.demo_theme !== activeClusterTheme) {
          node.alpha = 0.25;
        } else {
          node.alpha = 0.85;
        }
      }

      if (closestHoverNode !== hoveredNodeRef.current) {
        hoveredNodeRef.current = closestHoverNode;
        setHoveredWitness(closestHoverNode ? closestHoverNode.witness : null);
        if (closestHoverNode) {
          soundAdapter.playSubtleTick();
        }
      }

      // 4. Draw Selected Strong Edges (Golden / Cyan luminous arcs)
      if (selectedWitness && connectedEdges.length > 0) {
        const sourceNode = nodes.find((n) => n.witness.id === selectedWitness.id);
        if (sourceNode) {
          for (const edge of connectedEdges) {
            const targetNode = nodes.find((n) => n.witness.id === edge.target_id);
            if (!targetNode) continue;

            const edgeScore = edge.semantic_score || 0.8;
            const strokeAlpha = Math.min(0.9, Math.max(0.4, (edgeScore - 0.4) * 1.5));

            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const cpX = midX - dy * 0.15;
            const cpY = midY + dx * 0.15;

            ctx.beginPath();
            ctx.moveTo(sourceNode.x, sourceNode.y);
            ctx.quadraticCurveTo(cpX, cpY, targetNode.x, targetNode.y);

            ctx.strokeStyle = `rgba(251, 191, 36, ${strokeAlpha})`;
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Glowing mid-point particle
            const tMid = 0.5;
            const dotX = (1 - tMid) * (1 - tMid) * sourceNode.x + 2 * (1 - tMid) * tMid * cpX + tMid * tMid * targetNode.x;
            const dotY = (1 - tMid) * (1 - tMid) * sourceNode.y + 2 * (1 - tMid) * tMid * cpY + tMid * tMid * targetNode.y;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
          }
        }
      }

      // 5. Draw Glowing Constellation Nodes with "Breathing Light" and Soft Glow
      // Rule: ~5-10 nodes breathe at any time. Opacity never falls below 0.25.
      // Priority: isSelected > isHovered > isConnected > breathing
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isSelected = selectedWitness?.id === node.witness.id;
        const isConnected = connectedTargetIds.has(node.witness.id);
        const isHovered = hoveredWitness?.id === node.witness.id;

        // Calculate slow organic breathing
        let effectiveAlpha = node.alpha;
        let breathingHaloIntensity = 0.4;

        if (isSelected) {
          effectiveAlpha = 1.0;
          breathingHaloIntensity = 0.8;
        } else if (isHovered) {
          effectiveAlpha = 1.0;
          breathingHaloIntensity = 0.7;
        } else if (isConnected) {
          effectiveAlpha = 0.95;
          breathingHaloIntensity = 0.6;
        } else if (!isAnySelected && !reducedMotion) {
          // Slow activation envelope: smooth bell curve that activates only ~7-10% of nodes at any moment
          const rawEnv = Math.sin(frame * node.envelopeSpeed + node.envelopePhase);
          // Only top 15% of the curve triggers breathing
          const activation = Math.max(0, (rawEnv - 0.70) / 0.30); // 0 when quiet, 0..1 when breathing

          // Smooth slow breathing oscillation between 0.35 and 0.85
          const breathOscillation = 0.55 + 0.30 * Math.sin(frame * node.breathSpeed + node.breathPhase);

          // Blend: resting base alpha (~0.80) to breathing oscillation
          const targetBreathingAlpha = (1 - activation) * 0.80 + activation * breathOscillation;

          // Never let opacity drop below 0.25
          effectiveAlpha = Math.max(0.28, targetBreathingAlpha * node.alpha);
          breathingHaloIntensity = 0.35 + activation * 0.25;
        }

        const effectiveRadius = isSelected
          ? node.radius * 2.5
          : isConnected
          ? node.radius * 1.8
          : isHovered
          ? node.radius * 1.8
          : node.radius;

        // A. Very subtle outer diffuse glow (non-neon)
        ctx.beginPath();
        ctx.arc(node.x, node.y, effectiveRadius * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? 'rgba(255, 255, 255, 0.3)'
          : node.glowColor.replace(/[\d\.]+\)$/, `${effectiveAlpha * 0.30})`);
        ctx.fill();

        // B. Soft organic halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, effectiveRadius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = effectiveAlpha * breathingHaloIntensity;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // C. Bright core star
        ctx.beginPath();
        ctx.arc(node.x, node.y, effectiveRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = effectiveAlpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Text reveal label
        if (node.labelAlpha > 0.05) {
          ctx.save();
          ctx.globalAlpha = node.labelAlpha;

          const text = node.witness.text;
          const shortText = text.length > 34 ? text.slice(0, 32) + '…' : text;

          ctx.font = isSelected
            ? '600 12px "Newsreader", serif'
            : '400 11px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const textMetrics = ctx.measureText(shortText);
          const bgPaddingX = 8;
          const bgPaddingY = 4;
          const textY = node.y + effectiveRadius + 6;

          // Translucent dark container
          ctx.fillStyle = 'rgba(6, 8, 14, 0.9)';
          ctx.fillRect(
            node.x - textMetrics.width / 2 - bgPaddingX,
            textY - 2,
            textMetrics.width + bgPaddingX * 2,
            18 + bgPaddingY
          );

          ctx.strokeStyle = isSelected ? '#fbbf24' : node.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(
            node.x - textMetrics.width / 2 - bgPaddingX,
            textY - 2,
            textMetrics.width + bgPaddingX * 2,
            18 + bgPaddingY
          );

          ctx.fillStyle = '#ffffff';
          ctx.fillText(shortText, node.x, textY + 1);

          ctx.restore();
        }
      }

      // 6. Draw Luminous Cluster Labels in BEN Mode
      if (isPersonalView) {
        ctx.save();
        for (const themeKey in clusterCenters) {
          const c = clusterCenters[themeKey];
          if (c.count === 0) continue;
          const avgX = c.sumX / c.count;
          const avgY = c.sumY / c.count;
          const pal = THEME_PALETTE[themeKey] || THEME_PALETTE.diğer;

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.font = '500 15px "Newsreader", Georgia, serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(pal.label, avgX, avgY - 28);

          ctx.font = '400 11px "Inter", sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(`(${c.count})`, avgX, avgY - 12);
        }
        ctx.restore();
      }

      ctx.restore(); // Restore world transform
      ctx.restore(); // Restore dpr

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    witnesses,
    selectedWitness,
    connectedEdges,
    highlightedIds,
    activeClusterTheme,
    reducedMotion,
    hoveredWitness,
    isPersonalView,
    activeWeatherFilter,
  ]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current.isDown = true;
    mouseRef.current.hasMoved = false;
    mouseRef.current.dragStartX = e.clientX;
    mouseRef.current.dragStartY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    mouseRef.current.x = clientX;
    mouseRef.current.y = clientY;

    if (mouseRef.current.isDown) {
      const dx = e.clientX - mouseRef.current.dragStartX;
      const dy = e.clientY - mouseRef.current.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        mouseRef.current.hasMoved = true;
        transformRef.current.targetX += dx;
        transformRef.current.targetY += dy;
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        mouseRef.current.dragStartX = e.clientX;
        mouseRef.current.dragStartY = e.clientY;
      }
    }
  };

  const handlePointerUp = () => {
    if (!mouseRef.current.hasMoved) {
      if (hoveredNodeRef.current) {
        onSelectWitness(hoveredNodeRef.current.witness);
      } else {
        onSelectWitness(null);
      }
    }
    mouseRef.current.isDown = false;
    mouseRef.current.hasMoved = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
    const t = transformRef.current;
    const newScale = Math.min(3.5, Math.max(0.4, t.targetScale * zoomDelta));

    t.targetX = mouseX - (mouseX - t.targetX) * (newScale / t.targetScale);
    t.targetY = mouseY - (mouseY - t.targetY) * (newScale / t.targetScale);
    t.targetScale = newScale;
  };

  const resetView = () => {
    transformRef.current.targetX = 0;
    transformRef.current.targetY = 0;
    transformRef.current.targetScale = 1;
  };

  const zoomIn = () => {
    transformRef.current.targetScale = Math.min(3.5, transformRef.current.targetScale * 1.3);
  };

  const zoomOut = () => {
    transformRef.current.targetScale = Math.max(0.4, transformRef.current.targetScale * 0.77);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] overflow-hidden select-none bg-[#04060a] cursor-grab active:cursor-grabbing"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          mouseRef.current.x = -9999;
          mouseRef.current.y = -9999;
          mouseRef.current.isDown = false;
          hoveredNodeRef.current = null;
          setHoveredWitness(null);
        }}
        onWheel={handleWheel}
        className="block w-full h-full touch-none"
      />

      {/* Reserved Bottom-Right Control Zone: strictly positioned with safe margin (never collides with other UI) */}
      <div
        id="canvas-bottom-right-control-zone"
        className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 p-1 bg-[#0d1017]/90 backdrop-blur-md rounded-xl border border-white/10 text-xs text-slate-300 shadow-2xl pointer-events-auto"
      >
        <button
          onClick={zoomIn}
          title="Yakınlaş"
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          title="Uzaklaş"
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          −
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
        <button
          onClick={resetView}
          title="Görünümü Sıfırla"
          className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors font-mono text-[11px]"
        >
          Sıfırla
        </button>
      </div>

      {/* Soft Hover Tooltip Indicator */}
      {hoveredWitness && !selectedWitness && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none px-4 py-2 bg-[#0d1017]/95 backdrop-blur-md border border-white/15 rounded-full text-xs text-slate-200 shadow-2xl max-w-[90vw] truncate">
          <span className="font-serif italic mr-1.5">“{hoveredWitness.text.slice(0, 52)}…”</span>
          <span className="text-[11px] text-amber-300/80">· Tıkla ve detayları gör</span>
        </div>
      )}
    </div>
  );
};
