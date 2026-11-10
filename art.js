(() => {
  const canvas = document.getElementById("art");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const blobs = [];
  const particles = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let t = 0;
  let running = true;

  const palette = [
    { r: 26, g: 42, b: 34 },
    { r: 48, g: 72, b: 58 },
    { r: 74, g: 104, b: 84 },
    { r: 108, g: 138, b: 116 },
    { r: 36, g: 58, b: 70 },
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    blobs.length = 0;
    particles.length = 0;
    const count = Math.max(5, Math.floor(width / 220));
    for (let i = 0; i < count; i += 1) {
      const c = palette[i % palette.length];
      blobs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 120 + Math.random() * 180,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.14,
        phase: Math.random() * Math.PI * 2,
        color: c,
      });
    }
    for (let i = 0; i < 55; i += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        s: 0.6 + Math.random() * 1.8,
        sp: 0.15 + Math.random() * 0.45,
        a: 0.15 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.25,
      });
    }
  }

  function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#101612");
    g.addColorStop(0.45, "#15201a");
    g.addColorStop(1, "#0c1418");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBlobs() {
    blobs.forEach((b, i) => {
      b.x += b.vx + Math.sin(t * 0.0004 + b.phase) * 0.12;
      b.y += b.vy + Math.cos(t * 0.00035 + b.phase) * 0.1;
      if (b.x < -b.r) b.x = width + b.r;
      if (b.x > width + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = height + b.r;
      if (b.y > height + b.r) b.y = -b.r;

      const pulse = 1 + Math.sin(t * 0.0008 + b.phase) * 0.08;
      const radius = b.r * pulse;
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      const alpha = 0.18 + (i % 3) * 0.04;
      grad.addColorStop(0, `rgba(${b.color.r},${b.color.g},${b.color.b},${alpha})`);
      grad.addColorStop(1, `rgba(${b.color.r},${b.color.g},${b.color.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRibbon() {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const y =
        height * 0.55 +
        Math.sin(x * 0.006 + t * 0.0007) * 42 +
        Math.cos(x * 0.0025 + t * 0.0004) * 28;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(159, 191, 165, 0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const y =
        height * 0.62 +
        Math.sin(x * 0.005 + t * 0.00055 + 1.4) * 36 +
        Math.cos(x * 0.003 + t * 0.0003) * 22;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(116, 148, 138, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawParticles() {
    particles.forEach((p) => {
      p.y -= p.sp;
      p.x += p.drift + Math.sin(t * 0.001 + p.y * 0.01) * 0.15;
      if (p.y < -4) {
        p.y = height + 4;
        p.x = Math.random() * width;
      }
      ctx.fillStyle = `rgba(232, 238, 233, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function frame(now) {
    if (!running) return;
    t = now;
    drawBackdrop();
    drawBlobs();
    drawRibbon();
    drawParticles();
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });

  window.addEventListener("resize", () => {
    resize();
    seed();
  });

  resize();
  seed();
  requestAnimationFrame(frame);
})();
