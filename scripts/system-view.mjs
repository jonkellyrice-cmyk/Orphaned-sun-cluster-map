import { displayPosition, vectorFromOrbit } from "./system-data.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

function paletteFor(object) {
  if (object.objectClass === "star") {
    if (/memphis/i.test(object.system)) return { fill: "#159a63", core: "#c8ffe0" };
    if (/F\d/i.test(object.type)) return { fill: "#fff1c9", core: "#fffbed" };
    if (/G\d/i.test(object.type)) return { fill: "#f4ce68", core: "#fff0b7" };
    return { fill: "#e98d43", core: "#ffc687" };
  }
  const palette = String(object.visual_palette || "").toLowerCase();
  if (object.objectClass === "giant") return { fill: palette.includes("blue") ? "#668eb6" : "#b58a63", core: "#d8c5a5" };
  if (object.objectClass === "moon") return { fill: "#93a1a6", core: "#d8e0df" };
  if (object.objectClass === "installation") return { fill: "#63d9df", core: "#d2ffff" };
  if (object.objectClass === "vessel") return { fill: "#e5c56a", core: "#fff0b0" };
  if (object.objectClass === "belt") return { fill: "#7f9295", core: "#b8c4c4" };
  if (object.objectClass === "anomaly") return { fill: "#ae66d8", core: "#e1b9fa" };
  if (palette.includes("ocean") || Number(object.water_pct) > 60) return { fill: "#3d82a8", core: "#79c6cc" };
  if (palette.includes("ice") || Number(object.permanent_ice_pct) > 15) return { fill: "#9ebdcc", core: "#dff6f7" };
  if (Number(object.mean_surface_temp_c) > 24) return { fill: "#b76b44", core: "#e6b074" };
  return { fill: "#718d72", core: "#b9c996" };
}

function baseRadius(object) {
  if (object.objectClass === "star") return 11;
  if (object.objectClass === "giant") return 8.5;
  if (object.objectClass === "moon") return 3.6;
  if (object.objectClass === "planet") return clamp(4.6 * Math.sqrt(object.radiusRe || 1), 4.2, 7.4);
  if (object.objectClass === "installation") return 6.5;
  if (object.objectClass === "vessel") return 6;
  return 5;
}

function appendGlyph(group, object, radius, colors) {
  if (object.objectClass === "belt") {
    group.append(svgElement("ellipse", { class: "oscm-system-belt-glyph", rx: 13, ry: 4.5, fill: "none", stroke: colors.fill, "stroke-width": 2, "stroke-dasharray": "2 3" }));
    return;
  }
  if (object.objectClass === "anomaly") {
    group.append(svgElement("circle", { class: "oscm-system-anomaly-glyph", r: 10, fill: colors.fill, opacity: 0.18, stroke: colors.core, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
    return;
  }
  if (object.objectClass === "installation") {
    group.append(svgElement("polygon", { class: "oscm-system-installation-glyph", points: "0,-8 7,0 0,8 -7,0", fill: "rgba(5,18,21,.9)", stroke: colors.fill, "stroke-width": 2 }));
    group.append(svgElement("circle", { r: 2.5, fill: colors.core }));
    return;
  }
  if (object.objectClass === "vessel") {
    group.append(svgElement("path", { class: "oscm-system-vessel-glyph", d: "M -8 5 L 9 0 L -8 -5 L -4 0 Z", fill: colors.fill, stroke: colors.core, "stroke-width": 1 }));
    return;
  }
  const halo = svgElement("circle", { r: radius + 3, fill: colors.fill, opacity: object.objectClass === "star" ? .22 : .1 });
  const body = svgElement("circle", { r: radius, fill: colors.fill, stroke: colors.core, "stroke-width": object.objectClass === "star" ? 1.8 : 1 });
  const highlight = svgElement("circle", { cx: -radius * .28, cy: -radius * .28, r: Math.max(1.2, radius * .28), fill: colors.core, opacity: .72 });
  group.append(halo, body, highlight);
}

export class SystemView {
  constructor(svg, options) {
    this.svg = svg;
    this.model = options.model;
    this.onSelectionChange = options.onSelectionChange ?? (() => {});
    this.onExitRequested = options.onExitRequested ?? (() => {});
    this.onObjectActivate = options.onObjectActivate ?? (() => {});
    this.state = { yaw: -0.62, pitch: 0.82, zoom: 1, panX: 0, panY: 0 };
    this.origin = null;
    this.destination = null;
    this.activePointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.suppressClickUntil = 0;
    this.exitTriggered = false;
    this.pendingSelectionTimer = null;
    this.lastActivation = null;
    this.activationSuppressedUntil = 0;
    this.displayPositions = new Map(this.model.objects.map((object) => [object.id, displayPosition(object, this.model)]));
    this.#buildScene();
    this.#attachEvents();
    this.render();
  }

  destroy() {
    clearTimeout(this.pendingSelectionTimer);
    for (const [name, handler] of Object.entries(this._listeners ?? {})) this.svg.removeEventListener(name, handler);
    this.svg.replaceChildren();
  }

  resetView() {
    Object.assign(this.state, { yaw: -0.62, pitch: 0.82, zoom: 1, panX: 0, panY: 0 });
    this.render();
  }

  clearSelection() {
    this.origin = null;
    this.destination = null;
    this.#syncSelection();
    this.onSelectionChange(null, null);
    this.render();
  }

  #buildScene() {
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", "0 0 900 680");
    const defs = svgElement("defs");
    const filter = svgElement("filter", { id: "oscm-system-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
    filter.append(svgElement("feGaussianBlur", { stdDeviation: 3.2, result: "blur" }));
    const merge = svgElement("feMerge");
    merge.append(svgElement("feMergeNode", { in: "blur" }), svgElement("feMergeNode", { in: "SourceGraphic" }));
    filter.append(merge); defs.append(filter); this.svg.append(defs);
    this.orbitLayer = svgElement("g", { class: "oscm-system-orbit-layer" });
    this.routeLayer = svgElement("g", { class: "oscm-system-route-layer" });
    this.objectLayer = svgElement("g", { class: "oscm-system-object-layer" });
    this.svg.append(this.orbitLayer, this.routeLayer, this.objectLayer);

    this.orbitNodes = [];
    for (const object of this.model.objects) {
      if (!object.parentObject || object.distanceAu <= 0) continue;
      const parentDisplay = this.displayPositions.get(object.parentObject.id) ?? { x: 0, y: 0, z: 0 };
      const display = this.displayPositions.get(object.id);
      const radius = Math.hypot(display.x - parentDisplay.x, display.y - parentDisplay.y, display.z - parentDisplay.z);
      const orbit = svgElement("path", {
        class: `oscm-system-orbit is-${object.distance_unit === "km" ? "local" : "planetary"}${object.objectClass === "belt" ? " is-region" : ""}`,
        fill: "none",
      });
      this.orbitLayer.append(orbit);
      this.orbitNodes.push({ orbit, center: parentDisplay, radius, inclinationDeg: object.inclinationDeg });
    }

    this.objectNodes = new Map();
    for (const object of this.model.objects) {
      if (object.objectClass === "barycenter") continue;
      const group = svgElement("g", {
        class: `oscm-system-object is-${object.objectClass}${object.selectable ? " is-selectable" : ""}`,
        tabindex: object.selectable ? 0 : -1,
        role: object.selectable ? "button" : "img",
        "aria-label": `${object.name}, ${object.type}`,
        "data-object-id": object.id,
      });
      const radius = baseRadius(object), colors = paletteFor(object);
      const hit = svgElement("circle", { class: "oscm-system-hit-target", r: Math.max(13, radius + 7), fill: "transparent" });
      const selection = svgElement("circle", { class: "oscm-system-selection-ring", r: radius + 5, fill: "none" });
      const glyph = svgElement("g", { class: "oscm-system-glyph" });
      appendGlyph(glyph, object, radius, colors);
      const label = svgElement("text", { class: "oscm-system-object-label", x: radius + 8, y: -4 }); label.textContent = object.name;
      const type = svgElement("text", { class: "oscm-system-object-type", x: radius + 8, y: 9 }); type.textContent = object.type;
      const title = svgElement("title"); title.textContent = `${object.name} — ${object.type}; parent: ${object.parent}; reference distance: ${object.distance_from_parent} ${object.distance_unit}`;
      group.append(hit, selection, glyph, label, type, title); this.objectLayer.append(group);
      this.objectNodes.set(object.id, { group, glyph, label, type, selection, object });
      if (object.selectable) {
        group.addEventListener("click", (event) => {
          event.stopPropagation(); if (performance.now() < this.suppressClickUntil) return;
          const now = performance.now();
          if (this.lastActivation?.id === object.id && now - this.lastActivation.at < 330) {
            clearTimeout(this.pendingSelectionTimer); this.pendingSelectionTimer = null; this.lastActivation = null;
            this.activationSuppressedUntil = now + 450; this.onObjectActivate(object); return;
          }
          this.lastActivation = { id: object.id, at: now };
          clearTimeout(this.pendingSelectionTimer); this.pendingSelectionTimer = setTimeout(() => { this.pendingSelectionTimer = null; this.#select(object); }, 260);
        });
        group.addEventListener("dblclick", (event) => {
          event.preventDefault(); event.stopPropagation(); clearTimeout(this.pendingSelectionTimer); this.pendingSelectionTimer = null;
          if (performance.now() < this.activationSuppressedUntil) return;
          this.activationSuppressedUntil = performance.now() + 450; this.onObjectActivate(object);
        });
        group.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.#select(object); } });
      } else if (object.objectClass === "belt") {
        group.addEventListener("click", (event) => {
          event.stopPropagation(); const now = performance.now();
          if (this.lastActivation?.id === object.id && now - this.lastActivation.at < 330) { this.lastActivation = null; this.activationSuppressedUntil = now + 450; this.onObjectActivate(object); }
          else this.lastActivation = { id: object.id, at: now };
        });
        group.addEventListener("dblclick", (event) => { event.preventDefault(); event.stopPropagation(); if (performance.now() >= this.activationSuppressedUntil) this.onObjectActivate(object); });
      }
    }
  }

  #attachEvents() {
    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const beginDrag = (pointer) => { this.drag = { ...pointer, yaw: this.state.yaw, pitch: this.state.pitch }; this.pinch = null; };
    const beginPinch = () => {
      const points = [...this.activePointers.values()].slice(0, 2); if (points.length < 2) return;
      this.drag = null; this.pinch = { ids: points.map((p) => p.id), distance: distance(points[0], points[1]), zoom: this.state.zoom };
      this.suppressClickUntil = performance.now() + 350;
    };
    this._listeners = {
      pointerdown: (event) => {
        const pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startsOnObject: Boolean(event.target.closest?.(".oscm-system-object")) };
        this.activePointers.set(pointer.id, pointer); if (!pointer.startsOnObject) this.svg.setPointerCapture?.(pointer.id);
        if (this.activePointers.size === 1) beginDrag(pointer); else beginPinch();
      },
      pointermove: (event) => {
        const pointer = this.activePointers.get(event.pointerId); if (!pointer) return;
        pointer.x = event.clientX; pointer.y = event.clientY;
        if (this.pinch) {
          const [a, b] = this.pinch.ids.map((id) => this.activePointers.get(id)); if (!a || !b) return;
          const requestedZoom = this.pinch.zoom * distance(a, b) / this.pinch.distance;
          if (requestedZoom < .34 && !this.exitTriggered) { this.exitTriggered = true; this.onExitRequested(); return; }
          this.state.zoom = clamp(requestedZoom, .38, 4.2);
          this.suppressClickUntil = performance.now() + 350; this.render(); return;
        }
        if (!this.drag || this.drag.id !== event.pointerId) return;
        const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 5) { this.suppressClickUntil = performance.now() + 250; this.svg.setPointerCapture?.(event.pointerId); }
        this.state.yaw = this.drag.yaw + dx * .008;
        this.state.pitch = clamp(this.drag.pitch + dy * .008, -1.45, 1.45); this.render();
      },
      pointerup: (event) => {
        if (!this.activePointers.delete(event.pointerId)) return; this.svg.releasePointerCapture?.(event.pointerId);
        if (this.activePointers.size >= 2) beginPinch();
        else if (this.activePointers.size === 1) beginDrag([...this.activePointers.values()][0]);
        else { this.drag = null; this.pinch = null; }
      },
      pointercancel: (event) => this._listeners.pointerup(event),
      wheel: (event) => {
        event.preventDefault();
        const requestedZoom = this.state.zoom * Math.exp(-event.deltaY * .0012);
        if (event.deltaY > 0 && requestedZoom < .34 && !this.exitTriggered) { this.exitTriggered = true; this.onExitRequested(); return; }
        this.state.zoom = clamp(requestedZoom, .38, 4.2);
        if (event.deltaY < 0 && this.state.zoom > 4.1 && this.origin && performance.now() >= this.activationSuppressedUntil) {
          this.activationSuppressedUntil = performance.now() + 600; this.onObjectActivate(this.origin); return;
        }
        this.render();
      },
      dblclick: (event) => { if (!event.target.closest?.(".oscm-system-object")) this.resetView(); },
    };
    for (const [name, handler] of Object.entries(this._listeners)) this.svg.addEventListener(name, handler, name === "wheel" ? { passive: false } : undefined);
  }

  #select(object) {
    if (!this.origin || this.destination) { this.origin = object; this.destination = null; }
    else if (this.origin.id === object.id) { this.origin = null; this.destination = null; }
    else this.destination = object;
    this.#syncSelection(); this.onSelectionChange(this.origin, this.destination); this.render();
  }

  #syncSelection() {
    for (const { group, object } of this.objectNodes.values()) {
      group.classList.toggle("is-origin", this.origin?.id === object.id);
      group.classList.toggle("is-destination", this.destination?.id === object.id);
    }
  }

  #project(point) {
    const { yaw, pitch, zoom, panX, panY } = this.state;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const x1 = point.x * cosY - point.z * sinY, z1 = point.x * sinY + point.z * cosY;
    const y2 = point.y * cosP - z1 * sinP, z2 = point.y * sinP + z1 * cosP;
    const scale = 85 * zoom, perspective = 850 / (850 - z2 * scale * .16);
    return { x: 450 + panX + x1 * scale * perspective, y: 340 + panY - y2 * scale * perspective, z: z2, scale: perspective };
  }

  render() {
    for (const node of this.orbitNodes) {
      const points = Array.from({ length: 49 }, (_, index) => {
        const local = vectorFromOrbit(node.radius, index * 7.5, node.inclinationDeg);
        return this.#project({ x: node.center.x + local.x, y: node.center.y + local.y, z: node.center.z + local.z });
      });
      node.orbit.setAttribute("d", points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ") + " Z");
    }
    const projected = [];
    for (const node of this.objectNodes.values()) {
      const point = this.#project(this.displayPositions.get(node.object.id)); projected.push({ ...node, point });
      node.group.setAttribute("transform", `translate(${point.x} ${point.y})`);
      node.glyph.setAttribute("transform", `scale(${clamp(point.scale, .72, 1.3)})`);
    }
    projected.sort((a, b) => a.point.z - b.point.z).forEach((node) => this.objectLayer.append(node.group));
    this.routeLayer.replaceChildren();
    if (this.origin && this.destination) {
      const a = this.#project(this.displayPositions.get(this.origin.id)), b = this.#project(this.displayPositions.get(this.destination.id));
      this.routeLayer.append(svgElement("line", { class: "oscm-system-route-line", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    }
  }
}
