# FluoForge

A browser based figure editor for multichannel microscopy images.

## Run locally

From the project directory, run `python3 -m http.server 8765 --bind 127.0.0.1` and open `http://127.0.0.1:8765/`.

## Regression checks

With the app open, run the following in the browser console:

```js
const script = document.createElement('script');
script.src = '/tests/regression.js';
document.head.append(script);
script.onload = async () => console.log(await runMfcRegressions());
```

The checks create small synthetic images and verify linked insets, scale bars, mixed copy and duplication, text borders, curve controls, and keyboard movement. The supplied `image1.tif` and `image2.tif` can also be imported to exercise real four-channel TIFF decoding.
