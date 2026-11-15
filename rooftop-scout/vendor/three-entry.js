/* The engine of Rooftop Scout's 3D street view: three.js and the add-ons it uses, bundled into one script that hands them
   to the module as window.__SCOUT_THREE__ (no global THREE, so nothing else on the page sees or clashes with it).
   Rebuild (from this folder): npm i three@0.186.1 esbuild@0.28.2, then
   npx esbuild three-entry.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=three.bundle.min.js */
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

window.__SCOUT_THREE__ = Object.assign({}, THREE, { addons: { EffectComposer, RenderPass, ShaderPass, GTAOPass, UnrealBloomPass, OutputPass, Sky, GLTFExporter, mergeGeometries } });
