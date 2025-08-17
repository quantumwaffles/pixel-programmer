// Pixel canvas p5 sketch (renamed from intro.js)
/**
 * @param {import('p5')} p
 */
export default function sketch(p) {

    let penDown = false;
    // Pen holds grid cell coordinates (not pixel units)
    /** @type {p5.Vector} */
    let pen = p.createVector(0, 0);
    let pixelSize = 10;
    let gridLineThickness = 1;
    let showGrid = true;
    // Colors
    let bgColor = p.color(24, 24, 28); // dark background
    let gridColor = p.color(60);       // subtle mid-gray grid
    // Painted pixels: Map key "x,y" -> {h,s,v}
    const painted = new Map();
    // Heading in degrees (0 points to +X / east) used for directional indicator
    let heading = 0;
    // Camera (pan & zoom)
    let cam = p.createVector(0, 0); // translation in screen pixels (post-scale origin shift)
    let zoom = 1;                   // scalar zoom factor
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 8;
    const GRID_ZOOM_THRESHOLD = 0.7; // below this, grid hidden for performance/clarity
    let isPanning = false;
    let panStart = p.createVector(0, 0);
    let camStart = p.createVector(0, 0);
    let isHover = false; // cursor over canvas

    p.setup = function () {
        // Increased default canvas size for a larger drawing area
        p.createCanvas(800, 800);
        p.background(bgColor);
        // Center pen in the grid after canvas created
        pen.x = Math.floor(p.width / (2 * pixelSize));
        pen.y = Math.floor(p.height / (2 * pixelSize));
        // Track hover state for conditional pan/zoom
        if (p.canvas) {
            p.canvas.addEventListener('mouseenter', () => { isHover = true; });
            p.canvas.addEventListener('mouseleave', () => { isHover = false; isPanning = false; });
        }
    };

    p.draw = function () {
        // Clear background each frame
        p.background(bgColor);

        // Establish world transform (pan + zoom)
        p.push();
        p.translate(cam.x, cam.y);
        p.scale(zoom);

    if (showGrid && zoom >= GRID_ZOOM_THRESHOLD) {
            p.push();
            p.stroke(gridColor);
            // Keep grid line thickness visually constant regardless of zoom
            p.strokeWeight(gridLineThickness / zoom);
            p.noFill();
            // Compute visible world rectangle in "world pixels"
            const left = (-cam.x) / zoom;
            const top = (-cam.y) / zoom;
            const right = (p.width - cam.x) / zoom;
            const bottom = (p.height - cam.y) / zoom;
            const firstCol = Math.floor(left / pixelSize) * pixelSize;
            const lastCol = Math.ceil(right / pixelSize) * pixelSize;
            const firstRow = Math.floor(top / pixelSize) * pixelSize;
            const lastRow = Math.ceil(bottom / pixelSize) * pixelSize;
            // Vertical lines
            for (let x = firstCol; x <= lastCol; x += pixelSize) {
                p.line(x, top, x, bottom);
            }
            // Horizontal lines
            for (let y = firstRow; y <= lastRow; y += pixelSize) {
                p.line(left, y, right, y);
            }
            p.pop();
        }

        // Draw painted pixels
        if (painted.size) {
            p.noStroke();
            for (const [key, hsv] of painted) {
                const [cx, cy] = key.split(',').map(Number);
                // Quick cull using visible world rect
                const px0 = cx * pixelSize;
                const py0 = cy * pixelSize;
                const left = (-cam.x) / zoom;
                const top = (-cam.y) / zoom;
                const right = (p.width - cam.x) / zoom;
                const bottom = (p.height - cam.y) / zoom;
                if (px0 + pixelSize < left || px0 > right || py0 + pixelSize < top || py0 > bottom) continue;
                // Convert HSV (0..360,0..100,0..100) to RGB using p5's colorMode
                p.push();
                p.colorMode(p.HSB, 360, 100, 100);
                p.fill(hsv.h, hsv.s, hsv.v);
                p.rect(cx * pixelSize, cy * pixelSize, pixelSize, pixelSize);
                p.pop();
            }
        }

        // Determine current pen (mouse) cell
        // No mouse interaction: pen position & state managed exclusively via exposed API below.

        // Draw pen highlight based on pen vector
        const x0 = pen.x * pixelSize;
        const y0 = pen.y * pixelSize;
        p.push();
        p.noFill();
        // Always outline only (no fill) regardless of pen state
        p.stroke(255, 255, 0);
        p.strokeWeight(Math.max(1, gridLineThickness) / zoom);
        p.rect(x0, y0, pixelSize, pixelSize);
        // Direction indicator (arrow outside the square)
        const cx = x0 + pixelSize / 2;
        const cy = y0 + pixelSize / 2;
        const rad = heading * Math.PI / 180;
        const offset = pixelSize * Math.SQRT2 / 2; // full diagonal (hypotenuse) of the square
        const gap = Math.max(2, pixelSize * 0.1); // small gap beyond square edge
        const shaftLen = pixelSize * 0.45; // length of arrow shaft outside
        // Base point sits just outside the square edge in heading direction
        const bx = cx + Math.cos(rad) * (offset + gap * 0.2);
        const by = cy + Math.sin(rad) * (offset + gap * 0.2);
        const tx = cx + Math.cos(rad) * (offset + gap + shaftLen);
        const ty = cy + Math.sin(rad) * (offset + gap + shaftLen);
        p.stroke(255, 220, 80);
        p.line(bx, by, tx, ty);
        // Arrowhead
        const ah = shaftLen * 0.35;
        const leftRad = rad + Math.PI * 0.75;
        const rightRad = rad - Math.PI * 0.75;
        p.line(tx, ty, tx + Math.cos(leftRad) * ah, ty + Math.sin(leftRad) * ah);
        p.line(tx, ty, tx + Math.cos(rightRad) * ah, ty + Math.sin(rightRad) * ah);
        p.pop();

        // Restore (all world drawing done)
        p.pop();

        // Simple on-screen HUD (top-left) for debugging camera
        p.push();
        p.fill(255);
        p.noStroke();
        p.textSize(12);
        p.text(`Zoom: ${zoom.toFixed(2)}  Pan: (${Math.round(cam.x)},${Math.round(cam.y)})`, 8, 16);
        p.pop();
    };

    // ---------- Pen Control API (accessible via p5 instance) ----------
    // No clamping: infinite grid (camera handles visibility)
    /** Set pen to absolute grid cell */
    p.penSet = function (x, y) { pen.x = Math.floor(x); pen.y = Math.floor(y); };
    /** Move pen by delta cells */
    p.penMove = function (dx, dy) { pen.x += dx; pen.y += dy; };
    /** Raise pen (no fill) */
    p.penUp = function () { penDown = false; };
    /** Lower pen (fill) */
    p.penDown = function () { penDown = true; };
    /** Toggle pen state */
    p.penToggle = function () { penDown = !penDown; };
    /** Get current pen state */
    p.penGet = function () { return { x: pen.x, y: pen.y, down: penDown }; };
    /** Change pixel (cell) size; keeps pen centered proportionally */
    p.setPixelSize = function (size) {
        size = Math.max(1, Math.floor(size));
        if (size === pixelSize) return;
        const centerPx = pen.x * pixelSize + pixelSize / 2;
        const centerPy = pen.y * pixelSize + pixelSize / 2;
        pixelSize = size;
        pen.x = Math.floor(centerPx / pixelSize);
        pen.y = Math.floor(centerPy / pixelSize);
    };
    /** Show / hide grid */
    p.setShowGrid = function (v) { showGrid = !!v; };
    /** Adjust grid color */
    p.setGridColor = function (r, g, b, a) { gridColor = p.color(r, g, b, a); };
    /** Draw / set a pixel color via HSV (expects object with h,s,v) */
    p.drawPixel = function (x, y, hsv) {
        painted.set(`${Math.round(x)},${Math.round(y)}`, { h: hsv.h, s: hsv.s, v: hsv.v });
    };
    /** Clear all painted pixels */
    p.clearPixels = function () { painted.clear(); };
    /** Get current pixel size */
    p.getPixelSize = function () { return pixelSize; };
    /** Set current heading (degrees) */
    p.setHeading = function (deg) { if (Number.isFinite(deg)) heading = ((deg % 360) + 360) % 360; };
    /** Get heading */
    p.getHeading = function () { return heading; };
    /** Camera: reset view */
    p.resetView = function () { cam.set(0, 0); zoom = 1; };
    /** Camera: get current pan & zoom */
    p.getView = function () { return { x: cam.x, y: cam.y, zoom }; };
    /** Center camera on current pen location (keeping current zoom) */
    p.centerOnPen = function () {
        const worldX = pen.x * pixelSize + pixelSize / 2;
        const worldY = pen.y * pixelSize + pixelSize / 2;
        // screen = world*zoom + cam => cam = center - world*zoom
        cam.x = p.width / 2 - worldX * zoom;
        cam.y = p.height / 2 - worldY * zoom;
    };

    // ---------- Mouse Interaction (Pan & Zoom) ----------
    p.mousePressed = function () {
        if (!isHover) return; // only initiate inside canvas
        if (p.mouseButton === p.LEFT) {
            isPanning = true;
            panStart.set(p.mouseX, p.mouseY);
            camStart.set(cam.x, cam.y);
        }
    };

    p.mouseDragged = function () {
        if (isPanning) {
            const dx = p.mouseX - panStart.x;
            const dy = p.mouseY - panStart.y;
            cam.x = camStart.x + dx;
            cam.y = camStart.y + dy;
        }
    };

    p.mouseReleased = function () {
        if (p.mouseButton === p.LEFT) {
            isPanning = false;
        }
    };

    p.mouseWheel = function (event) {
        if (!isHover) return true; // allow page scroll when not over canvas
        const oldZoom = zoom;
        const scaleFactor = 1.05;
        if (event.deltaY < 0) zoom *= scaleFactor; else zoom /= scaleFactor;
        zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
        if (zoom !== oldZoom) {
            // Zoom about mouse position (keep world point under cursor fixed)
            const mx = event.offsetX ?? p.mouseX;
            const my = event.offsetY ?? p.mouseY;
            const wx = (mx - cam.x) / oldZoom;
            const wy = (my - cam.y) / oldZoom;
            cam.x = mx - wx * zoom;
            cam.y = my - wy * zoom;
        }
        return false; // prevent page scroll
    };
}
