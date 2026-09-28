import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, COLOR_PRESETS, appearanceTokens, colorContrast, normalizeAppearance } from '../src/services/appearance.js';

test('custom colors keep accent text, selected labels and filled buttons readable in both themes',()=>{
  for(const theme of ['light','dark']) for(const accent of [...COLOR_PRESETS.map(preset=>preset.color),'#ffffff','#000000','#ffff00','#eeeeee','#777777','#00ff00','#ff0000','#0000ff']) {
    const tokens=appearanceTokens({...DEFAULT_APPEARANCE,theme,accent});
    assert.ok(colorContrast(tokens['--acc'],theme==='light'?'#ffffff':'#182434')>=4.5);
    assert.ok(colorContrast(tokens['--acc'],tokens['--acc-soft'])>=4.5);
    assert.ok(colorContrast(tokens['--acc'],tokens['--acc-contrast'])>=4.5);
    assert.ok(colorContrast(tokens['--acc-solid'],'#ffffff')>=4.5);
  }
});

test('malformed stored settings fall back while Thai project labels remain plain text',()=>{
  assert.deepEqual(normalizeAppearance(null),DEFAULT_APPEARANCE);
  const value=normalizeAppearance({theme:'invalid',accent:'url(test)',fontSize:'huge',projectName:'  โครงการทดสอบ <TBM>  ',projectDetail:' ',appName:'ชื่อ'.repeat(100)});
  assert.equal(value.projectName,'โครงการทดสอบ <TBM>');
  assert.equal(value.theme,'light');assert.equal(value.accent,DEFAULT_APPEARANCE.accent);
  assert.equal(value.fontSize,'md');assert.equal(value.projectDetail,DEFAULT_APPEARANCE.projectDetail);
  assert.equal(value.appName.length,40);
});
