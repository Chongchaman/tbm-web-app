import { useState } from 'react';
import { Compass } from 'lucide-react';
import { PageHeader } from '../components/PlannerUI';
import SoilProfilePanel from '../components/SoilProfilePanel';
import { DEFAULT_ALIGNMENT_SECTIONS } from '../services/advancePlanner';
import { readStored } from '../services/decisionSupport';
import { soilLevelAtStation } from '../services/soilProfile';

const savedStation = track => {
  const session=readStored(`tbm_advance_session_${track}`,{})||{};
  const sections=Array.isArray(session.sections)&&session.sections.length?session.sections:readStored('tbm_horizontal_alignment',DEFAULT_ALIGNMENT_SECTIONS);
  return session.currentSTA??sections[0]?.startSTA??'';
};

export default function SoilProfileView({track='EB',onTrackChange=()=>{},onNavigate=()=>{}}) {
  const [stations,setStations]=useState(()=>({EB:savedStation('EB'),WB:savedStation('WB')}));
  const [soilLevels,setSoilLevels]=useState(()=>readStored('tbm_soil_levels',{EB:'',WB:''}));
  const [soilLevelStations,setSoilLevelStations]=useState(()=>readStored('tbm_soil_level_stations',{}));
  const elevations=Object.fromEntries(['EB','WB'].map(value=>[value,soilLevelAtStation(soilLevels,soilLevelStations,value,stations[value])]));
  const changeStation=(which,value)=>{
    const session=readStored(`tbm_advance_session_${which}`,{})||{};
    const updated={...session,currentSTA:value,recovery:{...session.recovery,initialStateConfirmed:false}};
    localStorage.setItem(`tbm_advance_session_${which}`,JSON.stringify(updated));
    setStations(previous=>({...previous,[which]:value}));
  };
  const changeElevation=(which,value)=>{
    const levels={...soilLevels,[which]:value},bindings={...soilLevelStations,[which]:stations[which]};
    localStorage.setItem('tbm_soil_levels',JSON.stringify(levels));
    localStorage.setItem('tbm_soil_level_stations',JSON.stringify(bindings));
    setSoilLevels(levels);setSoilLevelStations(bindings);
  };
  return <div className="stack soil-page">
    <PageHeader eyebrow="Orange Line · Soil profile" title="ชั้นดินตาม STA" description="ดูข้อมูลชั้นดิน EB และ WB แยกตาม STA ของแต่ละเครื่อง พร้อมระดับหัวเจาะ mRL จากแบบที่ตรวจสอบแล้ว" actions={<button className="btn btn-outline" onClick={()=>onNavigate('advanceplanner')}><Compass size={16}/>กลับไปวางแผนแนวอุโมงค์</button>}/>
    <SoilProfilePanel stations={stations} track={track} onTrackChange={onTrackChange} elevations={elevations} onStationChange={changeStation} onElevationChange={changeElevation}/>
  </div>;
}
