// Pixel canvas p5 sketch (renamed from intro.js)
/**
 * @param {import('p5')} p
 */
export default function sketch(p) {
  p.setup = function () {
    p.createCanvas(400, 400);
    p.background(220);
  };

  p.draw = function () {
    p.fill(100, 200, 255);
    p.ellipse(p.width / 2, p.height / 2, 100, 100);
  };
}
