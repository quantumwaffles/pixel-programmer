<script>
	import P5Canvas from "$lib/P5Canvas.svelte";

	function sketch(p) {
		p.setup = function() {
			p.createCanvas(400, 400);
			p.background(220);
		};

		p.draw = function() {
			p.fill(100, 200, 255);
			p.ellipse(p.width/2, p.height/2, 100, 100);
		};
	}
</script>
<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
<P5Canvas {sketch}></P5Canvas>