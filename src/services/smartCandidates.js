import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX } from '../data/tbmConstants.js';
import { predictGaps, assessRing, getLimits, SEGMENT_WIDTHS, round } from './decisionSupport.js';

/** Auditable deterministic ranking. Safety checks outrank short-term target drift. */
export function evaluateCandidates({ beforeKey='R13', beforeHLead=0, beforeVLead=0, curveHLead=0, curveVLead=0, alignmentType, radius=0, targetH=0, targetV=0, targetMode='fixed', leadLimit=55, gapSettings={}, lookahead=true, allowedTypes=['U','R','L'] }={}) {
  if(!KEY_DATA[beforeKey]) return [];
  const limits={...getLimits(gapSettings),lead:Number(leadLimit)};
  function candidatesFor(previousKey,h,v) {
    return (NEXT_RING_TABLE[previousKey]||[]).filter(key=>allowedTypes.includes(KEY_DATA[key].type)).map(key=>{
      const data=KEY_DATA[key];
      const width=SEGMENT_WIDTHS[data.type];
      const leadReq=alignmentType && alignmentType!=='straight' && Number(radius)>0 ? round(6300*width/(Number(radius)*1000)*(alignmentType==='right'?1:-1)) : alignmentType==='straight'?0:Number(curveHLead);
      const horizontalTarget=targetMode==='alignment'?leadReq:Number(targetH);
      const afterHLead=round(Number(h)+data.hLead+leadReq);
      const afterVLead=round(Number(v)+data.vLead+Number(curveVLead));
      const suitability=SUITABILITY_MATRIX[KEY_DATA[previousKey].pos]?.[data.pos] || 'Fair';
      const gaps=predictGaps(afterHLead,afterVLead,gapSettings);
      const assessment=assessRing({afterHLead,afterVLead,suitability,...gaps},limits);
      const drift=round(Math.hypot(afterHLead-horizontalTarget,afterVLead-Number(targetV)));
      const excess=Math.max(0,assessment.leadMax-limits.lead);
      const hard=assessment.issues.filter(i=>i.level==='critical').length;
      const warning=assessment.issues.filter(i=>i.level==='warning').length;
      const cost=hard*100000+warning*1000+excess*25+drift+(suitability==='Fair'?40:0);
      return { key,type:data.type,pos:data.pos,angle:data.angle,size:width,sizeM:width/1000,leadReq,targetH:horizontalTarget,targetV:Number(targetV),segHLead:data.hLead,segVLead:data.vLead,afterHLead,afterVLead,suitability,drift,cost,assessment,...gaps };
    });
  }
  const evaluated=candidatesFor(beforeKey,beforeHLead,beforeVLead).map(candidate=>{
    const future=lookahead?candidatesFor(candidate.key,candidate.afterHLead,candidate.afterVLead):[];
    const nextCost=future.length?Math.min(...future.map(c=>c.cost)):lookahead?1000000:0;
    const totalCost=candidate.cost+nextCost*.35;
    const reason=[`Suitability ${candidate.suitability}`,`Lead H/V ${candidate.afterHLead}/${candidate.afterVLead} mm`,`Gap คาดการณ์ต่ำสุด ${candidate.assessment.minGap} mm`,`ห่างเป้าหมาย ${candidate.drift} mm`,...(lookahead?['ประเมินทางเลือกของริงถัดไปด้วย']:[])].join(' · ');
    return {...candidate,totalCost,rankScore:round(100-totalCost),reason,nextCost};
  });
  return evaluated.sort((a,b)=>a.totalCost-b.totalCost || a.drift-b.drift || a.key.localeCompare(b.key));
}
