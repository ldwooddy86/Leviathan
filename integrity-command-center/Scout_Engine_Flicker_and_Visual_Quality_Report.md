# Scout Engine: flicker fixes and visual quality

Dashboard file: `DFW_Thermal_Debt_Atlas_Build6_Rooftop_Scout_12_Scout_Engine.html`
Picture: `Scout_Engine_flicker_before_after.png`

A view with nothing moving in it used to shimmer over a quarter to a third of the picture. It now shimmers over about 1 to 2 percent, at every quality level, by day, at night and on wet ground. Shimmer while the camera moves is roughly halved.

Everything here was measured on a software renderer (no graphics card is available to me), at 480 x 270. The numbers compare the engine as delivered in Scout 11 with the one in Scout 12, drawn the same way.

## 1. How it was measured

- **At rest.** The same view is drawn twelve times with the clock stopped. A steady renderer gives the same picture each time; whatever a pixel does across those frames is flicker. Any slow, even drift (an exposure still easing) is taken out and reported separately.
- **In motion.** The camera moves a quarter of a pixel a frame. What does not change smoothly from frame to frame is shimmer.
- Units are brightness levels out of 255.

## 2. Results

### A view at rest: share of pixels that swing by more than 2 levels, and by more than 6

| View | Over 2: before | after | Over 6: before | after |
|---|---|---|---|---|
| Street, afternoon (High) | 30.4% | 1.2% | 6.7% | 0.22% |
| Street through a long lens (High) | 9.0% | 0.95% | 2.4% | 0.13% |
| Street, morning (High) | 27.0% | 1.65% | 7.8% | 0.34% |
| From the drone, afternoon (High) | 27.2% | 1.4% | 9.4% | 0.23% |
| From the drone with X-ray on (High) | 29.6% | 1.7% | 9.9% | 0.29% |
| From the drone, cloudy morning (High) | 15.5% | 0.8% | 5.6% | 0.08% |
| Street, night (High) | 26.0% | 1.3% | 6.6% | 0.17% |
| Street, wet ground, drops switched off (High) | 24.7% | 1.2% | 6.1% | 0.16% |
| Street, rain falling (High) | 48.9% | 12–14% | 21.3% | 2.1–3.1% |
| Street (Ultra) | 30.4% | 1.3% | 6.8% | 0.22% |
| Street (Medium) | 36.0% | 2.1% | 17.7% | 0.36% |
| Street (Low) | 36.8% | 1.6% | 16.7% | 0.39% |

The rain row counts the falling drops themselves, which are meant to move; it varies from run to run because the drops are random. The row above it is the same scene with the drops removed.

### Slow camera move: unevenness from frame to frame (average / worst 1 percent of pixels)

| View | Before | After |
|---|---|---|
| Street, afternoon (High) | 0.64 / 4.7 | 0.27 / 1.8 |
| Street through a long lens (High) | 0.69 / 4.6 | 0.43 / 2.8 |
| From the drone, afternoon (High) | 0.71 / 5.6 | 0.40 / 2.8 |
| From the drone with X-ray on (High) | 0.68 / 4.9 | 0.41 / 2.7 |
| Street, night (High) | 0.81 / 5.1 | 0.30 / 1.9 |
| Street, wet ground (High) | 0.71 / 5.8 | 0.34 / 3.4 |
| Street (Medium) | 0.56 / 4.2 | 0.25 / 1.8 |
| Street (Low) | 0.51 / 5.2 | 0.22 / 1.6 |

### Other measurements

| What | Before | After |
|---|---|---|
| Brightness still drifting two seconds after switching to night (levels across twelve frames) | 5.2 | 0.8 |
| The same after switching to rain | 6.3 | 0.7 |
| First frame after the automatic resolution steps: pixels that jump by more than 6 levels | 14–18% | 0.01–0.18% |
| A patch of sunlit road: how much its overall brightness varied from frame to frame (Medium / High) | 8.8% / 4.6% | 0.0% |

## 3. What was wrong, and what changed

In order of how much each mattered.

1. **A shader bug: roads and walls turning half metal in patches.** Each wall, road and sidewalk carries a number saying which scanned material it uses, with a half added if the material is metal. The pixel shader read that half with no margin for rounding, so a plain "5" arriving as 4.9999995 read as metal. Which pixels did so changed with every frame's sub-pixel offset: whole patches of road went darker and glossier and back. This was the last-found and largest cause of shimmering pavement, and it was in every earlier build. It is now read with a margin.
2. **The frame-to-frame filter was rebuilt.** It used to blend a fixed share of each new frame, and pulled its memory hard toward each new frame's values. A window bar thinner than a pixel is caught by some frames and missed by others, so it blinked. Now each pixel counts how long it has been at rest and averages what it has gathered, up to 48 frames. A real change (a shadow arriving, a car leaving) is told apart by all of a pixel's neighbours moving the same way, and is followed at once.
3. **Things thinner than a pixel are drawn as what they average to.** Window frames, glazing bars and blind slats fade into the wall with distance instead of sparkling. The coloured outline along each roof edge is never drawn narrower than a pixel and a half, and is dimmed by as much as it was widened.
4. **Exposure no longer drifts for seconds.** After a switch from day to night the whole picture kept changing brightness for about five seconds. The eye adaptation now follows the picture outright for a few frames after a change of hour or weather, and otherwise eases evenly in both directions.
5. **Automatic resolution changes no longer blink.** When the engine lowered or raised its drawing size to hold the frame rate, ambient shading and clouds restarted and the view shifted slightly. Both are now carried across the step.
6. **The picture is drawn at exactly the screen's size.** It was rounded to a multiple of eight pixels and stretched, which softened it and added a faint beat.
7. **Shadows.** Shadow sampling now follows the slope of the surface it falls on, the seams between shadow ranges are blended instead of dithered, and far shadows refresh when the camera turns.
8. **Shader code that differs between graphics drivers.** Several texture lookups sat inside branches where the automatic level-of-detail is undefined. They now state the level explicitly. This follows the rule; I could not test it on real cards.

## 4. Visual quality

- **Sharper at rest and in motion:** exact-size drawing, a sharper filter for carried-over pixels, 16x anisotropic filtering on ground and walls, and stronger sharpening only when the picture is being scaled up.
- **Steadier material look:** roads, sidewalks and walls are no longer part metal in patches. They read slightly lighter and more matte, and the same from every angle.
- **Night skyline:** distant towers used to glow as one even cream slab. They now show their lit windows as soft points that match the windows seen up close. The distant glow was also brighter than the same windows up close (about 1.7 times, by the shader's own arithmetic) and is corrected.
- **Cleaner shadows:** no dither noise in soft edges or at range seams.
- **Less film grain:** just enough left to stop a smooth sky from banding.

## 5. Checks run on the final file

All passed:

- every inline script in the dashboard parses;
- the real dashboard page at High: 47 shader programs built, none refused, at most 15 texture units in any one (the limit is 16), no page errors;
- driver-refusal and black-screen fallbacks;
- drone flight and X-ray, all HVAC layouts, the HVAC inference checks, and the agreement between the engine bar, X-ray panel and building card;
- the classic 3D view and map still switch correctly;
- the frame right after a fast camera turn shows no doubled edges, and a frame with traffic moving shows no trails behind the cars (checked by eye on those two frames).

## 6. Limits

- **No real graphics card.** All of this ran on a software renderer. The filter's thresholds were tuned there. The shader bug in item 1 flipped pixels on that renderer; real cards are free to round either way, so I expect it showed on at least some, but cannot confirm which.
- **About 1 to 2 percent of pixels still move at rest.** What is left is mostly window grids on distant towers and sun glints on glass.
- **A view takes about a second to fully sharpen after you stop.** That is the averaging filling in.
- **Small local changes fade rather than snap.** Something small that changes without moving (a signal lamp changing colour) cross-fades over a fraction of a second. Large changes are followed immediately.
- **Not changed:** depth precision at long range, and reflections and fog have no frame-to-frame filter of their own (the main filter handles them; wet ground measured steady).
- **Tested small.** At 480 x 270 a window bar is a quarter of a pixel. On a full-size screen features are four times larger in pixels, which is the easier case; the long-lens row approximates it.
