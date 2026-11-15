/* ONNX Runtime Web 1.30.0 (MIT, Microsoft; vendor/ORT-LICENSE), graphics card build (WebGPU, with the processor as its
   fallback), for Rooftop Scout's 3D view traced from the newest satellite photo: handed over as window.__SCOUT_ORT_GPU__.
   Its WebAssembly engine (27 MB) loads from jsDelivr when the AI first runs on a card.
   Rebuild (from this folder): npm i onnxruntime-web@1.30.0 esbuild@0.28.2, then
   npx esbuild ort-entry-webgpu.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=ort-webgpu.bundle.js */
import * as ort from 'onnxruntime-web/webgpu';
window.__SCOUT_ORT_GPU__ = ort;
