import React, { useState } from 'react';
import { KEY_DATA } from '../data/tbmConstants';

export default function RingDiagram({
  selectedKey = 'L2',
  beforeKey = 'R13',
  hoveredKey = null,
  rollDeg = 0,
  size = 320,
  interactive = false,
  onSelectKey = () => {},
  showWedge = true,
  showLabels = true,
}) {
  const [internalHover, setInternalHover] = useState(null);
  const activeHover = hoveredKey || internalHover;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 36;
  const innerR = outerR * 0.72;
  const centerR = (outerR + innerR) / 2;

  // Selected & Before Key details
  const selData = KEY_DATA[selectedKey] || { type: 'L', pos: 2, hLead: 0, vLead: 0 };
  const beforeData = beforeKey ? KEY_DATA[beforeKey] : null;

  const currentDisplayKey = activeHover ? activeHover : selectedKey;
  const currentDisplayData = KEY_DATA[currentDisplayKey] || selData;

  const keyType = currentDisplayData.type || 'L';
  const typeColor = keyType === 'R' ? '#ff5252' : keyType === 'L' ? '#00d4ff' : '#ffab40';
  const typeName = keyType === 'R' ? 'Right Taper' : keyType === 'L' ? 'Left Taper' : 'Universal';

  // Helper angle calculations
  const getAngleRad = (pos, roll = rollDeg) => {
    const deg = (pos - 1) * 22.5 + Number(roll);
    return (deg * Math.PI) / 180;
  };

  const getPosXY = (pos, r, roll = rollDeg) => {
    const a = getAngleRad(pos, roll);
    return {
      x: cx + r * Math.sin(a),
      y: cy - r * Math.cos(a),
    };
  };

  // Wedge orientation calculation
  // For R-type, thickest side is opposite Key, L-type thickest side is at Key, etc.
  const wedgeAngleRad = getAngleRad(currentDisplayData.pos, rollDeg);
  const wedgeX = cx + (innerR * 0.5) * Math.sin(wedgeAngleRad);
  const wedgeY = cy - (innerR * 0.5) * Math.cos(wedgeAngleRad);

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <defs>
            {/* Gradients */}
            <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={typeColor} stopOpacity="0.12" />
              <stop offset="100%" stopColor={typeColor} stopOpacity="0" />
            </radialGradient>

            <linearGradient id="wedgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={typeColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={typeColor} stopOpacity="0.2" />
            </linearGradient>

            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Glow */}
          <circle cx={cx} cy={cy} r={outerR + 10} fill="url(#ringGlow)" />

          {/* Outer & Inner Concrete Tunnel Wall */}
          <circle
            cx={cx}
            cy={cy}
            r={outerR}
            fill="#121a2c"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
          />
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="#0a0e1a"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />

          {/* Segment Radial Dividers (16 Segment divisions) */}
          {Array.from({ length: 16 }).map((_, i) => {
            const p = i + 1;
            const a = (p - 0.5) * 22.5 + Number(rollDeg);
            const rad = (a * Math.PI) / 180;
            const x1 = cx + innerR * Math.sin(rad);
            const y1 = cy - innerR * Math.cos(rad);
            const x2 = cx + outerR * Math.sin(rad);
            const y2 = cy - outerR * Math.cos(rad);
            return (
              <line
                key={`div-${p}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Cardinal Guidelines (0, 90, 180, 270 deg) */}
          <line x1={cx} y1={cy - outerR - 8} x2={cx} y2={cy + outerR + 8} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1={cx - outerR - 8} y1={cy} x2={cx + outerR + 8} y2={cy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

          {/* Roll Direction Arc Indicator if Roll != 0 */}
          {rollDeg !== 0 && (
            <g>
              <path
                d={`M ${cx} ${cy - outerR - 14} A ${outerR + 14} ${outerR + 14} 0 0 ${rollDeg > 0 ? 1 : 0} ${cx + (outerR + 14) * Math.sin((rollDeg * Math.PI) / 180)} ${cy - (outerR + 14) * Math.cos((rollDeg * Math.PI) / 180)}`}
                fill="none"
                stroke="#ffab40"
                strokeWidth="2"
                strokeDasharray="3,2"
              />
              <text
                x={cx + (outerR + 24) * Math.sin(((rollDeg / 2) * Math.PI) / 180)}
                y={cy - (outerR + 24) * Math.cos(((rollDeg / 2) * Math.PI) / 180)}
                fontSize="9"
                fontFamily="monospace"
                fill="#ffab40"
                textAnchor="middle"
              >
                {rollDeg > 0 ? `+${rollDeg}°` : `${rollDeg}°`}
              </text>
            </g>
          )}

          {/* Taper Wedge Direction Indicator (Thick vs Thin Side Vector) */}
          {showWedge && (
            <g>
              <circle cx={cx} cy={cy} r="4" fill={typeColor} />
              <line
                x1={cx}
                y1={cy}
                x2={wedgeX}
                y2={wedgeY}
                stroke={typeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#glowEffect)"
              />
              <circle
                cx={wedgeX}
                cy={wedgeY}
                r="6"
                fill={typeColor}
                stroke="#0a0e1a"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Key Position Pins (1..16) */}
          {Array.from({ length: 16 }).map((_, i) => {
            const p = i + 1;
            const keyName = `${keyType}${p}`;
            const isSelected = selectedKey && selectedKey.endsWith(String(p));
            const isBefore = beforeKey && beforeKey.endsWith(String(p));
            const isHovered = activeHover && activeHover.endsWith(String(p));

            const pinPos = getPosXY(p, centerR);
            const labelPos = getPosXY(p, outerR + 16);

            let pinColor = 'rgba(255,255,255,0.25)';
            let pinR = 3.5;
            let pinStroke = 'transparent';

            if (isSelected) {
              pinColor = typeColor;
              pinR = 7;
              pinStroke = '#ffffff';
            } else if (isHovered) {
              pinColor = '#ffffff';
              pinR = 6;
            } else if (isBefore) {
              pinColor = '#a855f7'; // Purple for previous ring key
              pinR = 5;
            }

            return (
              <g
                key={`pin-${p}`}
                className={interactive ? 'cursor-pointer group' : ''}
                onClick={() => interactive && onSelectKey(keyName)}
                onMouseEnter={() => interactive && setInternalHover(keyName)}
                onMouseLeave={() => interactive && setInternalHover(null)}
              >
                {/* Hit target for interactive mode */}
                {interactive && (
                  <circle cx={pinPos.x} cy={pinPos.y} r="16" fill="transparent" />
                )}

                {/* Outer Ring Pin */}
                <circle
                  cx={pinPos.x}
                  cy={pinPos.y}
                  r={pinR}
                  fill={pinColor}
                  stroke={pinStroke}
                  strokeWidth="2"
                  filter={isSelected || isHovered ? 'url(#glowEffect)' : 'none'}
                  className="transition-all duration-200"
                />

                {/* Position Number Label */}
                {showLabels && (
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4}
                    textAnchor="middle"
                    fontSize={isSelected ? '12' : isBefore ? '11' : '10'}
                    fontWeight={isSelected || isBefore ? '700' : '400'}
                    fontFamily="monospace"
                    fill={
                      isSelected
                        ? typeColor
                        : isHovered
                        ? '#ffffff'
                        : isBefore
                        ? '#a855f7'
                        : 'rgba(255,255,255,0.45)'
                    }
                    className="transition-colors duration-150"
                  >
                    {p}
                  </text>
                )}
              </g>
            );
          })}

          {/* Center Info Panel */}
          <g>
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fontSize="28"
              fontWeight="800"
              fill={typeColor}
              fontFamily="monospace"
              filter="url(#glowEffect)"
            >
              {currentDisplayKey}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="rgba(255,255,255,0.7)"
              fontFamily="sans-serif"
            >
              {typeName}
            </text>
            <text
              x={cx}
              y={cy + 24}
              textAnchor="middle"
              fontSize="9.5"
              fill="rgba(255,255,255,0.4)"
              fontFamily="monospace"
            >
              H: {currentDisplayData.hLead > 0 ? `+${currentDisplayData.hLead}` : currentDisplayData.hLead} | V: {currentDisplayData.vLead > 0 ? `+${currentDisplayData.vLead}` : currentDisplayData.vLead}
            </text>
          </g>
        </svg>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: typeColor }} />
          Selected: <strong className="font-mono text-text">{selectedKey}</strong>
        </span>
        {beforeKey && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            Previous: <strong className="font-mono text-text">{beforeKey}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
