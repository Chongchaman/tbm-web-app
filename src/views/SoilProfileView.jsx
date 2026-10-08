import { useState } from 'react';
import { Compass } from 'lucide-react';
import { PageHeader } from '../components/PlannerUI';
import SoilProfilePanel from '../components/SoilProfilePanel';
import { DEFAULT_ALIGNMENT_SECTIONS } from '../services/advancePlanner';
import { readStored } from '../services/decisionSupport';
import { clampSoilStation, formatSTA, SOIL_LIMITS } from '../services/soilProfile';
import { setProjectItem } from '../services/googleSheetsService';

const savedStation = track => {
  const session=readStored(`tbm_advance_session_${track}`,{})||{};
  const sections=Array.isArray(session.sections)&&session.sections.length?session.sections:readStored(`tbm_horizontal_alignment_${track}`,readStored('tbm_horizontal_alignment',DEFAULT_ALIGNMENT_SECTIONS));
  return clampSoilStation(session.currentSTA??sections[0]?.startSTA,track);
};

const initialRange = (station, track) => {
  const limit=SOIL_LIMITS[track];
  return {start:formatSTA(Math.max(limit.start,station-250)),end:formatSTA(Math.min(limit.end,station+250))};
};

export default function SoilProfileView({track='EB',onTrackChange=()=>{},onNavigate=()=>{}}) {
  const initial=savedStation(track);
  const [currentStation,setCurrentStation]=useState(()=>formatSTA(initial));
  const [range,setRange]=useState(()=>initialRange(initial,track));
  const changeStation=value=>{
    const session=readStored(`tbm_advance_session_${track}`,{})||{};
    setProjectItem(`tbm_advance_session_${track}`,JSON.stringify({...session,currentSTA:value,recovery:{...session.recovery,initialStateConfirmed:false}}));
    setCurrentStation(value);
  };
  return <div className="stack soil-page">
    <PageHeader eyebrow="Orange Line · OR10 ถึง TCC" title="ภาพชั้นดินและตำแหน่งหัวเจาะ" description="ดูรูปตัดตามช่วง STA ที่เลือก พร้อมหัวเจาะและระดับแนวอุโมงค์ E/B หรือ W/B จากแบบโครงการ" actions={<button className="btn btn-outline" onClick={()=>onNavigate('advanceplanner')}><Compass size={16}/>กลับไปวางแผนแนวอุโมงค์</button>}/>
    <SoilProfilePanel track={track} onTrackChange={onTrackChange} currentStation={currentStation} range={range} onCurrentChange={changeStation} onRangeChange={setRange}/>
  </div>;
}
