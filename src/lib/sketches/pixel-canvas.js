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

    p.setup = function () {
    // Increased default canvas size for a larger drawing area
    p.createCanvas(800, 800);
    p.background(bgColor);
    // Center pen in the grid after canvas created
    pen.x = Math.floor(p.width / (2 * pixelSize));
    pen.y = Math.floor(p.height / (2 * pixelSize));
    };

    p.draw = function () {
        // Clear background each frame
    p.background(bgColor);

        if (showGrid) {
            p.push();
            p.stroke(gridColor);
            p.strokeWeight(gridLineThickness);
            p.noFill();

            // Vertical lines
            for (let x = 0; x <= p.width; x += pixelSize) {
                p.line(x, 0, x, p.height);
            }
            // Horizontal lines
            for (let y = 0; y <= p.height; y += pixelSize) {
                p.line(0, y, p.width, y);
            }
            p.pop();
        }

        // Draw painted pixels
        if (painted.size) {
            p.noStroke();
            for (const [key, hsv] of painted) {
                const [cx, cy] = key.split(',').map(Number);
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
        p.strokeWeight(Math.max(1, gridLineThickness));
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
    };

    // ---------- Pen Control API (accessible via p5 instance) ----------
    /** Clamp pen to grid bounds */
    function clampPen() {
        const maxX = Math.floor(p.width / pixelSize) - 1;
        const maxY = Math.floor(p.height / pixelSize) - 1;
        pen.x = Math.min(Math.max(0, pen.x), maxX);
        pen.y = Math.min(Math.max(0, pen.y), maxY);
    }

    /** Set pen to absolute grid cell */
    p.penSet = function (x, y) { pen.x = Math.floor(x); pen.y = Math.floor(y); clampPen(); };
    /** Move pen by delta cells */
    p.penMove = function (dx, dy) { pen.x += dx; pen.y += dy; clampPen(); };
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
        clampPen();
    };
    /** Show / hide grid */
    p.setShowGrid = function (v) { showGrid = !!v; };
    /** Adjust grid color */
    p.setGridColor = function (r, g, b, a) { gridColor = p.color(r, g, b, a); };
    /** Draw / set a pixel color via HSV (expects object with h,s,v) */
    p.drawPixel = function (x, y, hsv) {
        painted.set(`${Math.round(x)},${Math.round(y)}` , { h: hsv.h, s: hsv.s, v: hsv.v });
    };
    /** Clear all painted pixels */
    p.clearPixels = function () { painted.clear(); };
    /** Get current pixel size */
    p.getPixelSize = function () { return pixelSize; };
    /** Set current heading (degrees) */
    p.setHeading = function (deg) { if (Number.isFinite(deg)) heading = ((deg % 360) + 360) % 360; };
    /** Get heading */
    p.getHeading = function () { return heading; };
}
