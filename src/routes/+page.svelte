<script>
    import P5Canvas from "$lib/P5Canvas.svelte";
    import sketch from "$lib/sketches/pixel-canvas.js";
    import { parse } from "$lib/turtle-lang/lexer.js";
    import { interpret } from "$lib/turtle-lang/interpreter.js";

    // Editor code content
        let code = $state(`// Turtle demo script exercising all features including repeat
// Abbreviations (f,r,l,b) hsv absolute/offset/ignore and nested repeat blocks

pen down
hsv 30 90 90

// Draw a square using repeat (size 15)
repeat 4 {
    f 15
    r 90
}

// Star-like pattern (rotate & change hue)
repeat 6 {
    hsv +60 _ _    // shift hue
    f 10
    l 60
}

// Move without drawing
pen up
f 5
pen down

// Nested repeats: a tiny grid stamp 3x repeated 3 times with hue shift
repeat 3 {
    hsv +40 -10 +0
    repeat 3 {
        f 4
        r 90
        f 4
        r 90
        f 4
        r 90
        f 4
        r 90 // tiny square
        r 120 // reorient
    }
}

// Final color tweak: lower value only
hsv _ _ -30
f 6
// End of demo`);

    // Lexer output
    let tokens = $state([]);
    let lexError = $state(null);

    // Re-lex when code changes
    $effect(() => {
        try {
            tokens = parse(code);
            lexError = null;
        } catch (e) {
            lexError = e.message || String(e);
            tokens = [];
        }
    });

    // (Tabs removed) Console display always shown below editor.

    // p5 instance reference
    let canvasInst = $state(null);
    let runError = $state(null);
    let lastRunStats = $state(null);
    let autoRun = $state(false);
    let _runTimer = null;

    function handleRun() {
        runError = null; lastRunStats = null;
        if (!canvasInst) { runError = 'Canvas not ready'; return; }
        try {
            // Clear previous pixels
            canvasInst.clearPixels && canvasInst.clearPixels();
            // Interpret script
            const res = interpret(code, {
                canvas: canvasInst,
                startX: Math.floor(canvasInst.width / (2 * canvasInst.getPixelSize())),
                startY: Math.floor(canvasInst.height / (2 * canvasInst.getPixelSize())),
                initialPenDown: true,
                width: Math.floor(canvasInst.width / canvasInst.getPixelSize()),
                height: Math.floor(canvasInst.height / canvasInst.getPixelSize())
            });
            lastRunStats = {
                operations: res.operations.length,
                finalX: res.finalX,
                finalY: res.finalY,
                heading: res.finalHeading,
                color: res.color
            };
        } catch (e) {
            runError = e.message || String(e);
        }
    }

    // Auto-run effect (debounced) – must reference `code` so changes retrigger.
    $effect(() => {
        const _codeSnapshot = code; // dependency tracking
        if (!autoRun) return; // disabled
        if (lexError) return; // don't run with syntax errors
        if (!canvasInst) return; // wait for canvas
        if (_runTimer) clearTimeout(_runTimer);
        _runTimer = setTimeout(() => { handleRun(); }, 300);
        return () => { if (_runTimer) clearTimeout(_runTimer); };
    });
</script>

<section class="min-h-screen flex flex-col items-center gap-10 py-10 px-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
    <div class="text-center space-y-2 max-w-2xl">
        <h1 class="text-5xl font-extrabold tracking-wide text-primary drop-shadow-md">Pixel Programmer</h1>
    </div>

    <div class="w-full flex flex-col md:flex-row gap-8 items-stretch justify-center max-w-6xl">
        <!-- Code + Console Panel -->
        <div class="md:w-[420px] w-full">
            <div class="card bg-base-100 shadow-lg border border-base-300 h-full flex flex-col">
                <div class="p-4 sm:p-6 pb-2 flex flex-col gap-1">
                    <h2 class="card-title text-primary/80 tracking-wide">Turtle Script</h2>
                    <div class="text-[10px] uppercase tracking-wide text-base-content/50">Editor</div>
                </div>
                <div class="px-4 pb-0">
                    <label class="form-control w-full">
                        <textarea
                            bind:value={code}
                            class="textarea textarea-bordered font-mono text-sm leading-snug min-h-[300px] resize-y"
                            placeholder="forward 50\nback 10\nleft 90\nright 45\npen down\nhsv +10 _ 50"
                            onkeydown={(e)=>{ if((e.ctrlKey||e.metaKey)&& e.key==='Enter'){ e.preventDefault(); handleRun(); } }}
                        ></textarea>
                    </label>
                </div>
                <div class="px-4 pt-3 flex flex-col gap-2">
                    <div class="flex flex-wrap gap-2 items-center">
                        <button class="btn btn-primary btn-sm" onclick={handleRun}>Run</button>
                        <button class="btn btn-outline btn-sm" onclick={() => { canvasInst?.clearPixels?.(); lastRunStats=null; runError=null; }}>Clear</button>
                        <label class="label cursor-pointer gap-1 ml-auto text-xs">
                            <span class="text-base-content/60">Auto</span>
                            <input type="checkbox" class="toggle toggle-xs" checked={autoRun} onchange={(e)=> autoRun = e.currentTarget.checked} />
                        </label>
                    </div>
                    {#if runError}
                        <div class="alert alert-error py-1 min-h-0 h-auto text-xs">{runError}</div>
                    {:else if lastRunStats}
                        <div class="text-xs text-base-content/60 space-y-1">
                            <div><span class="font-semibold">Done.</span> Ops: {lastRunStats.operations}, Pos: ({lastRunStats.finalX},{lastRunStats.finalY}), Heading: {lastRunStats.heading.toFixed(1)}°, HSV: {Math.round(lastRunStats.color.h)}/{Math.round(lastRunStats.color.s)}/{Math.round(lastRunStats.color.v)}</div>
                            <div class="opacity-60">(Ctrl+Enter to Run)</div>
                        </div>
                    {/if}
                </div>
                <!-- Console Panel -->
                <div class="mt-4 border-t border-base-300 bg-base-200/40">
                    <div class="px-4 pt-3 pb-2 flex items-center gap-2 text-xs text-base-content/60">
                        <span class="font-semibold">Console</span>
                        <span class="opacity-60">Tokens</span>
                        {#if !lexError}
                            <span class="ml-auto">{tokens.length} token{tokens.length===1?'':'s'}</span>
                        {:else}
                            <span class="ml-auto text-error">error</span>
                        {/if}
                        <button class="btn btn-ghost btn-xs" onclick={() => navigator?.clipboard?.writeText(JSON.stringify(tokens, null, 2))} disabled={!!lexError}>Copy</button>
                    </div>
                    <div class="px-4 pb-4">
                        {#if lexError}
                            <div class="alert alert-error py-1 min-h-0 h-auto text-xs">{lexError}</div>
                        {:else}
                            <pre class="bg-base-300/60 rounded p-2 text-[11px] leading-tight overflow-auto max-h-[200px]">{JSON.stringify(tokens, null, 2)}</pre>
                        {/if}
                        <div class="mt-2 text-[10px] text-base-content/50 space-y-1">
                            <p>Supported: forward/back/left/right (abbr), pen up|down, hsv, repeat.</p>
                        </div>
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
                            <P5Canvas {sketch} onInstance={(inst)=> canvasInst = inst} />
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