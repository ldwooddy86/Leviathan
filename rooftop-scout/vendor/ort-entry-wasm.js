/* ONNX Runtime Web 1.30.0 (MIT, Microsoft; vendor/ORT-LICENSE), processor build, for Rooftop Scout's 3D view traced from
   the newest satellite photo: handed over as window.__SCOUT_ORT_WASM__. Its WebAssembly engine (14 MB) loads from
   jsDelivr when the AI first runs. ort-entry-webgpu.js is the graphics card build, bundled on its own.
   Rebuild (from this folder): npm i onnxruntime-web@1.30.0 esbuild@0.28.2, then
   npx esbuild ort-entry-wasm.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=ort-wasm.bundle.js */
import * as ort from 'onnxruntime-web/wasm';
window.__SCOUT_ORT_WASM__ = ort;
