    /* The graphics context taken away (the driver was reset, or the system took the card's memory back): said in the
       view, and the engine stops asking for frames, instead of a still picture with no word. What the engine had built
       on the card goes with the context, so when the browser gives it back the view has to be opened afresh. */
    engine.on('lost', () => { const t = 'The browser took the graphics context away from the Scout Engine, so the 3D picture has stopped. This happens when the graphics driver is reset or runs out of memory. The classic 3D view and the map still work.'; note(t); try { alarm(t); if (env.onGraphics) env.onGraphics(graphics()); } catch (e) {} });
    engine.on('restored', () => { note('The graphics context is back, but what the Scout Engine had built on the card went with it. Reload the page to open the Scout Engine again. The classic 3D view and the map still work.'); try { if (env.onGraphics) env.onGraphics(graphics()); } catch (e) {} });
