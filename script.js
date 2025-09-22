/* ---------- Wheel Class Definition ---------- */
class Wheel {
    /* ---------- Constructor ---------- */
    constructor(canvas) {
        /* ---------- Canvas & Context Setup ---------- */
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cw = canvas.width;
        this.ch = canvas.height;
        this.cx = this.cw / 2;
        this.cy = this.ch / 2;

        /* ---------- Layers & State ---------- */
        this.layers = [];
        this.selectedLayerId = null;
        this.running = false;
        this.animationId = null;

        /* ---------- DOM Elements ---------- */
        const wrap = canvas.parentElement;
        this.layersListEl = wrap.querySelector('.layers-list');
        this.selLayerNameEl = wrap.querySelector('.selLayerName');
        this.sectorCountInput = wrap.querySelector('.sectorCountInput');
        this.sectorFormBox = wrap.querySelector('.sectorFormBox');
        this.sectorForm = wrap.querySelector('.sectorForm');
        this.resultsBox = wrap.querySelector('.results');
        this.layerNameInput = wrap.querySelector('.layerNameInput');

        /* ---------- Popup for Results ---------- */
        this.popup = document.createElement('div');
        Object.assign(this.popup.style, {
            position: 'absolute',
            left: canvas.offsetLeft + 'px',
            top: canvas.offsetTop + 'px',
            width: canvas.width + 'px',
            height: canvas.height + 'px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: '700',
            fontSize: '20px',
            pointerEvents: 'auto',
            textAlign: 'center',
            border: '3px solid #60a5fa',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.7)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            opacity: 0,
            cursor: 'pointer',
            transition: 'opacity 0.3s'
        });
        canvas.parentElement.appendChild(this.popup);
        this.popup.addEventListener('click', () => { this.popup.style.opacity = 0; });

        /* ---------- Event Listeners ---------- */
        canvas.addEventListener('dblclick', e => this.onDblClick(e));
        canvas.addEventListener('click', e => this.onClick(e));

        /* ---------- Load Saved Layers or Default ---------- */
        this.loadFromStorage() || this.initDefaultLayers();

        /* ---------- Layer Name Input ---------- */
        if (this.layerNameInput) {
            this.layerNameInput.addEventListener('input', (e) => {
                if (!this.selectedLayerId) return;
                const layer = this.layers.find(l => l.id === this.selectedLayerId);
                layer.name = e.target.value.trim() || `Layer ${this.layers.findIndex(l => l.id === this.selectedLayerId) + 1}`;
                this.refreshLayerList();
                this.saveToStorage();
            });
        }

        this.draw();
        this.refreshLayerList();
    }

    /* ---------- Initialize Default Layers ---------- */
    initDefaultLayers() {
        this.createLayer(8);
        this.createLayer(6);
        this.createLayer(4);
    }

    /* ---------- Utility Functions ---------- */
    randColor(i) {
        const hues = [15, 28, 42, 120, 190, 220, 270, 330];
        const h = hues[i % hues.length] + (i * 13) % 30;
        return `hsl(${h} 70% 60%)`;
    }
    degToRad(d) { return d * Math.PI / 180; }
    radToDeg(r) { return r * 180 / Math.PI; }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '', lineCount = 0;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillStyle = "#031428";
                ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
                line = words[n] + ' '; lineCount++;
            } else { line = testLine; }
        }
        ctx.fillStyle = "#031428";
        ctx.fillText(line.trim(), x, y + lineCount * lineHeight);
    }

    /* ---------- Layer Radii Calculation ---------- */
    recomputeRadii() {
        const totalSpace = Math.min(this.cw, this.ch) / 2 - 12;
        if (this.layers.length === 0) return;
        const spacing = 6;
        const ringWidth = Math.floor((totalSpace - (this.layers.length - 1) * spacing) / this.layers.length);
        for (let i = 0; i < this.layers.length; i++) {
            const outer = totalSpace - (i * (ringWidth + spacing));
            const inner = outer - ringWidth;
            this.layers[i].radiusOuter = outer;
            this.layers[i].radiusInner = inner;
        }
    }

    /* ---------- Draw Wheel ---------- */
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.cw, this.ch);

        /* ---------- Draw Layers ---------- */
        for (let L = 0; L < this.layers.length; L++) {
            const layer = this.layers[L];
            const n = layer.sectors.length;
            const outer = layer.radiusOuter, inner = layer.radiusInner;
            const arc = 2 * Math.PI / n;
            for (let i = 0; i < n; i++) {
                const a0 = -Math.PI / 2 + (i * arc) + this.degToRad(layer.rotationDeg);
                const a1 = a0 + arc;
                ctx.beginPath();
                ctx.moveTo(this.cx, this.cy);
                ctx.arc(this.cx, this.cy, outer, a0, a1);
                ctx.arc(this.cx, this.cy, inner, a1, a0, true);
                ctx.closePath();
                ctx.fillStyle = this.randColor(L + i);
                ctx.fill();
                ctx.strokeStyle = "rgba(0,0,0,0.35)";
                ctx.lineWidth = 0.8;
                ctx.stroke();

                /* ---------- Draw Labels ---------- */
                const mid = (a0 + a1) / 2;
                const label = layer.sectors[i].label;
                ctx.save();
                const labelRadius = (inner + outer) / 2;
                ctx.translate(this.cx + Math.cos(mid) * labelRadius, this.cy + Math.sin(mid) * labelRadius);
                ctx.rotate(mid + Math.PI / 2);
                const fontSize = Math.max(8, (outer - inner) * 0.25);
                ctx.font = `${fontSize}px system-ui,Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                this.wrapText(ctx, label, 0, 0, (outer - inner) * 1.4, fontSize * 0.9);
                ctx.restore();
            }
        }

        /* ---------- Draw Pointer ---------- */
        const lastInner = this.layers.length ? this.layers[this.layers.length - 1].radiusInner : 20;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy - lastInner - 12);
        ctx.lineTo(this.cx - 10, this.cy - lastInner + 12);
        ctx.lineTo(this.cx + 10, this.cy - lastInner + 12);
        ctx.closePath();
        ctx.fillStyle = "#fff";
        ctx.fill();
    }

    /* ---------- Create New Layer ---------- */
    createLayer(sectors = 6) {
        const id = Date.now().toString(36) + Math.floor(Math.random() * 1000);
        const layer = {
            id,
            name: `Layer ${this.layers.length + 1}`,
            sectors: [],
            rotationDeg: 0,
            isSpinning: false,
            targetDeg: 0
        };
        for (let i = 0; i < sectors; i++) layer.sectors.push({ label: `Item ${i + 1}` });
        this.layers.push(layer);
        this.recomputeRadii();
        this.selectLayer(id);
        this.draw();
        this.refreshLayerList();
        this.saveToStorage();
    }

    /* ---------- Layer Selection ---------- */
    selectLayer(id) {
        this.selectedLayerId = id;
        this.refreshLayerList();
        this.draw();
        this.showSectorForm(this.layers.find(l => l.id === id));

        const layer = this.layers.find(l => l.id === id);
        if (this.layerNameInput) this.layerNameInput.value = layer.name;
    }

    /* ---------- Refresh Layer List UI ---------- */
    refreshLayerList() {
        this.layersListEl.innerHTML = '';
        this.layers.forEach((l, i) => {
            const item = document.createElement('div');
            item.className = 'layer-item' + (l.id === this.selectedLayerId ? ' selected' : '');
            item.innerHTML = `<div><strong>${l.name}</strong> <div class="small">${l.sectors.length} sectors</div></div>
            <div class="small">id:${l.id.slice(-4)}</div>`;
            item.onclick = () => this.selectLayer(l.id);
            this.layersListEl.appendChild(item);
        });
        this.selLayerNameEl.textContent = this.selectedLayerId ? this.layers.find(l => l.id === this.selectedLayerId).name : 'None';
    }

    /* ---------- Sector Form ---------- */
    showSectorForm(layer) {
        if (!layer) { this.sectorFormBox.style.display = 'none'; return; }
        this.sectorFormBox.style.display = 'block';
        this.sectorForm.innerHTML = '';
        layer.sectors.forEach((sec, i) => {
            const div = document.createElement('div');
            div.style.marginBottom = "4px";
            div.innerHTML = `<label class="small">Sector ${i + 1}</label>
            <input type="text" data-idx="${i}" value="${sec.label}"/>`;
            this.sectorForm.appendChild(div);
        });
    }

    saveSectorLabels() {
        if (!this.selectedLayerId) return;
        const layer = this.layers.find(l => l.id === this.selectedLayerId);
        const inputs = this.sectorForm.querySelectorAll('input[type=text]');
        inputs.forEach(input => {
            const idx = parseInt(input.dataset.idx);
            layer.sectors[idx].label = input.value.trim() || `Item ${idx + 1}`;
        });
        this.draw();
        this.refreshLayerList();
        this.saveToStorage();
    }

    applySectorCount() {
        if (!this.selectedLayerId) return;
        const n = parseInt(this.sectorCountInput.value);
        if (isNaN(n) || n < 2 || n > 24) return alert('Sectors between 2 and 24');
        const layer = this.layers.find(l => l.id === this.selectedLayerId);
        const cur = layer.sectors.length;
        if (n > cur) {
            for (let i = cur; i < n; i++) layer.sectors.push({ label: `Item ${i + 1}` });
        } else {
            layer.sectors.length = n;
        }
        this.draw();
        this.refreshLayerList();
        this.saveToStorage();
    }

    /* ---------- Remove Layer ---------- */
    removeSelectedLayer() {
        if (!this.selectedLayerId) return alert('Select a layer first');
        const idx = this.layers.findIndex(l => l.id === this.selectedLayerId);
        if (idx >= 0) {
            this.layers.splice(idx, 1);
            this.recomputeRadii();
            this.selectedLayerId = this.layers.length ? this.layers[0].id : null;
            this.refreshLayerList();
            this.draw();
            this.saveToStorage();
        }
    }

    /* ---------- Spin / Stop ---------- */
    spinAll() {
        if (this.running) return;
        this.running = true;
        this.resultsBox.textContent = "Spinning...";
        const now = performance.now();
        this.layers.forEach((layer, i) => {
            layer.isSpinning = true;
            const base = 360 * (3 + Math.floor(Math.random() * 3));
            const extra = Math.random() * 360;
            layer.startDeg = layer.rotationDeg % 360;
            layer.targetDeg = layer.startDeg + base + extra + (Math.random() * 30 - 15);
            layer.startTime = now;
            layer.duration = 2200 + i * 350 + Math.floor(Math.random() * 700);
        });
        this.animate(now);
    }

    stopAll() {
        this.layers.forEach(layer => this.snapLayerToSector(layer));
        this.running = false;
        cancelAnimationFrame(this.animationId);
        this.draw();
        this.showResults();
        this.saveToStorage();
    }

    /* ---------- Animation ---------- */
    animate(now) {
        let allStopped = true;
        this.layers.forEach(layer => {
            if (!layer.isSpinning) return;
            const elapsed = performance.now() - layer.startTime;
            const t = Math.min(1, elapsed / layer.duration);
            const ease = 1 - Math.pow(1 - t, 3);
            layer.rotationDeg = layer.startDeg + (layer.targetDeg - layer.startDeg) * ease;
            if (t >= 1) {
                layer.isSpinning = false;
                this.snapLayerToSector(layer);
            } else allStopped = false;
        });
        this.draw();
        if (allStopped) { this.running = false; this.showResults(); this.saveToStorage(); }
        else this.animationId = requestAnimationFrame(() => this.animate());
    }

    /* ---------- Snap Layer to Sector ---------- */
    snapLayerToSector(layer) {
        const n = layer.sectors.length;
        const rot = ((layer.rotationDeg % 360) + 360) % 360;
        const anglePer = 360 / n;
        let pointerAngle = -90 - rot;
        pointerAngle = ((pointerAngle % 360) + 360) % 360;
        let idx = Math.floor(pointerAngle / anglePer);
        idx = (n - idx) % n;
        const sectorMid = idx * anglePer + anglePer / 2;
        const targetRot = 0 - sectorMid;
        const k = Math.round((rot - targetRot) / 360);
        const finalRot = targetRot + k * 360;
        layer.rotationDeg += finalRot - rot;
        layer.rotationDeg = ((layer.rotationDeg % 360) + 360) % 360;
        layer.selectedIndex = idx;
    }

    /* ---------- Show Results ---------- */
    showResults() {
        if (this.layers.length === 0) return;

        let html = '';
        this.layers.forEach((l, i) => {
            const idx = (l.selectedIndex === undefined) ? this.computeSelectedIndex(l) : l.selectedIndex;
            const label = l.sectors[idx] ? l.sectors[idx].label : '—';
            html += `Layer ${i + 1}: ${label}<br>`;
        });

        this.popup.innerHTML = html;
        this.popup.style.opacity = 1;

        if (this.resultsBox) {
            let list = '<ul style="padding-left:18px;margin:0">';
            this.layers.forEach((l, i) => {
                const idx = (l.selectedIndex === undefined) ? this.computeSelectedIndex(l) : l.selectedIndex;
                const label = l.sectors[idx] ? l.sectors[idx].label : '—';
                list += `<li><strong>${l.name}:</strong> Sector ${idx + 1} — ${label}</li>`;
            });
            list += '</ul>';
            this.resultsBox.innerHTML = list;
        }
    }

    /* ---------- Compute Selected Index ---------- */
    computeSelectedIndex(layer) {
        const n = layer.sectors.length;
        const rot = ((layer.rotationDeg % 360) + 360) % 360;
        let pointerAngle = 0 - rot;
        pointerAngle = ((pointerAngle % 360) + 360) % 360;
        let idx = Math.floor(pointerAngle / (360 / n));
        idx = (n - idx) % n;
        return idx;
    }

    /* ---------- Canvas Interaction ---------- */
    onDblClick(ev) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left - this.cx;
        const y = ev.clientY - rect.top - this.cy;
        alert(`Canvas clicked at relative (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }
    onClick(ev) { /* placeholder */ }

    /* ---------- Local Storage ---------- */
    saveToStorage() { localStorage.setItem('multiWheel', JSON.stringify(this.layers)); }
    loadFromStorage() {
        const data = localStorage.getItem('multiWheel');
        if (!data) return false;
        try {
            const arr = JSON.parse(data);
            this.layers = arr.map(l => ({ ...l }));
            this.recomputeRadii();
            this.selectedLayerId = this.layers.length ? this.layers[0].id : null;
            return true;
        } catch { return false; }
    }
}

/* ---------- Initialize All Wheels ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const wheels = [];
    document.querySelectorAll('canvas').forEach(c => wheels.push(new Wheel(c)));

    /* ---------- Global Buttons ---------- */
    document.querySelectorAll('.spinAllBtn').forEach(btn => btn.addEventListener('click', () => wheels.forEach(w => w.spinAll())));
    document.querySelectorAll('.stopAllBtn').forEach(btn => btn.addEventListener('click', () => wheels.forEach(w => w.stopAll())));
    document.querySelectorAll('.addLayerBtn').forEach(btn => btn.addEventListener('click', () => wheels[0].createLayer(6)));
    document.querySelectorAll('.removeLayerBtn').forEach(btn => btn.addEventListener('click', () => wheels[0].removeSelectedLayer()));
    document.querySelectorAll('.applySectorCountBtn').forEach(btn => btn.addEventListener('click', () => wheels[0].applySectorCount()));
    document.querySelectorAll('.saveSectorLabelsBtn').forEach(btn => btn.addEventListener('click', () => wheels[0].saveSectorLabels()));
});
