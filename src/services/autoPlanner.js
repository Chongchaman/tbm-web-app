import { evaluateCandidates } from './smartCandidates.js';
import { validatePlanningInput, validateGapSettings, summarizeRings, getLimits, round } from './decisionSupport.js';
import { normalizeGapSettings } from './gapSettings.js';

export function calculateLeadRequest({alignmentType='straight',radius=500,segWidth=1400}) {
  if(alignmentType==='straight' || Number(radius)<=0) return 0;
  return round(6300*Number(segWidth)/(Number(radius)*1000)*(alignmentType==='right'?1:-1));
}

export function runAutoPlan({startRingNum='R0016',startKey='L2',startHLead=38.39,startVLead=32.47,alignmentType='straight',radius=500,ringCount=10,targetV=0,leadLimit=55,gapSettings={initialGapTop:50,initialGapBottom:50,initialGapLeft:50,initialGapRight:50,warnThreshold:15,criticalThreshold:5},allowedTypes=['U','R','L'],lookaheadDepth=3}) {
  gapSettings=normalizeGapSettings(gapSettings);
  const errors=[...validatePlanningInput({startKey,startHLead,startVLead,alignmentType,radius,ringCount,targetV,maxTolerance:leadLimit}),...validateGapSettings(gapSettings)];
  if(!/^R?\d+$/i.test(String(startRingNum)) || Number(String(startRingNum).replace(/^R/i,''))<1) errors.push('หมายเลขริงเริ่มต้นไม่ถูกต้อง');
  if(!Number.isInteger(Number(lookaheadDepth)) || Number(lookaheadDepth)<1 || Number(lookaheadDepth)>3) errors.push('จำนวนริงมองล่วงหน้าต้องเป็น 1–3');
  if(!Array.isArray(allowedTypes) || !allowedTypes.length || allowedTypes.some(type=>!['U','R','L'].includes(type))) errors.push('ต้องอนุญาตเซ็กเมนต์อย่างน้อย 1 ชนิด');
  if(errors.length) throw new Error(errors.join(' · '));
  const count=Number(ringCount), start=Number(String(startRingNum).replace(/^R/i,''));
  let currentKey=startKey,currentH=Number(startHLead),currentV=Number(startVLead);
  const plannedRings=[];
  for(let step=1;step<=count;step++) {
    let beams=[{key:currentKey,h:currentH,v:currentV,cost:0,first:null}];
    const depth=Math.min(3,Math.max(1,Number(lookaheadDepth)),count-step+1);
    for(let d=0;d<depth;d++) {
      const next=[];
      for(const beam of beams) {
        const candidates=evaluateCandidates({beforeKey:beam.key,beforeHLead:beam.h,beforeVLead:beam.v,alignmentType,radius,targetV,targetMode:'alignment',leadLimit,gapSettings,allowedTypes,lookahead:false});
        for(const candidate of candidates) next.push({key:candidate.key,h:candidate.afterHLead,v:candidate.afterVLead,cost:beam.cost+candidate.cost,first:beam.first||candidate});
      }
      beams=next.sort((a,b)=>a.cost-b.cost).slice(0,6);
      if(!beams.length) throw new Error(`ไม่มีคีย์ต่อเนื่องที่ใช้ได้ในริง ${step} ภายใต้ชนิดเซ็กเมนต์ที่อนุญาต`);
    }
    const best=beams[0].first;
    plannedRings.push({...best,step,ringNum:`R${String(start+step-1).padStart(4,'0')}`,selectedKey:best.key,prevKey:currentKey,afterH:best.afterHLead,afterV:best.afterVLead,totalDrift:best.drift,driftH:round(best.afterHLead-best.targetH),driftV:round(best.afterVLead-Number(targetV)),recordType:'planned',notes:`Auto Planned (Step ${step}) · ${depth}-ring lookahead · ${best.reason}`});
    currentKey=best.key;currentH=best.afterHLead;currentV=best.afterVLead;
  }
  return {plannedRings,ringCount:count,alignmentType,radius:Number(radius),leadRequest:calculateLeadRequest({alignmentType,radius,segWidth:1400}),totalDistanceM:round(plannedRings.reduce((sum,r)=>sum+r.sizeM,0)),maxDrift:Math.max(...plannedRings.map(r=>r.totalDrift)),avgDrift:round(plannedRings.reduce((sum,r)=>sum+r.totalDrift,0)/count),rCount:plannedRings.filter(r=>r.type==='R').length,lCount:plannedRings.filter(r=>r.type==='L').length,uCount:plannedRings.filter(r=>r.type==='U').length,summary:summarizeRings(plannedRings,{...getLimits(gapSettings),lead:Number(leadLimit)})};
}
