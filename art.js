(() => {
  const canvas = document.getElementById("art");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let t0 = performance.now();
  let running = true;
  const stars = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars.length = 0;
    const count = Math.floor((width * height) / 18000);
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.55,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.45 + 0.15,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  function sky(now) {
    const drift = Math.sin(now * 0.00008) * 0.04;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#0b1218");
    g.addColorStop(0.35 + drift, "#15242a");
    g.addColorStop(0.62, "#1c2c28");
    g.addColorStop(0.78, "#24362c");
    g.addColorStop(1, "#101812");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function glow(now) {
    const cx = width * (0.62 + Math.sin(now * 0.00005) * 0.03);
    const cy = height * 0.28;
    const r = Math.max(width, height) * 0.42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(186, 168, 120, 0.16)");
    g.addColorStop(0.35, "rgba(110, 140, 130, 0.08)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(now) {
    stars.forEach((s) => {
      const twinkle = 0.55 + 0.45 * Math.sin(now * 0.0015 + s.tw);
      ctx.beginPath();
      ctx.fillStyle = `rgba(230, 236, 228, ${s.a * twinkle})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function hills(now) {
    const base = height * 0.68;
    const shift = Math.sin(now * 0.00012) * 8;

    const drawHill = (offset, amp, color, yBias) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        const y =
          base +
          yBias +
          Math.sin(x * 0.0035 + offset + now * 0.00008) * amp +
          Math.sin(x * 0.0012 + offset * 0.4) * (amp * 0.45) +
          shift * 0.15;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    drawHill(0.2, 28, "#15221d", -18);
    drawHill(1.4, 22, "#121c18", 10);
    drawHill(2.6, 16, "#0e1613", 34);
  }

  function mist(now) {
    for (let i = 0; i < 3; i += 1) {
      const y = height * (0.55 + i * 0.1) + Math.sin(now * 0.0002 + i) * 12;
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 50);
      g.addColorStop(0, "rgba(180, 200, 190, 0)");
      g.addColorStop(0.5, `rgba(170, 190, 180, ${0.045 + i * 0.01})`);
      g.addColorStop(1, "rgba(180, 200, 190, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40, width, 90);
    }

    // slow drifting band
    const bandX = ((now * 0.015) % (width + 240)) - 120;
    const band = ctx.createRadialGradient(bandX, height * 0.6, 10, bandX, height * 0.6, 180);
    band.addColorStop(0, "rgba(200, 214, 205, 0.07)");
    band.addColorStop(1, "rgba(200, 214, 205, 0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, width, height);
  }

  function water(now) {
    const y0 = height * 0.78;
    const g = ctx.createLinearGradient(0, y0, 0, height);
    g.addColorStop(0, "rgba(18, 30, 28, 0.0)");
    g.addColorStop(0.15, "rgba(14, 24, 22, 0.75)");
    g.addColorStop(1, "#0a100e");
    ctx.fillStyle = g;
    ctx.fillRect(0, y0 - 20, width, height - y0 + 20);

    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const y =
        y0 +
        Math.sin(x * 0.01 + now * 0.0006) * 3.5 +
        Math.sin(x * 0.003 + now * 0.00025) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(186, 200, 188, 0.12)";
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  function frame(now) {
    if (!running) return;
    sky(now);
    glow(now);
    drawStars(now);
    hills(now);
    mist(now);
    water(now);
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
  void t0;
})();
