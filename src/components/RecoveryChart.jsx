export default function RecoveryChart({ planResult, onSelectStep }) {
  const rings=planResult.plannedRings || [],config=planResult.recovery;
  if(!config || !rings.length)return null;
  const points=[{distance:0,h:Number(config.startDeviationH),v:Number(config.startDeviationV),th:Number(config.startDeviationH),tv:Number(config.startDeviationV)},
    ...rings.map(r=>({distance:r.dist+r.simulatedLengthM,h:r.deviationMm,v:r.deviationVMm,th:r.targetDeviationH,tv:r.targetDeviationV,step:r.step}))];
  const magnitude=Math.max(100,...points.flatMap(p=>[Math.abs(p.h),Math.abs(p.v),Math.abs(p.th),Math.abs(p.tv)]))*1.15;
  const x=distance=>64+distance/config.totalDistanceM*720,y=value=>140-value/magnitude*104;
  const path=field=>points.map((p,i)=>`${i?'L':'M'}${x(p.distance).toFixed(2)},${y(p[field]).toFixed(2)}`).join(' ');
  return <section className="card stack" aria-label="กราฟการกลับเข้าแนว"><div><h3>ระยะเยื้องและแนวแก้กลับเข้า Alignment</h3><p className="section-note">เส้นทึบคือผลจำลอง · เส้นประคือแนวแก้เป้าหมาย · H บวกขวา / V บวกขึ้น เมื่อมองตามทิศขุด</p></div>
    <svg viewBox="0 0 840 285" role="img" aria-label="ระยะเยื้องแนวราบและแนวดิ่งตามระยะขุด" style={{width:'100%',height:'auto',minHeight:150}}>
      {[-magnitude/2,0,magnitude/2].map(value=><g key={value}><line x1="64" x2="784" y1={y(value)} y2={y(value)} stroke="var(--border)"/><text x="56" y={y(value)+4} textAnchor="end" fontSize="12" fill="var(--text-muted)">{value.toFixed(0)}</text></g>)}
      <text x="15" y="25" fontSize="12" fill="var(--text-muted)">mm</text>
      <path d={path('th')} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="7 5"/>
      <path d={path('tv')} fill="none" stroke="#c026d3" strokeWidth="2" strokeDasharray="7 5"/>
      <path d={path('h')} fill="none" stroke="#2563eb" strokeWidth="2.5"/>
      <path d={path('v')} fill="none" stroke="#c026d3" strokeWidth="2.5"/>
      {[0,.25,.5,.75,1].map(t=><text key={t} x={x(t*config.totalDistanceM)} y="268" textAnchor="middle" fontSize="12" fill="var(--text-muted)">{(t*config.totalDistanceM).toFixed(1)} m</text>)}
    </svg><div className="page-actions"><span style={{color:'#2563eb'}}>H แนวราบ</span><span style={{color:'#c026d3'}}>V แนวดิ่ง</span><button className="btn btn-outline" onClick={()=>onSelectStep(rings.length)}>ตรวจริงปลายทาง</button></div>
  </section>;
}
