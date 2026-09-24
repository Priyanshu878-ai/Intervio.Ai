import React, { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
}

export const FuturisticBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let isTabActive = true;

    // Mouse parallax state with smooth linear interpolation (lerp)
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      // Normalize mouse to -1 .. 1 from screen center
      targetMouseX = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      targetMouseY = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
    };

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Create 3D points on a geometric floating neural topology
    const points: Point3D[] = [];
    const GRID_COLS = 8;
    const GRID_ROWS = 6;
    const SPACING_X = 140;
    const SPACING_Y = 120;
    const DEPTH_SPAN = 600;

    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const x = (c - (GRID_COLS - 1) / 2) * SPACING_X;
        const y = (r - (GRID_ROWS - 1) / 2) * SPACING_Y;
        const z = ((c + r) % 5) * 80 - 200;
        points.push({
          x,
          y,
          z,
          baseX: x,
          baseY: y,
          baseZ: z,
          phase: Math.random() * Math.PI * 2,
          speed: 0.008 + Math.random() * 0.006,
        });
      }
    }

    // Add orbiting accent nodes
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const rad = 260 + (i % 3) * 60;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad * 0.6;
      const z = ((i % 4) - 2) * 120;
      points.push({
        x,
        y,
        z,
        baseX: x,
        baseY: y,
        baseZ: z,
        phase: angle,
        speed: 0.005 + (i % 2) * 0.004,
      });
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    let time = 0;

    const render = () => {
      if (!isTabActive) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.012;

      // Smooth mouse easing
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const focalLength = Math.max(width, height) * 0.75;

      // Rotation angles driven by ambient flow + subtle cursor interaction
      const rotY = mouseX * 0.22 + Math.sin(time * 0.4) * 0.08;
      const rotX = -mouseY * 0.18 + Math.cos(time * 0.35) * 0.06;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Project 3D points
      interface ProjectedPoint {
        sx: number;
        sy: number;
        scale: number;
        alpha: number;
        orig: Point3D;
      }

      const projected: ProjectedPoint[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // Ambient undulating motion
        const currX = p.baseX + Math.sin(time * p.speed * 80 + p.phase) * 18;
        const currY = p.baseY + Math.cos(time * p.speed * 70 + p.phase) * 14;
        const currZ = p.baseZ + Math.sin(time * p.speed * 60 + p.phase) * 35;

        // 3D rotation around Y then X
        const x1 = currX * cosY + currZ * sinY;
        const z1 = -currX * sinY + currZ * cosY;

        const y2 = currY * cosX - z1 * sinX;
        const z2 = currY * sinX + z1 * cosX + 450; // Camera distance offset

        if (z2 > 20) {
          const scale = focalLength / z2;
          const sx = centerX + x1 * scale;
          const sy = centerY + y2 * scale;
          // Depth fading
          const depthAlpha = Math.max(0.1, Math.min(0.65, 1 - (z2 - 150) / DEPTH_SPAN));
          projected.push({ sx, sy, scale, alpha: depthAlpha, orig: p });
        }
      }

      // Draw glowing cyber filaments between adjacent nodes
      ctx.lineWidth = 1;
      const maxDist = 175;
      const maxDistSq = maxDist * maxDist;

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          const dx = p1.sx - p2.sx;
          const dy = p1.sy - p2.sy;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const factor = 1 - Math.sqrt(distSq) / maxDist;
            const lineAlpha = factor * Math.min(p1.alpha, p2.alpha) * 0.22;

            if (lineAlpha > 0.015) {
              const grad = ctx.createLinearGradient(p1.sx, p1.sy, p2.sx, p2.sy);
              grad.addColorStop(0, `rgba(6, 182, 212, ${lineAlpha})`);   // Cyan
              grad.addColorStop(1, `rgba(99, 102, 241, ${lineAlpha * 0.8})`); // Indigo

              ctx.strokeStyle = grad;
              ctx.beginPath();
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.stroke();
            }
          }
        }
      }

      // Draw points with ambient glowing pulses
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const pulse = 0.8 + Math.sin(time * 3 + p.orig.phase) * 0.2;
        const radius = Math.max(1.2, p.scale * 2.2 * pulse);

        // Node outer glow
        const glowRad = radius * 4;
        const glowGrad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, glowRad);
        glowGrad.addColorStop(0, `rgba(6, 182, 212, ${p.alpha * 0.35})`);
        glowGrad.addColorStop(0.5, `rgba(99, 102, 241, ${p.alpha * 0.15})`);
        glowGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* 3D Dynamic Interactive Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block opacity-75" />

      {/* Cyberpunk Grid Overlay with Radial Vignette */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 85%)',
        }}
      />

      {/* Ambient Atmospheric Cyan & Violet Depth Orbs */}
      <div 
        className="absolute -top-[15%] left-[10%] w-[650px] h-[650px] rounded-full filter blur-[100px] opacity-25"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(99, 102, 241, 0) 70%)',
          animation: 'floatOrb 24s ease-in-out infinite alternate',
        }}
      />
      <div 
        className="absolute top-[35%] -right-[10%] w-[600px] h-[600px] rounded-full filter blur-[110px] opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(6, 182, 212, 0) 70%)',
          animation: 'floatOrb2 28s ease-in-out infinite alternate',
        }}
      />
    </div>
  );
};

export default FuturisticBackground;
