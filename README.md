# FluoForge

A browser based figure editor for multichannel microscopy images.

## Run locally

From the project directory, run `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/`.

## Project files and recovery

Current `.mfcproj.zip` files contain `manifest.json`, one editable JSON state per saved version under `versions/`, and one copy of every distinct original import under `sources/`. Save Project updates the current version. Save As creates a child version in a newly selected file and carries the prior history forward.

The browser also keeps bounded recovery checkpoints in IndexedDB. Recovery drafts are offered after reopening only when they are newer than the last manual save. They do not become permanent project versions until the project is saved.

PDF export preserves supported text and annotations as vectors and composites microscopy panels from their original channel data. Use Liberation Sans, Liberation Serif, or Liberation Mono for PDF labels; these fonts are bundled and embedded. TIFF export remains flattened and uses the same full resolution panel compositor.

## Regression checks

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
