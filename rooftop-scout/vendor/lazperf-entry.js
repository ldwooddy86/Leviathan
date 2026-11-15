/* The LAZ decoder for Rooftop Scout's lidar: laz-perf (Hobu, Apache-2.0) compiled to WebAssembly, bundled with its wasm
   inlined, handed to the module as window.__SCOUT_LAZ__ = { create, wasm (base64) }. Rebuild (from this folder):
   npm i laz-perf@0.0.7 esbuild@0.28.2, then
   npx esbuild lazperf-entry.js --bundle --minify --format=iife --platform=browser --target=es2020 --outfile=lazperf.tmp.js
   and replace __WASM__ with the base64 of node_modules/laz-perf/lib/web/laz-perf.wasm (build.py checks it is filled). */
import { createLazPerf } from 'laz-perf/lib/web/index.js';
window.__SCOUT_LAZ__ = { create: createLazPerf, wasm: '__WASM__' };
