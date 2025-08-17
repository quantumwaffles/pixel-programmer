<script>
    import P5Canvas from "$lib/P5Canvas.svelte";
    import sketch from "$lib/sketches/pixel-canvas.js";
    let code = `// Turtle code will go here soon.\n// Example: forward 50; turn 90;`; // placeholder content
</script>

<section class="min-h-screen flex flex-col items-center gap-10 py-10 px-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
    <div class="text-center space-y-2 max-w-2xl">
        <h1 class="text-5xl font-extrabold tracking-wide text-primary drop-shadow-md">Pixel Programmer</h1>
        <p class="text-base-content/70">
            Type turtle-style commands (coming soon) on the left; the canvas preview updates on the right. For now this is just a placeholder editor.
        </p>
    </div>

    <div class="w-full flex flex-col md:flex-row gap-8 items-stretch justify-center max-w-6xl">
        <!-- Code Editor Panel -->
        <div class="md:w-[420px] w-full">
            <div class="card bg-base-100 shadow-lg border border-base-300 h-full">
                <div class="card-body p-4 sm:p-6 gap-4">
                    <div class="flex items-center gap-2">
                        <h2 class="card-title text-primary/80 tracking-wide">Code</h2>
                        <span class="badge badge-neutral badge-sm">beta</span>
                    </div>
                    <label class="form-control w-full">
                        <div class="label py-1">
                            <span class="label-text text-xs uppercase tracking-wide text-base-content/60">Turtle Script</span>
                            <span class="label-text-alt text-base-content/40">(placeholder)</span>
                        </div>
                        <textarea bind:value={code} class="textarea textarea-bordered font-mono text-sm leading-snug min-h-[400px] resize-y" placeholder="forward 50\nturn 90\nrepeat 4 [ forward 50 turn 90 ]"></textarea>
                    </label>
                    <div class="text-xs text-base-content/50 space-y-1">
                        <p>Live parsing not implemented yet.</p>
                        <p class="italic">Planned commands: forward, back, left, right, penUp, penDown, color.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Preview Panel -->
        <div class="md:w-[460px] w-full">
            <div class="card bg-base-100 shadow-xl border border-base-300 h-full">
                <div class="card-body p-4 sm:p-6 gap-4">
                    <h2 class="card-title justify-center text-primary/80 tracking-wide">Preview Window</h2>
                    <div class="mockup-window border bg-base-300">
                        <div class="flex justify-center items-center bg-base-200 p-4">
                            <P5Canvas {sketch} />
                        </div>
                    </div>
                    <div class="text-xs text-base-content/50 text-center">
                        Powered by <span class="font-semibold text-secondary">p5.js</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>