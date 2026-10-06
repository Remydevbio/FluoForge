# FluoForge

A browser based figure editor for multichannel microscopy images.

## Run locally

From the project directory, run `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/`.

The workspace starts empty. Choose **Create figure** or **Open project** to begin; creating a figure shows the document page and enables editing. The right inspector has collapsible sections and brings the active tool or selected object's settings to the top. **Theme** offers light lavender, light sage, dark plum, and dark slate; your choice is remembered in this browser. Color palettes include bright colors, pastels, darker shades, and grays. New shapes and paths start with a yellow stroke.

## Project files and recovery

Current `.mfcproj.zip` files contain `manifest.json`, one editable JSON state per saved version under `versions/`, and one copy of every distinct original import under `sources/`. Save Project updates the current version. Save As creates a child version in a newly selected file and carries the prior history forward.

The browser also keeps bounded recovery checkpoints in IndexedDB. Recovery drafts are offered after reopening only when they are newer than the last manual save. They do not become permanent project versions until the project is saved.

PDF export preserves supported text and annotations as vectors and composites microscopy panels from their original channel data. Use Liberation Sans, Liberation Serif, or Liberation Mono for PDF labels; these fonts are bundled and embedded. TIFF export remains flattened and uses the same full resolution panel compositor.

## Pen and editable paths

Choose **Pen / Path** or press `P`. Click to add straight nodes, click and drag to create cubic Bézier handles, and mix both kinds in one path. Double-click or press Enter to finish; Escape cancels; clicking the first node closes the path. Shift constrains new segments and handles to 45° increments, while Ctrl snaps to nearby nodes and object edges or centers.

Select a path and choose **Edit nodes** to move anchors and handles. Double-click a segment to insert a node. The panel can delete the selected node, switch corner and smooth behavior, convert the incoming segment between straight and curved, reopen or close the path, and add tangent-aligned arrowheads. Alt separates the handles while dragging a smooth node. Path nodes and handles remain editable after project save/load, copy/paste, and version restoration.

## Regression checks

Open [the browser regression runner](tests/browser-regression.html) on the local server to run each suite with a fresh app frame and isolated test recovery storage. The interface suite covers empty startup, document creation/opening, themes, collapsible tool panels, and native mouse events for nodes, handles, and insets. It checks the node drag positions at multiple zoom levels with rotated, scaled, skewed, and flipped paths, and verifies that drawing an inset keeps its source image fixed.

With the app open, run the following in the browser console:

```js
const script = document.createElement('script');
script.src = '/tests/regression.js';
document.head.append(script);
script.onload = async () => console.log(await runMfcRegressions());
```

The checks create small synthetic images and verify linked insets, scale bars, mixed copy and duplication, text borders, curve controls, and keyboard movement. The supplied `image1.tif` and `image2.tif` can also be imported to exercise real four-channel TIFF decoding.

The publication export and project-format suite first generates a deterministic large multichannel TIFF, then runs in the browser:

```bash
python3 tests/generate_fixture.py
```

```js
const script = document.createElement('script');
script.src = '/tests/project-export-regression.js';
document.head.append(script);
script.onload = async () => console.log(await runProjectExportRegressions());
```

This suite verifies three editable versions, source deduplication, legacy ZIP/JSON/gzip migration, recovery drafts and retention, storage-error reporting, native PDF paths and selectable text, clipping and opacity, explicit font failures, and source-resolution image export.

The Pen/Path suite runs in the browser in the same way:

```js
const script = document.createElement('script');
script.src = '/tests/path-regression.js';
document.head.append(script);
script.onload = async () => console.log(await runPathRegressions());
```

It verifies progressive drawing, mixed straight and cubic segments, node editing and insertion, corner/smooth conversion, Alt handle separation, closure, arrowheads, project persistence, copy/paste, legacy curve migration, and vector SVG/PDF export.
