<script>
    import P5Canvas from "$lib/P5Canvas.svelte";
    import sketch from "$lib/sketches/pixel-canvas.js";
    import { parse } from "$lib/turtle-lang/lexer.js";
    import { interpret } from "$lib/turtle-lang/interpreter.js";

    // Editor code content
    let code = $state(`// Turtle code will go here soon.\n// Try commands: forward 50\npen down\nleft 90\nhsv +10 _ 50`);

    // Tabs state: 'code' | 'tokens'
    let activeTab = $state('code');

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

    function setTab(tab) { activeTab = tab; }

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

    // Auto-run effect (debounced)
    $effect(() => {
        if (!autoRun) return; // disabled
        if (lexError) return; // don't run with syntax errors
        if (!canvasInst) return; // wait for canvas
        // Debounce
        if (_runTimer) clearTimeout(_runTimer);
        _runTimer = setTimeout(() => {
            handleRun();
        }, 300);
        return () => { if (_runTimer) clearTimeout(_runTimer); };
    });
</script>

<section class="min-h-screen flex flex-col items-center gap-10 py-10 px-4 bg-gradient-to-br from-base-200 via-base-100 to-base-200">
    <div class="text-center space-y-2 max-w-2xl">
        <h1 class="text-5xl font-extrabold tracking-wide text-primary drop-shadow-md">Pixel Programmer</h1>
        <p class="text-base-content/70">
            Type turtle-style commands (coming soon) on the left; the canvas preview updates on the right. For now this is just a placeholder editor.
        </p>
    </div>

    <div class="w-full flex flex-col md:flex-row gap-8 items-stretch justify-center max-w-6xl">
        <!-- Code / Tokens Panel -->
        <div class="md:w-[420px] w-full">
            <div class="card bg-base-100 shadow-lg border border-base-300 h-full flex flex-col">
                <div class="p-4 sm:p-6 pb-2 flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title text-primary/80 tracking-wide">Turtle</h2>
                        <div class="join text-sm">
                            <button class="btn btn-xs join-item {activeTab==='code' ? 'btn-primary' : 'btn-ghost'}" onclick={() => setTab('code')}>Code</button>
                            <button class="btn btn-xs join-item {activeTab==='tokens' ? 'btn-primary' : 'btn-ghost'}" onclick={() => setTab('tokens')}>Tokens</button>
                        </div>
                    </div>
                    <div class="text-[10px] uppercase tracking-wide text-base-content/50">{activeTab === 'code' ? 'Edit script' : 'Lexer output'}</div>
                </div>
                <div class="flex-1 overflow-auto p-4 pt-0">
                    {#if activeTab === 'code'}
                        <label class="form-control w-full">
                            <textarea bind:value={code} class="textarea textarea-bordered font-mono text-sm leading-snug min-h-[400px] resize-y" placeholder="forward 50\nback 10\nleft 90\nright 45\npen down\nhsv +10 _ 50"></textarea>
                        </label>
                        <div class="mt-3 flex flex-col gap-2">
                            <div class="flex flex-wrap gap-2 items-center">
                                <button class="btn btn-primary btn-sm" onclick={handleRun}>Run</button>
                                <button class="btn btn-outline btn-sm" onclick={() => { canvasInst?.clearPixels?.(); lastRunStats=null; runError=null; }}>Clear</button>
                                <button class="btn btn-ghost btn-sm" onclick={() => setTab('tokens')}>View Tokens</button>
                                <label class="label cursor-pointer gap-1 ml-auto text-xs">
                                    <span class="text-base-content/60">Auto</span>
                                    <input type="checkbox" class="toggle toggle-xs" checked={autoRun} onchange={(e)=> autoRun = e.currentTarget.checked} />
                                </label>
                            </div>
                            {#if runError}
                                <div class="alert alert-error py-1 min-h-0 h-auto text-xs">{runError}</div>
                            {:else if lastRunStats}
                                <div class="text-xs text-base-content/60">
                                    <span class="font-semibold">Done.</span> Ops: {lastRunStats.operations}, Pos: ({lastRunStats.finalX},{lastRunStats.finalY}), Heading: {lastRunStats.heading.toFixed(1)}°, HSV: {Math.round(lastRunStats.color.h)}/{Math.round(lastRunStats.color.s)}/{Math.round(lastRunStats.color.v)}
                                </div>
                            {/if}
                            <div class="text-xs text-base-content/50 space-y-1">
                                <p>Live tokenization active.</p>
                                <p class="italic">Supported: forward, back, left, right, pen up|down, hsv.</p>
                            </div>
                        </div>
                    {:else}
                        {#if lexError}
                            <div class="alert alert-error text-xs py-2">
                                <span>{lexError}</span>
                            </div>
                        {:else}
                            <div class="text-xs text-base-content/60 mb-2 flex items-center gap-2">
                                <span>{tokens.length} token{tokens.length===1?'' : 's'}</span>
                                <button class="btn btn-ghost btn-xs" onclick={() => navigator?.clipboard?.writeText(JSON.stringify(tokens, null, 2))}>Copy JSON</button>
                            </div>
                            <pre class="bg-base-200 rounded p-2 text-xs overflow-auto max-h-[420px]">{JSON.stringify(tokens, null, 2)}</pre>
                        {/if}
                    {/if}
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