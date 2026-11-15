/* TensorFlow.js core and its WebGL backend (Apache-2.0), for Rooftop Scout's AI detail on the satellite map: handed to the
   module as window.__SCOUT_TF__. Rebuild: npm i @tensorflow/tfjs-core@4.22.0 @tensorflow/tfjs-backend-webgl@4.22.0
   esbuild@0.28.2, then npx esbuild tf-entry.js --bundle --minify --format=iife --target=es2020 --legal-comments=eof --outfile=tf.bundle.js */
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
window.__SCOUT_TF__ = tf;
