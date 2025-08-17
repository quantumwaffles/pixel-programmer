import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Create a fallback page so GitHub Pages 404s route back to SPA
			fallback: '404.html'
		}),
		paths: {
			// Set GH_PAGES_BASE in CI to '/repo-name' for project Pages; keep '' locally
			base: process.env.GH_PAGES_BASE || ''
		},
		prerender: {
			entries: ['*']
		}
	},
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'alt-x',
			showToggleButton: 'always',
			toggleButtonPos: 'bottom-right'
		}
	}
};

export default config;
