import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],

	build: {
		// Optimize chunk splitting for better caching
		rollupOptions: {
			output: {
				manualChunks: {
					// Core Svelte libraries in separate chunk (rarely changes)
					'svelte-core': ['svelte', 'svelte/internal'],
					// I18n library in separate chunk
					i18n: ['svelte-i18n'],
					// Font packages in separate chunk (large, rarely change)
					fonts: ['@fontsource-variable/overpass', '@fontsource/overpass']
				}
			}
		},
		// Reasonable chunk size limit
		chunkSizeWarningLimit: 600,
		// Enable hidden source maps in production for debugging (not exposed to users)
		sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true
	},

	server: {
		fs: {
			allow: ['..']
		},
		proxy: {
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true
			}
		}
	},

	// Pre-optimize dependencies for faster dev server startup
	optimizeDeps: {
		include: ['svelte-i18n', '@svelte-put/qr/svg/QR.svelte']
	}
});
