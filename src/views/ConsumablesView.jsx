import React, { useState, useMemo } from 'react';
import { 
  Droplets, 
  Wind, 
  Layers, 
  Sliders, 
  Activity, 
  HelpCircle,
  BarChart3,
  Gauge
} from 'lucide-react';
import { calculateFoamConsumption, calculatePolymerConsumption } from '../services/calculator';
import { TBM_SPECS } from '../data/tbmConstants';

export default function ConsumablesView() {
  // Foam Parameters (MWA-9D TBM#34 defaults)
  const [tbmDia, setTbmDia] = useState(TBM_SPECS.TBM_DIAMETER);
  const [segWidth, setSegWidth] = useState(TBM_SPECS.SEGMENT_WIDTH_DEFAULT);
  const [jackSpeed, setJackSpeed] = useState(TBM_SPECS.JACK_SPEED_DEFAULT);
  const [foamDosage, setFoamDosage] = useState(1.0);       // %
  const [fir, setFir] = useState(15.0);                     // % (FIR)
  const [fer, setFer] = useState(8.0);                      // times (FER)
  const [earthPressure, setEarthPressure] = useState(0.2);  // MPa
  const [atmPressure, setAtmPressure] = useState(0.101325); // MPa

  // Polymer Parameters
  const [polymerDosage, setPolymerDosage] = useState(0.4);   // %
  const [polymerInjection, setPolymerInjection] = useState(25.0); // %
  const [excavatedDistance, setExcavatedDistance] = useState(2.0); // m

  // Foam Calculations
  const foamResults = useMemo(() => {
    return calculateFoamConsumption({
      tbmDia: Number(tbmDia),
      segWidth: Number(segWidth),
      jackSpeed: Number(jackSpeed),
      foamDosage: Number(foamDosage),
      earthPressure: Number(earthPressure),
      atmPressure: Number(atmPressure),
      fir: Number(fir),
      fer: Number(fer),
    });
  }, [tbmDia, segWidth, jackSpeed, foamDosage, earthPressure, atmPressure, fir, fer]);

  // Polymer Calculations
  const polymerResults = useMemo(() => {
    return calculatePolymerConsumption({
      tbmDia: Number(tbmDia),
      polymerDosage: Number(polymerDosage),
      polymerSolutionInjection: Number(polymerInjection),
      distance: Number(excavatedDistance),
    });
  }, [tbmDia, polymerDosage, polymerInjection, excavatedDistance]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              SOIL CONDITIONING ENGINE
            </span>
            <span className="text-xs text-text-muted">MWA-9D TBM#34 Consumables Protocol</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Foam & Polymer Consumption Calculator</h2>
          <p className="text-sm text-text-muted mt-1">
            Calculate exact chemical dosage, flow rates, air pressure balances, and geological section requirements.
          </p>
        </div>
      </div>

      {/* Machine & Excavation Baseline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <span className="text-xs text-text-muted uppercase font-mono">Excavation Section Area</span>
          <h3 className="text-2xl font-extrabold font-mono text-acc mt-1">{foamResults.sectionArea} <span className="text-sm font-normal text-text-muted">m²</span></h3>
          <span className="text-xs text-text-muted">Dia &empty; {tbmDia} mm</span>
        </div>
        <div className="card">
          <span className="text-xs text-text-muted uppercase font-mono">Excavated Soil Per Ring</span>
          <h3 className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">{foamResults.soilPerRing} <span className="text-sm font-normal text-text-muted">m³</span></h3>
          <span className="text-xs text-text-muted">Width {segWidth} mm</span>
        </div>
        <div className="card">
          <span className="text-xs text-text-muted uppercase font-mono">Excavation Time Per Ring</span>
          <h3 className="text-2xl font-extrabold font-mono text-amber-400 mt-1">{foamResults.excavationTime} <span className="text-sm font-normal text-text-muted">min</span></h3>
          <span className="text-xs text-text-muted">Jack Speed {jackSpeed} mm/min</span>
        </div>
        <div className="card">
          <span className="text-xs text-text-muted uppercase font-mono">Discharge Soil Flow</span>
          <h3 className="text-2xl font-extrabold font-mono text-purple-400 mt-1">{foamResults.dischargeSoilFlowLMin} <span className="text-sm font-normal text-text-muted">L/min</span></h3>
          <span className="text-xs text-text-muted">{foamResults.dischargeSoilFlowM3Min} m³/min</span>
        </div>
      </div>

      {/* Main Calculation Tabs / Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Foam Section (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-acc uppercase tracking-wider flex items-center gap-2">
                <Droplets size={16} /> 1. Foam Consumption (Foam Only System)
              </h3>
              <span className="text-xs font-mono text-text-muted">Parameters</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="field">
                <label>Foam Dosage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={foamDosage}
                  onChange={(e) => setFoamDosage(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>FIR (Foam / Soil %)</label>
                <input
                  type="number"
                  step="1"
                  value={fir}
                  onChange={(e) => setFir(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>FER (Expansion)</label>
                <input
                  type="number"
                  step="0.5"
                  value={fer}
                  onChange={(e) => setFer(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Earth Press. (MPa)</label>
                <input
                  type="number"
                  step="0.05"
                  value={earthPressure}
                  onChange={(e) => setEarthPressure(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Results Grid */}
            <div className="bg-surf-3/70 rounded-xl p-4 border border-white/10 space-y-3 font-mono text-xs">
              <div className="text-xs font-bold text-text uppercase tracking-wider border-b border-white/5 pb-1.5">
                Flow Rates & Volumes Per Ring (1,400 mm)
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Foam Agent:</span>
                  <span className="font-bold text-acc">{foamResults.flowRates.foamAgentLMin} L/min &rarr; <strong className="text-emerald-400">{foamResults.perRing.foamAgentL} L/ring</strong></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Foam Solution:</span>
                  <span className="font-bold text-text">{foamResults.flowRates.foamSolutionLMin} L/min &rarr; {foamResults.perRing.foamSolutionL} L/ring</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Water:</span>
                  <span className="font-bold text-text">{foamResults.flowRates.waterLMin} L/min &rarr; {foamResults.perRing.waterL} L/ring</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Foam in Chamber:</span>
                  <span className="font-bold text-text">{foamResults.flowRates.foamInChamberLMin} L/min &rarr; {foamResults.perRing.foamInChamberL} L/ring</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Air @ ATM:</span>
                  <span className="font-bold text-fair">{foamResults.flowRates.airAtAtmNLMin} NL/min &rarr; {foamResults.perRing.airAtAtmNL} NL/ring</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Air @ Pressure:</span>
                  <span className="font-bold text-text">{foamResults.flowRates.airAtPressureLMin} L/min &rarr; {foamResults.perRing.airAtPressureL} L/ring</span>
                </div>
              </div>

              {/* Port & Metric Breakdown */}
              <div className="border-t border-white/5 pt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-surf-2 p-2 rounded-lg">
                  <span className="text-text-muted block">Foam Agent / Meter:</span>
                  <span className="font-bold text-acc">{foamResults.metrics.foamAgentPerMeter} L/m</span>
                </div>
                <div className="bg-surf-2 p-2 rounded-lg">
                  <span className="text-text-muted block">Foam Agent / m³ Soil:</span>
                  <span className="font-bold text-acc">{foamResults.metrics.foamAgentPerM3Soil} L/m³</span>
                </div>
                <div className="bg-surf-2 p-2 rounded-lg">
                  <span className="text-text-muted block">Solution per Port (3 ports):</span>
                  <span className="font-bold text-text">{foamResults.perPort.foamSolutionL} L/min</span>
                </div>
                <div className="bg-surf-2 p-2 rounded-lg">
                  <span className="text-text-muted block">Air @ ATM per Port:</span>
                  <span className="font-bold text-fair">{foamResults.perPort.airAtAtmNL} NL/min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Polymer Section (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} /> 2. Polymer Conditioning (Alfa-G)
              </h3>
              <span className="text-xs font-mono text-text-muted">Parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>Polymer Dosage (%)</label>
                <input
                  type="number"
                  step="0.05"
                  value={polymerDosage}
                  onChange={(e) => setPolymerDosage(Number(e.target.value))}
                />
                <span className="hint">% of Water Volume 1 m³</span>
              </div>

              <div className="field">
                <label>Injection Ratio (%)</label>
                <input
                  type="number"
                  step="1"
                  value={polymerInjection}
                  onChange={(e) => setPolymerInjection(Number(e.target.value))}
                />
                <span className="hint">% of Excavated Soil</span>
              </div>
            </div>

            <div className="field">
              <label>Excavated Distance (m)</label>
              <input
                type="number"
                step="0.1"
                value={excavatedDistance}
                onChange={(e) => setExcavatedDistance(Number(e.target.value))}
              />
            </div>

            {/* Polymer Results */}
            <div className="bg-surf-3/70 rounded-xl p-4 border border-white/10 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                <span className="text-text-muted">Soil Vol / Meter:</span>
                <span className="font-bold text-text">{polymerResults.soilVolumePerMeter} m³</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                <span className="text-text-muted">Polymer Injection / Meter:</span>
                <span className="font-bold text-text">{polymerResults.polymerInjectionPerMeterM3} m³</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
                <span className="text-text-muted">Polymer Dosage / Meter:</span>
                <span className="font-bold text-purple-300">{polymerResults.polymerDosagePerMeterL} L/m</span>
              </div>
              <div className="flex justify-between items-center pt-1 text-sm">
                <span className="font-bold text-text">Total Polymer ({polymerResults.distance}m):</span>
                <span className="font-extrabold text-emerald-400">{polymerResults.totalConsumptionL} Liters</span>
              </div>
            </div>

            {/* Geological Sections Reference */}
            <div className="bg-surf-2 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
              <span className="text-text-muted font-bold block">Geological Section Protocol (Sheet Reference):</span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="bg-surf-3 p-2 rounded">
                  <span className="text-text-muted block">Clay</span>
                  <span className="text-acc font-bold">2,800 m</span>
                </div>
                <div className="bg-surf-3 p-2 rounded">
                  <span className="text-text-muted block">Mixed Face</span>
                  <span className="text-amber-400 font-bold">650 m</span>
                </div>
                <div className="bg-surf-3 p-2 rounded">
                  <span className="text-text-muted block">Sand</span>
                  <span className="text-rose-400 font-bold">1,650 m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
