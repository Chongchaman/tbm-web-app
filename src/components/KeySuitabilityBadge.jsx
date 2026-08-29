import React from 'react';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

export default function KeySuitabilityBadge({ suitability, showLabel = true, size = 'md' }) {
  const status = suitability || 'Fair';

  const config = {
    Yes: {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: CheckCircle2,
      label: 'Recommended (Yes)',
      short: 'Yes',
      desc: 'Ideal connection. Zero cross-joint interference.',
    },
    Fair: {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertCircle,
      label: 'Acceptable (Fair)',
      short: 'Fair',
      desc: 'Acceptable alignment with minor bolt offset.',
    },
    No: {
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      icon: XCircle,
      label: 'Restricted (No)',
      short: 'No',
      desc: 'Not recommended. Cross-joint overlap or bolt restriction.',
    },
  };

  const curr = config[status] || config.Fair;
  const Icon = curr.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${curr.bg} ${curr.border} ${curr.text} ${sizeClasses[size] || sizeClasses.md}`}
      title={curr.desc}
    >
      <Icon size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} className="shrink-0" />
      {showLabel ? curr.label : curr.short}
    </span>
  );
}
