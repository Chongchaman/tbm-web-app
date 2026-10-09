import { useMemo, useState } from 'react';
import { PageHeader, Field, InsightPanel, StatCard, StatusBadge, ValidationErrors } from '../components/PlannerUI';
import { calculateFoamConsumption, calculatePolymerConsumption } from '../services/calculator';
import { validateConditioning, round, finite } from '../services/decisionSupport';
import { recommendSoilConditioning, SOIL_PROFILES } from '../services/soilConditioningAdvisor';

const defaults={tbmDia:6610,segWidth:1400,jackSpeed:40,foamDosage:1,fir:15,fer:8,earthPressure:.2,atmPressure:.101325,polymerDosage:.4,polymerInjection:25,distance:14};
const soilDefaults={soilType:'silty_clay',finesContent:'',waterContent:'',plasticityIndex:'',permeability:'unknown',groundwater:'unknown',muckCondition:'unknown',torqueTrend:'normal',dataQuality:'estimate'};
const confidenceText={high:'สูง · ข้อมูล Lab ค่อนข้างครบ',medium:'กลาง · ใช้เริ่ม Trial ได้',low:'ต่ำ · ต้องเพิ่มข้อมูลดิน'};
const confidenceLevel={high:'normal',medium:'warning',low:'unknown'};

function SoilAdviceForm({soil,onChange}) {
  const field=(key,label,hint)=><Field label={label} hint={hint}><input type="number" min="0" max="100" step="0.1" value={soil[key]} placeholder="ยังไม่ทราบ" onChange={e=>onChange(key,e.target.value)}/></Field>;
  return <div className="card">
    <div className="section-heading"><div><h3>ข้อมูลดินเพื่อวิเคราะห์</h3><p className="section-note">กรอกค่าจาก Lab/รายงานดินให้ครบ ระบบจะเพิ่มความมั่นใจตามข้อมูลจริง</p></div></div>
    <div className="form-grid">
      <Field label="กลุ่มดินหลัก"><select value={soil.soilType} onChange={e=>onChange('soilType',e.target.value)}>{Object.entries(SOIL_PROFILES).map(([value,item])=><option key={value} value={value}>{item.label}</option>)}</select></Field>
      <Field label="แหล่งข้อมูล"><select value={soil.dataQuality} onChange={e=>onChange('dataQuality',e.target.value)}><option value="estimate">ประเมินจากหน้างาน</option><option value="field">ผลทดสอบหน้างาน</option><option value="lab">ผล Lab ของช่วงนี้</option></select></Field>
      {field('finesContent','เม็ดละเอียด <0.075 mm (%)','จาก sieve / hydrometer')}
      {field('waterContent','ความชื้นธรรมชาติ (%)','Natural water content')}
      {field('plasticityIndex','Plasticity Index · PI','ใส่ 0 เมื่อเป็นดิน non-plastic')}
      <Field label="การซึมน้ำ"><select value={soil.permeability} onChange={e=>onChange('permeability',e.target.value)}><option value="unknown">ยังไม่ทราบ</option><option value="low">ต่ำ</option><option value="medium">ปานกลาง</option><option value="high">สูง</option></select></Field>
      <Field label="น้ำใต้ดิน / น้ำไหลเข้า"><select value={soil.groundwater} onChange={e=>onChange('groundwater',e.target.value)}><option value="unknown">ยังไม่ทราบ</option><option value="low">ต่ำ</option><option value="medium">ปานกลาง</option><option value="high">สูง</option></select></Field>
      <Field label="สภาพ Muck ล่าสุด"><select value={soil.muckCondition} onChange={e=>onChange('muckCondition',e.target.value)}><option value="unknown">ยังไม่มีข้อมูล</option><option value="good">Plastic flow ดี</option><option value="dry">ร่วน / แห้ง</option><option value="wet">เหลว / ไหลพุ่ง</option><option value="sticky">เหนียวติด</option></select></Field>
      <Field label="แนวโน้ม Cutterhead torque"><select value={soil.torqueTrend} onChange={e=>onChange('torqueTrend',e.target.value)}><option value="normal">ปกติ</option><option value="high">สูงกว่าช่วงปกติ</option></select></Field>
    </div>
  </div>;
}

function AdvicePanel({advice,onApply}) {
  return <>
    <div className="card">
      <div className="section-heading"><div><span className="eyebrow">Smart trial recommendation</span><h3>ช่วงเริ่มทดลองสำหรับ {advice.soilLabel}</h3></div><StatusBadge level={confidenceLevel[advice.confidence]}>{confidenceText[advice.confidence]}</StatusBadge></div>
      <div className="stat-grid">
        <StatCard label="FIR เป้าหมาย" value={advice.fir.target} unit="%" detail={`ช่วง ${advice.fir.min}–${advice.fir.max}%`}/>
        <StatCard label="FER เป้าหมาย" value={advice.fer.target} unit="เท่า" detail={`ช่วง ${advice.fer.min}–${advice.fer.max}`}/>
        <StatCard label="Foam concentration" value={advice.concentration.target} unit="%" detail={`ช่วง ${advice.concentration.min}–${advice.concentration.max}%`}/>
        <StatCard label="Liquid injection โดยประมาณ" value={advice.liquidInjectionRatio} unit="%" detail="FIR ÷ FER"/>
      </div>
      <div className="section-heading mt-4"><span className="section-note">ความครบของข้อมูล {advice.completeness}% · คะแนนความมั่นใจ {advice.confidenceScore}/100</span><button type="button" className="btn btn-acc" onClick={onApply}>ใช้ค่าเป้าหมายคำนวณ</button></div>
    </div>
    <InsightPanel level={confidenceLevel[advice.confidence]} title="เหตุผลที่ระบบปรับค่า">
      <ul>{advice.reasons.map((item,index)=><li key={index}>{item}</li>)}</ul>
      {advice.polymerSuggested&&<p className="mt-3"><strong>ควรทำ Polymer/anti-clay trial เพิ่ม</strong> เพราะข้อมูลบ่งชี้ความเสี่ยงด้านการยึดเกาะหรือการซึมน้ำ</p>}
    </InsightPanel>
    <InsightPanel level="warning" title="เงื่อนไขก่อนใช้ค่าหน้างาน"><ul>{advice.cautions.map((item,index)=><li key={index}>{item}</li>)}</ul></InsightPanel>
  </>;
}

export default function ConditioningPlanner() {
  const [form,setForm]=useState(defaults);
  const [soil,setSoil]=useState(soilDefaults);
  const [tab,setTab]=useState('foam');
  const [forecastCount,setForecastCount]=useState(10);
  const [reference,setReference]=useState(null);
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const updateSoil=(key,value)=>setSoil(prev=>({...prev,[key]:value}));
  const advice=useMemo(()=>recommendSoilConditioning(soil),[soil]);
  const applyAdvice=()=>setForm(prev=>({...prev,fir:advice.fir.target,fer:advice.fer.target,foamDosage:advice.concentration.target}));
  const foamErrors=validateConditioning(Object.fromEntries(Object.entries(form).filter(([key])=>!['polymerDosage','polymerInjection','distance'].includes(key))));
  const polymerErrors=[];
  for (const key of ['tbmDia','polymerDosage','polymerInjection','distance']) if(!finite(form[key]) || Number(form[key])<0 || (key==='tbmDia'&&Number(form[key])===0)) polymerErrors.push(`${key}: กรุณากรอกตัวเลขในช่วงที่ใช้ได้`);
  if(Number(form.polymerDosage)>100) polymerErrors.push('Polymer concentration ต้องไม่เกิน 100%');
  const forecastValid=finite(forecastCount)&&Number.isInteger(Number(forecastCount))&&Number(forecastCount)>0;
  const errors=tab==='foam'?foamErrors:polymerErrors;
  const foam=foamErrors.length?null:calculateFoamConsumption(Object.fromEntries(Object.entries(form).map(([k,v])=>[k,Number(v)])));
  const polymer=polymerErrors.length?null:calculatePolymerConsumption({tbmDia:Number(form.tbmDia),polymerDosage:Number(form.polymerDosage),polymerSolutionInjection:Number(form.polymerInjection),distance:Number(form.distance)});
  const input=(key,label,min=0,step=.1)=><Field label={label} key={key}><input type="number" min={min} step={step} value={form[key]} onChange={e=>update(key,e.target.value)}/></Field>;
  const totalFoam=foam&&forecastValid?round(foam.perRing.foamAgentL*Number(forecastCount)):null;
  const compare=reference?.foam!=null&&foam?round(foam.perRing.foamAgentL-reference.foam):null;
  const reset=()=>{setForm(defaults);setSoil(soilDefaults);setReference(null);};

  return <div className="stack"><PageHeader eyebrow="Soil conditioning · Smart trial" title="คำนวณและประมาณการสารปรับปรุงดิน" description="วิเคราะห์ข้อมูลดินเพื่อเสนอช่วง FIR, FER และความเข้มข้นสำหรับเริ่ม Trial พร้อมคำนวณอัตราจ่ายและปริมาณที่ต้องเตรียม" actions={<><button className="btn btn-outline" disabled={tab==='foam'?!foam:!polymer} onClick={()=>setReference({foam:foam?.perRing.foamAgentL??null,polymer:polymer?.totalConsumptionL??null,form:{...form}})}>เก็บค่าอ้างอิงเปรียบเทียบ</button><button className="btn btn-outline" onClick={reset}>คืนค่าตั้งต้น</button></>}/>
    <ValidationErrors errors={errors}/><div className="workspace-grid"><section className="stack"><SoilAdviceForm soil={soil} onChange={updateSoil}/><div className="card"><h3 className="mb-4">เครื่องและการขุด</h3><div className="form-grid">{input('tbmDia','เส้นผ่านศูนย์กลาง TBM (mm)',1,1)}<Field label="ความยาวริง"><select value={form.segWidth} onChange={e=>update('segWidth',e.target.value)}><option value={1200}>UN · 1.2 m</option><option value={1400}>RT/LT · 1.4 m</option></select></Field>{input('jackSpeed','ความเร็วแม่แรง (mm/min)',.01)}{input('earthPressure','ความดันดิน (MPa)',0,.01)}</div><details className="mt-4"><summary>ความดันบรรยากาศอ้างอิง</summary><div className="mt-3">{input('atmPressure','ความดันบรรยากาศ (MPa)',.00001,.000001)}</div></details></div>
    <div className="card"><div className="tab-strip"><button aria-pressed={tab==='foam'} onClick={()=>setTab('foam')}>Foam</button><button aria-pressed={tab==='polymer'} onClick={()=>setTab('polymer')}>Polymer</button></div>{tab==='foam'?<div className="form-grid">{input('foamDosage','Foam concentration (%)')}{input('fir','FIR · Foam / Soil (%)')}{input('fer','FER · Expansion ratio',1)}</div>:<div className="form-grid">{input('polymerDosage','Polymer concentration (%)')}{input('polymerInjection','Solution / Soil (%)')}{input('distance','ระยะประมาณการ Polymer (m)')}</div>}<p className="section-note mt-4">ค่าที่แนะนำเป็นจุดเริ่ม Trial จากคุณสมบัติดิน ต้องปรับตามผลทดสอบและการตอบสนองของ TBM</p></div></section>
    <section className="stack">{tab==='foam'&&<AdvicePanel advice={advice} onApply={applyAdvice}/>} {(tab==='foam'?foam:polymer) && <>{tab==='foam'&&<><div className="stat-grid"><StatCard label="ปริมาตรดินต่อริง" value={foam.soilPerRing} unit="m³"/><StatCard label="เวลาขุดต่อริง" value={foam.excavationTime} unit="min"/><StatCard label="Foam agent ต่อริง" value={foam.perRing.foamAgentL} unit="L"/></div><InsightPanel level="normal" title="ผลสัมพันธ์กับความเร็วและสัดส่วนที่กรอก"><p>ความเร็วแม่แรงเปลี่ยนอัตราจ่ายต่อเวลา ส่วนปริมาณต่อริงขึ้นกับปริมาตรดิน FIR, FER และความเข้มข้น</p>{compare!==null && <p>Foam agent ต่อริง {compare>0?'เพิ่ม':compare<0?'ลด':'เปลี่ยน'} {Math.abs(compare)} L เทียบค่าอ้างอิง · ความเร็วอ้างอิง {reference.form.jackSpeed} mm/min</p>}</InsightPanel></>}
    <div className="card"><div className="section-heading"><h3>{tab==='foam'?'อัตราจ่าย Foam':'ปริมาณ Polymer ตามระยะ'}</h3><span className="section-note">ผลคำนวณ</span></div>{tab==='foam'?<dl className="detail-list"><div><dt>Foam solution</dt><dd>{foam.flowRates.foamSolutionLMin} L/min</dd></div><div><dt>Foam agent</dt><dd>{foam.flowRates.foamAgentLMin} L/min</dd></div><div><dt>น้ำผสม</dt><dd>{foam.flowRates.waterLMin} L/min</dd></div><div><dt>อากาศที่บรรยากาศอ้างอิง</dt><dd>{foam.flowRates.airAtAtmNLMin} NL/min</dd></div><div><dt>Foam solution ต่อหัวจ่าย (3 หัว)</dt><dd>{foam.perPort.foamSolutionL} L/min</dd></div><div><dt>อากาศต่อหัวจ่าย (3 หัว)</dt><dd>{foam.perPort.airAtAtmNL} NL/min</dd></div></dl>:<dl className="detail-list"><div><dt>Polymer ต่อระยะ</dt><dd>{polymer.polymerDosagePerMeterL} L/m</dd></div><div><dt>ระยะที่กรอก</dt><dd>{form.distance} m</dd></div><div><dt>Polymer agent รวม</dt><dd>{polymer.totalConsumptionL} L</dd></div><div><dt>Solution ต่อเมตร</dt><dd>{polymer.polymerInjectionPerMeterM3} m³/m</dd></div>{reference?.polymer!=null && <div><dt>เปลี่ยนจากค่าอ้างอิง</dt><dd>{round(polymer.totalConsumptionL-reference.polymer)} L</dd></div>}</dl>}</div>
    </>}{tab==='foam'&&<div className="card"><div className="section-heading"><h3>ประมาณการจัดเตรียม Foam</h3><span className="source-label">ความยาวริงตามตัวเลือก</span></div><div className="form-grid"><Field label="จำนวนริงที่จะขุด"><input type="number" min="1" step="1" value={forecastCount} onChange={e=>setForecastCount(e.target.value)}/></Field><div><span className="stat-label">ระยะรวม</span><p>{forecastValid?round(Number(form.segWidth)/1000*Number(forecastCount)):'—'} m</p></div></div><ValidationErrors errors={forecastValid?[]:['จำนวนริงประมาณการต้องเป็นจำนวนเต็มมากกว่า 0']}/>{foam&&forecastValid&&<dl className="detail-list mt-4"><div><dt>Foam agent รวม</dt><dd>{totalFoam} L</dd></div><div><dt>น้ำผสมรวม</dt><dd>{round(foam.perRing.waterL*Number(forecastCount))} L</dd></div><div><dt>เวลาขุดประมาณการ</dt><dd>{round(foam.excavationTime*Number(forecastCount)/60,1)} h</dd></div></dl>}<p className="section-note mt-3">เวลานี้ไม่รวมประกอบริง หยุดเครื่อง และความสูญเสียในระบบ</p></div>}
    </section></div>
  </div>;
}
