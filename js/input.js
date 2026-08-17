const Input = {
  keys: Object.create(null),
  stick: { x: 0, y: 0 },
  grabQueued: false,
  pointerId: null,

  init() {
    window.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if ((e.code === "Space" || e.code === "Enter") && !e.repeat) this.grabQueued = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
    });

    const base = document.getElementById("joyBase");
    const knob = document.getElementById("joyKnob");
    const radius = 34;

    const setStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const mag = Math.hypot(dx, dy) || 1;
      const max = rect.width * 0.5 - 10;
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      this.stick.x = dx / max;
      this.stick.y = dy / max;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    const clearStick = () => {
      this.stick.x = 0;
      this.stick.y = 0;
      this.pointerId = null;
      knob.style.transform = "translate(-50%, -50%)";
    };

    const onDown = (e) => {
      this.pointerId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      setStick(e.clientX, e.clientY);
    };
    const onMove = (e) => {
      if (this.pointerId !== e.pointerId) return;
      setStick(e.clientX, e.clientY);
    };
    const onUp = (e) => {
      if (this.pointerId !== e.pointerId) return;
      clearStick();
    };

    base.addEventListener("pointerdown", onDown);
    base.addEventListener("pointermove", onMove);
    base.addEventListener("pointerup", onUp);
    base.addEventListener("pointercancel", onUp);

    document.getElementById("grabBtn").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.grabQueued = true;
    });

    void radius;
  },

  consumeGrab() {
    const g = this.grabQueued;
    this.grabQueued = false;
    return g;
  },

  vector() {
    let x = this.stick.x;
    let y = this.stick.y;
    if (this.keys.ArrowLeft || this.keys.a || this.keys.A) x -= 1;
    if (this.keys.ArrowRight || this.keys.d || this.keys.D) x += 1;
    if (this.keys.ArrowUp || this.keys.w || this.keys.W) y -= 1;
    if (this.keys.ArrowDown || this.keys.s || this.keys.S) y += 1;
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return { x, y, mag: Math.min(1, mag) };
  },
};
