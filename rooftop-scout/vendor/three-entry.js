/* The engine of Rooftop Scout's 3D street view: three.js and the add-ons it uses, bundled into one script that hands them
   to the module as window.__SCOUT_THREE__ (no global THREE, so nothing else on the page sees or clashes with it).
   It also carries the 3D Tiles renderer (NASA-AMMOS 3DTilesRendererJS, Apache-2.0) with the plugins that stream Google's
   Photorealistic 3D Tiles, and the Draco geometry decoder those tiles need (its WebAssembly inline).
   Rebuild (from this folder): npm i three@0.186.1 3d-tiles-renderer@0.5.3 esbuild@0.28.2, copy
   node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js to draco_wasm_wrapper.txt, then
   npx esbuild three-entry.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --loader:.wasm=base64 --loader:.txt=text
   '--define:import.meta.url="https://scout.invalid/three/examples/jsm/loaders/DRACOLoader.js"' --outfile=three.bundle.min.js
   (the define gives DRACOLoader's default decoder paths a base to resolve against; the page hands the decoder in itself) */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/src/three/renderer/tiles/TilesRenderer.js';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/src/core/plugins/GoogleCloudAuthPlugin.js';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/src/three/plugins/GLTFExtensionsPlugin.js';
import { ReorientationPlugin } from '3d-tiles-renderer/src/three/plugins/ReorientationPlugin.js';
import { TilesFadePlugin } from '3d-tiles-renderer/src/three/plugins/fade/TilesFadePlugin.js';
import dracoWasm from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm';
import dracoJs from './draco_wasm_wrapper.txt';

window.__SCOUT_THREE__ = Object.assign({}, THREE, { addons: { EffectComposer, RenderPass, ShaderPass, GTAOPass, UnrealBloomPass, OutputPass, Sky, GLTFExporter, mergeGeometries },
  tiles: { TilesRenderer, GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin, TilesFadePlugin, DRACOLoader, dracoWasm, dracoJs } });
