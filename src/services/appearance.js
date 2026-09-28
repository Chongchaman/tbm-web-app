export const DEFAULT_APPEARANCE = {
  projectName: 'MRT Purple Line', projectDetail: 'MWA-9D · TBM #34', appName: 'TBM PLANNER',
  theme: 'light', accent: '#175db3', background: 'plain', corners: 'rounded', shadow: 'none',
  brandIcon: 'hardhat', fontFamily: 'sarabun', fontSize: 'md', density: 'comfortable',
};
export const COLOR_PRESETS = [
  { name: 'น้ำเงิน', color: '#175db3' }, { name: 'เขียวทะเล', color: '#087f72' },
  { name: 'ม่วง', color: '#7652b8' }, { name: 'ส้ม', color: '#b45c13' },
  { name: 'ชมพู', color: '#b53269' }, { name: 'เทา', color: '#52657a' },
];
const choices = { theme:['light','dark'], background:['plain','tinted','gradient'], corners:['square','rounded','soft'], shadow:['none','soft'], brandIcon:['hardhat','compass','building'], fontFamily:['sarabun','prompt','noto','kanit','chakra','mitr'], fontSize:['sm','md','lg','xl'], density:['comfortable','compact'] };
export function normalizeAppearance(value) {
  const result = { ...DEFAULT_APPEARANCE };
  if (!value || typeof value !== 'object') return result;
  for (const [key, allowed] of Object.entries(choices)) if (allowed.includes(value[key])) result[key] = value[key];
  for (const key of ['projectName','projectDetail','appName']) if (typeof value[key] === 'string' && value[key].trim()) result[key] = value[key].trim().slice(0, key === 'appName' ? 40 : 100);
  if (/^#[0-9a-f]{6}$/i.test(value.accent)) result.accent = value.accent.toLowerCase();
  return result;
}
const rgb = hex => hex.slice(1).match(/../g).map(value => parseInt(value,16));
const hex = values => '#' + values.map(value => Math.round(value).toString(16).padStart(2,'0')).join('');
const mix = (color, target, amount) => hex(rgb(color).map((value,index) => value * (1-amount) + rgb(target)[index] * amount));
export function colorContrast(first, second) {
  const luminance = color => rgb(color).map(value => {const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,value,index) => sum + value*[.2126,.7152,.0722][index],0);
  const a=luminance(first), b=luminance(second);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function readable(color, surface, target) {
  const backgrounds=Array.isArray(surface)?surface:[surface];
  for (let step=0;step<=100;step++) {const candidate=mix(color,target,step/100);if(backgrounds.every(background=>colorContrast(candidate,background)>=4.5))return candidate;}
  return target;
}
export function appearanceTokens(value) {
  const settings=normalizeAppearance(value), dark=settings.theme==='dark';
  const surface=dark?'#182434':'#ffffff';
  const soft=mix(surface,settings.accent,dark?.19:.09);
  const accent=readable(settings.accent,[surface,soft],dark?'#ffffff':'#000000');
  const plain=dark?'#101824':'#f1f4f8';
  const tinted=mix(plain,settings.accent,dark?.08:.045);
  return {
    '--acc':accent, '--acc-solid':readable(settings.accent,'#ffffff','#000000'),
    '--acc-contrast':colorContrast(accent,'#ffffff')>=4.5?'#ffffff':colorContrast(accent,'#10213a')>=4.5?'#10213a':'#000000',
    '--acc-soft':soft,
    '--border-acc':accent+'59', '--acc-glow':accent+'33',
    '--bg':settings.background==='plain'?plain:tinted,
    '--ui-backdrop':settings.background==='gradient'?`linear-gradient(135deg, ${tinted}, ${plain} 65%)`:'none',
    '--ui-radius':{square:'6px',rounded:'14px',soft:'22px'}[settings.corners],
    '--ui-shadow':settings.shadow==='soft'?`0 6px 22px ${dark?'#00000026':'#233d5910'}`:'none',
  };
}
