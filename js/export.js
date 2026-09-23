/* Vector SVG/PDF exports share a source-resolution image compositor with flattened TIFF. */
const MFC_EXPORT = (() => {
  const FONTS = { 'Liberation Sans': 'LiberationSans', 'Liberation Serif': 'LiberationSerif', 'Liberation Mono': 'LiberationMono' };
  const STYLES = { normal: 'Regular', bold: 'Bold', italic: 'Italic', bolditalic: 'BoldItalic' };
  const fontBytes = new Map();
  let exporting = false;
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function base64(buffer) {
    const bytes = new Uint8Array(buffer); let str = '';
    for (let i=0; i<bytes.length; i+=16384) str += String.fromCharCode(...bytes.subarray(i,i+16384));
    return btoa(str);
  }
  async function fontData(family, style) {
    const path = 'assets/fonts/' + FONTS[family] + '-' + STYLES[style] + '.ttf';
    if (!fontBytes.has(path)) fontBytes.set(path, fetch(path).then(response => {
      if (!response.ok) throw new Error('Could not load export font: ' + family); return response.arrayBuffer();
    }).then(base64));
    return fontBytes.get(path);
  }
  function walk(objects, fn) { objects.forEach(obj => { if (obj.visible === false) return; fn(obj); if (obj.getObjects) walk(obj.getObjects(), fn); else if (obj.objects) walk(obj.objects, fn); }); }
  function fontUse(objects) {
    const used = new Map();
    walk(objects, obj => {
      if (!['text','textbox','i-text'].includes(obj.type)) return;
      obj.text.split('\n').forEach((line, lineIndex) => Array.from(line).forEach((char, index) => {
        const overrides = obj.styles?.[lineIndex]?.[index] || {};
        const family = overrides.fontFamily || obj.fontFamily;
        const weight = overrides.fontWeight || obj.fontWeight;
        const italic = overrides.fontStyle || obj.fontStyle;
        const style = (weight === 'bold' || Number(weight) >= 600 ? 'bold' : '') + (italic === 'italic' ? 'italic' : '') || 'normal';
        const key = family + ':' + style;
        if (!used.has(key)) used.set(key, { family, style, text: '' });
        used.get(key).text += char;
      }));
    });
    return [...used.values()];
  }
  function preflight(objects, pdf) {
    const unsupported = new Set();
    walk(objects, o => {
      if (o.shadow) unsupported.add('object shadows');
      if (o.globalCompositeOperation && o.globalCompositeOperation !== 'source-over') unsupported.add('blend mode ' + o.globalCompositeOperation);
      if (o.clipPath?.inverted) unsupported.add('inverted clipping masks');
      if (o.filters?.length) unsupported.add('Fabric image filters');
    });
    if (pdf) fontUse(objects).forEach(({family}) => { if (!FONTS[family]) unsupported.add('font "' + family + '" (choose a Liberation font in the editor)'); });
    if (unsupported.size) throw new Error('Export cannot preserve: ' + [...unsupported].join('; ') + '. No file was exported.');
  }
  async function buildSVG({ pdf = false } = {}) {
    const state = MFC_PROJECT.captureState();
    preflight(state.objects, pdf);
    const size = MFC.docPropsToPixels(state.docProps);
    if (size.width < 1 || size.height < 1 || !Number.isFinite(size.width + size.height)) throw new Error('Invalid document size.');
    const registry = {}, canvas = new fabric.StaticCanvas(null, { width: size.width, height: size.height, backgroundColor: '#ffffff', renderOnAddRemove: false });
    const imageDetails = [];
    try {
      for (const json of state.objects) canvas.add(await MFC_PROJECT.restoreObject(json, registry, true));
      preflight(canvas.getObjects(), pdf);
      await document.fonts.ready;
      walk(canvas.getObjects(), image => {
        if (image.mfcType !== 'mfcImage') return;
        const entry = registry[image.mfcId], raw = entry.rawImage;
        const previewW = Math.round(raw.width * entry.workingScale), previewH = Math.round(raw.height * entry.workingScale);
        const rx = raw.width / previewW, ry = raw.height / previewH;
        const region = { x: image.cropX * rx, y: image.cropY * ry, width: image.width * rx, height: image.height * ry };
        const matrix = image.calcTransformMatrix();
        // Document pixels are the requested output DPI. Groups, rotations and scaling
        // are included; no panel is enlarged beyond its original source resolution.
        const outW = Math.max(1, Math.min(Math.ceil(region.width), Math.ceil(image.width * Math.hypot(matrix[0],matrix[1]))));
        const outH = Math.max(1, Math.min(Math.ceil(region.height), Math.ceil(image.height * Math.hypot(matrix[2],matrix[3]))));
        const raster = MFC_TIFF.compositeChannels(raw, 1, region, outW, outH);
        const href = raster.toDataURL('image/png');
        imageDetails.push({ id: image.mfcId, sourceId: entry.sourceId, sourceWidth: raw.width, sourceHeight: raw.height,
          previewWidth: previewW, width: outW, height: outH, region });
        // Bake only the image's crop into its own raster. Keep the Fabric geometry and
        // SVG wrapper intact, including nested transforms, object clip paths and opacity.
        image._toSVG = function () { return ['<image ', 'COMMON_PARTS', ' x="', -this.width/2,
          '" y="', -this.height/2, '" width="', this.width, '" height="', this.height,
          '" preserveAspectRatio="none" xlink:href="', href, '" />\n']; };
      });
      let svg = canvas.toSVG({ suppressPreamble: true, viewBox: { x:0,y:0,width:size.width,height:size.height } });
      // Embed the same licensed TTF used by the browser, making standalone SVG/TIFF
      // rendering independent of fonts installed on the recipient's machine.
      const fonts = fontUse(canvas.getObjects());
      const faces = [];
      for (const {family,style} of fonts.filter(f => FONTS[f.family])) {
        const data = await fontData(family,style);
        faces.push(`@font-face{font-family:'${family}';font-style:${style.includes('italic')?'italic':'normal'};font-weight:${style.includes('bold')?'700':'400'};src:url(data:font/ttf;base64,${data}) format('truetype');}`);
      }
      svg = svg.replace('<defs>', '<defs><style type="text/css"><![CDATA[' + faces.join('\n') + ']]></style>');
      return { svg, width: size.width, height: size.height, dpi: state.docProps.dpi, fonts, imageDetails };
    } finally { canvas.dispose(); }
  }
  async function buildPDF() {
    const output = await buildSVG({ pdf: true });
    const widthPt = output.width / output.dpi * 72, heightPt = output.height / output.dpi * 72;
    const pdf = new window.jspdf.jsPDF({ unit: 'pt', format: [widthPt,heightPt],
      orientation: widthPt >= heightPt ? 'landscape' : 'portrait', compress: true, putOnlyUsedFonts: true });
    for (const {family,style,text} of output.fonts) {
      const filename = FONTS[family] + '-' + STYLES[style] + '.ttf';
      pdf.addFileToVFS(filename, await fontData(family,style)); pdf.addFont(filename,family,style);
      const metadata = pdf.getFont(family,style).metadata;
      const missing = [...new Set(Array.from(text).filter(char => !/\s/.test(char) && !metadata.characterToGlyph(char.codePointAt(0))))];
      if (missing.length) throw new Error('Font "' + family + '" has no PDF glyphs for: ' + missing.join(' ') + '. Change these labels before export.');
    }
    const svg = new DOMParser().parseFromString(output.svg, 'image/svg+xml').documentElement;
    if (svg.querySelector('parsererror')) throw new Error('Could not construct export SVG.');
    // svg2pdf handles these Fabric SVG paths/text/groups as PDF drawing/text operators.
    // There is deliberately no whole-page PNG fallback.
    await pdf.svg(svg, { x:0,y:0,width:widthPt,height:heightPt });
    return { blob: pdf.output('blob'), ...output };
  }
  async function renderSVG(output) {
    const url = URL.createObjectURL(new Blob([output.svg], { type:'image/svg+xml' }));
    try {
      const image = await new Promise((resolve,reject) => { const i = new Image(); i.onload=()=>resolve(i); i.onerror=()=>reject(new Error('SVG raster rendering failed')); i.src=url; });
      const canvas = document.createElement('canvas'); canvas.width=output.width; canvas.height=output.height;
      const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  }
  async function buildTIFF() {
    const output = await buildSVG(), canvas = await renderSVG(output);
    const bytes = UTIF.encodeImage(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,
      { t282:[output.dpi],t283:[output.dpi],t296:[2] });
    return { blob:new Blob([bytes],{type:'image/tiff'}), ...output };
  }
  async function exportFile(kind) {
    if (exporting) return; exporting=true; MFC_UI.showSavingDialog('Rendering '+kind.toUpperCase()+'…');
    try {
      const output = kind === 'pdf' ? await buildPDF() : kind === 'tiff' ? await buildTIFF() : await buildSVG();
      download(output.blob || new Blob([output.svg],{type:'image/svg+xml'}),'figure_export.'+kind);
      MFC_UI.toast(kind.toUpperCase()+' exported.');
    } catch(error) { console.error(error); MFC_UI.toast(error.message); MFC_PROJECT.status(error.message); }
    finally { exporting=false; MFC_UI.hideSavingDialog(); }
  }
  return { download, buildSVG, buildPDF, buildTIFF, renderSVG,
    exportPDF:()=>exportFile('pdf'), exportSVG:()=>exportFile('svg'), exportTIFF:()=>exportFile('tiff') };
})();
