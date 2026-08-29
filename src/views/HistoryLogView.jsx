import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  Filter,
  FileSpreadsheet,
  Check,
  X,
  AlertCircle,
  Lock,
  ShieldAlert,
  CheckSquare,
  Square,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { KEY_DATA, INITIAL_RING_LOGS } from '../data/tbmConstants';

export default function HistoryLogView({
  ringLogs = [],
  onUpdateRing = () => {},
  onDeleteRing = () => {},
  onAddRing = () => {},
  onBatchDelete = null, // Will support custom multi-delete
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);

  // Multi-Selection State
  const [selectedRingNums, setSelectedRingNums] = useState(new Set());

  // Protected Batch Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState('selected'); // 'selected' | 'range' | 'all'
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  const [newRingForm, setNewRingForm] = useState({
    ringNum: '',
    key: 'L2',
    hLead: 0,
    vLead: 0,
    gapT: 90,
    gapB: 90,
    gapL: 90,
    gapR: 90,
    roll: 0,
    notes: '',
  });

  // Filtered Rings
  const filteredLogs = useMemo(() => {
    return ringLogs.filter((r) => {
      const matchSearch =
        (r.ringNum || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.key || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const type = r.key ? r.key.charAt(0) : '';
      const matchType = filterType === 'ALL' || type === filterType;

      return matchSearch && matchType;
    });
  }, [ringLogs, searchTerm, filterType]);

  // Toggle selection
  const toggleSelectRing = (ringNum) => {
    setSelectedRingNums((prev) => {
      const next = new Set(prev);
      if (next.has(ringNum)) {
        next.delete(ringNum);
      } else {
        next.add(ringNum);
      }
      return next;
    });
  };

  // Toggle Select All
  const toggleSelectAll = () => {
    if (selectedRingNums.size === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedRingNums(new Set());
    } else {
      setSelectedRingNums(new Set(filteredLogs.map((r) => r.ringNum)));
    }
  };

  // Open Protected Delete Modal
  const handleOpenDeleteModal = (mode = 'selected') => {
    setDeleteMode(mode);
    setPinInput('');
    setPinError('');
    if (ringLogs.length > 0) {
      setRangeStart(ringLogs[0]?.ringNum || '');
      setRangeEnd(ringLogs[ringLogs.length - 1]?.ringNum || '');
    }
    setShowDeleteModal(true);
  };

  // Execute Protected Delete
  const handleConfirmBatchDelete = () => {
    // Check PIN (default required PIN: 1234)
    if (pinInput.trim() !== '1234') {
      setPinError('รหัสผ่าน PIN ไม่ถูกต้อง (กรุณากรอกรหัส: 1234)');
      return;
    }

    let remaining = [...ringLogs];
    let deletedCount = 0;

    if (deleteMode === 'all') {
      deletedCount = remaining.length;
      remaining = [];
    } else if (deleteMode === 'selected') {
      deletedCount = selectedRingNums.size;
      remaining = remaining.filter((r) => !selectedRingNums.has(r.ringNum));
    } else if (deleteMode === 'range') {
      const startNum = parseInt(String(rangeStart).replace(/\D/g, '') || '0', 10);
      const endNum = parseInt(String(rangeEnd).replace(/\D/g, '') || '99999', 10);
      const minNum = Math.min(startNum, endNum);
      const maxNum = Math.max(startNum, endNum);

      const beforeLen = remaining.length;
      remaining = remaining.filter((r) => {
        const num = parseInt(String(r.ringNum).replace(/\D/g, '') || '0', 10);
        return num < minNum || num > maxNum;
      });
      deletedCount = beforeLen - remaining.length;
    }

    // Save remaining back to localStorage and trigger state update
    localStorage.setItem('tbm_ring_logs', JSON.stringify(remaining));
    window.location.reload(); // Quick refresh to sync all components
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Ring No.', 'Key', 'H Lead (mm)', 'V Lead (mm)', 'Gap T (mm)', 'Gap B (mm)', 'Gap L (mm)', 'Gap R (mm)', 'Roll (deg)', 'Timestamp', 'Notes'];
    const rows = ringLogs.map(r => [
      r.ringNum,
      r.key,
      r.hLead,
      r.vLead,
      r.gapT,
      r.gapB,
      r.gapL,
      r.gapR,
      r.roll || 0,
      r.timestamp || '',
      r.notes || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tbm_ring_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset to initial 15 rings
  const handleResetToDefault = () => {
    const pin = window.prompt('กรุณากรอกรหัส PIN (1234) เพื่อรีเซ็ตกลับเป็น 15 ริงเริ่มต้น:');
    if (pin === '1234') {
      localStorage.setItem('tbm_ring_logs', JSON.stringify(INITIAL_RING_LOGS));
      window.location.reload();
    } else if (pin !== null) {
      alert('รหัส PIN ไม่ถูกต้อง');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-acc/15 text-acc border border-acc/30">
              HISTORICAL LOGS & AS-BUILT
            </span>
            <span className="text-xs text-text-muted">Total: {ringLogs.length} Rings Recorded</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">TBM Ring History & Data Logs</h2>
          <p className="text-sm text-text-muted mt-1">
            จัดการและตรวจสอบประวัติการวางเซกเมนต์จริง พร้อมระบบลบข้อมูลหลายรายการด้วยรหัส PIN (1234)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Protected Batch Delete Button */}
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(selectedRingNums.size > 0 ? 'selected' : 'all')}
            className="btn btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-rose-500/40 text-rose-300 hover:bg-rose-500/15"
          >
            <Trash2 size={15} />
            <span>ลบข้อมูลหลายรายการ (PIN 1234)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn btn-outline py-2 px-3 text-xs font-semibold flex items-center gap-1.5 hover:border-acc"
          >
            <Download size={15} /> Export CSV
          </button>

          <button
            onClick={handleResetToDefault}
            className="btn btn-outline py-2 px-3 text-xs text-text-muted hover:text-white flex items-center gap-1.5"
            title="รีเซ็ตกลับเป็น R0001-R0015"
          >
            <RotateCcw size={14} /> รีเซ็ตค่าเริ่มต้น
          </button>
        </div>
      </div>

      {/* Selected Items Floating Action Bar */}
      {selectedRingNums.size > 0 && (
        <div className="flex items-center justify-between bg-purple-500/20 border border-purple-500/40 text-purple-200 px-5 py-3 rounded-xl text-xs font-mono animate-fadeIn shadow-lg">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-purple-300" />
            <span>เลือกอยู่: <strong>{selectedRingNums.size} ริง</strong> จากทั้งหมด {ringLogs.length} ริง</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenDeleteModal('selected')}
              className="btn bg-rose-500 hover:bg-rose-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5"
            >
              <Trash2 size={14} /> ลบ {selectedRingNums.size} ริงที่เลือก (ใส่รหัส 1234)
            </button>
            <button
              onClick={() => setSelectedRingNums(new Set())}
              className="btn btn-outline py-1.5 px-2.5 rounded-lg text-xs text-text-muted hover:text-white"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters Strip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surf-2 border border-white/10 rounded-2xl p-4 shadow-md font-mono text-xs">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="ค้นหา Ring No, Key, Notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surf-3 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-text outline-none focus:border-acc"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-text-muted font-sans font-semibold">Filter Type:</span>
          {['ALL', 'R', 'L', 'U'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterType === t
                  ? 'bg-acc text-black shadow-md shadow-cyan-400/20'
                  : 'bg-surf-3 text-text-muted hover:text-white'
              }`}
            >
              {t === 'ALL' ? 'ทั้งหมด (All)' : t === 'R' ? 'Right (R)' : t === 'L' ? 'Left (L)' : 'Univ (U)'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Ring Log Table */}
      <div className="card space-y-4 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-white/10 text-text-muted bg-surf-3/80">
                <th className="p-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 hover:text-white text-text-muted"
                    title="Select / Deselect All"
                  >
                    {selectedRingNums.size === filteredLogs.length && filteredLogs.length > 0 ? (
                      <CheckSquare size={16} className="text-acc" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="p-3">Ring No.</th>
                <th className="p-3">Key & Type</th>
                <th className="p-3">H Lead (mm)</th>
                <th className="p-3">V Lead (mm)</th>
                <th className="p-3">Tail Gap (T / B / L / R)</th>
                <th className="p-3">Roll (deg)</th>
                <th className="p-3">Notes / Mode</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.map((r, idx) => {
                const isSelected = selectedRingNums.has(r.ringNum);
                const type = r.key ? r.key.charAt(0) : '';

                return (
                  <tr
                    key={r.ringNum || idx}
                    className={`hover:bg-white/5 transition-colors ${
                      isSelected ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectRing(r.ringNum)}
                        className="p-1 text-text-muted hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-purple-400" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="p-3 font-bold text-acc">{r.ringNum}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded font-black text-sm ${
                        type === 'R' ? 'bg-rose-500/20 text-rose-400' : type === 'L' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {r.key}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-text">{r.hLead > 0 ? `+${r.hLead}` : r.hLead} mm</td>
                    <td className="p-3 font-bold text-text">{r.vLead > 0 ? `+${r.vLead}` : r.vLead} mm</td>
                    <td className="p-3 text-text-muted">
                      {r.gapT} / {r.gapB} / {r.gapL} / {r.gapR}
                    </td>
                    <td className="p-3 text-text-muted">{r.roll || 0}&deg;</td>
                    <td className="p-3 text-text-muted truncate max-w-[200px]">{r.notes || '-'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteRing(idx)}
                        className="p-1.5 rounded hover:bg-rose-500/20 text-text-muted hover:text-rose-400 transition-colors"
                        title="Delete Single Ring"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protected Batch Delete Modal Dialog */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surf border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <ShieldAlert size={20} />
                <h3 className="text-base font-bold">ยืนยันการลบข้อมูล (ใส่รหัส PIN: 1234)</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-text-muted hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Choose Delete Mode */}
            <div className="space-y-2.5 font-sans text-xs">
              <label className="font-bold text-text-muted uppercase text-[11px] block">เลือกรูปแบบการลบ:</label>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                deleteMode === 'selected'
                  ? 'bg-purple-500/15 border-purple-400 text-text'
                  : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="delMode"
                  checked={deleteMode === 'selected'}
                  onChange={() => setDeleteMode('selected')}
                  className="accent-purple-400"
                />
                <div>
                  <span className="font-bold block">1. ลบเฉพาะรายการที่ติ๊กเลือก ({selectedRingNums.size} ริง)</span>
                  <span className="text-[11px] text-text-muted">ลบเฉพาะแถวที่มีเครื่องหมายถูกในตาราง</span>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                deleteMode === 'range'
                  ? 'bg-purple-500/15 border-purple-400 text-text'
                  : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="delMode"
                  checked={deleteMode === 'range'}
                  onChange={() => setDeleteMode('range')}
                  className="accent-purple-400"
                />
                <div className="flex-1">
                  <span className="font-bold block">2. ลบเฉพาะช่วงหมายเลขริง (Range Delete)</span>
                  {deleteMode === 'range' && (
                    <div className="flex items-center gap-2 mt-2 font-mono">
                      <input
                        type="text"
                        placeholder="R0016"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-24 bg-surf-2 border border-white/15 px-2 py-1 rounded text-text font-bold"
                      />
                      <span>ถึง</span>
                      <input
                        type="text"
                        placeholder="R0160"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-24 bg-surf-2 border border-white/15 px-2 py-1 rounded text-text font-bold"
                      />
                    </div>
                  )}
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                deleteMode === 'all'
                  ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="delMode"
                  checked={deleteMode === 'all'}
                  onChange={() => setDeleteMode('all')}
                  className="accent-rose-400"
                />
                <div>
                  <span className="font-bold block text-rose-300">3. ลบข้อมูลริงทั้งหมด (Clear All Logs - {ringLogs.length} ริง)</span>
                  <span className="text-[11px] text-text-muted">ลบประวัติทั้งหมดออกจากฐานข้อมูล</span>
                </div>
              </label>
            </div>

            {/* PIN Code Input Box */}
            <div className="bg-surf-3/80 p-3.5 rounded-xl border border-white/10 space-y-2 font-mono">
              <label className="text-xs font-bold text-text flex items-center gap-1.5">
                <Lock size={14} className="text-amber-400" />
                <span>กรุณากรอกรหัส PIN ยืนยัน (รหัสคือ: 1234):</span>
              </label>
              <input
                type="password"
                maxLength="8"
                placeholder="ใส่รหัส 1234"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                className="w-full bg-surf-2 border border-white/20 rounded-xl px-4 py-2.5 text-center text-lg font-bold tracking-widest text-acc outline-none focus:border-acc"
                autoFocus
              />
              {pinError && (
                <span className="text-xs text-rose-400 font-sans block">{pinError}</span>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-outline py-2 px-4 text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="btn bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-5 text-xs shadow-lg shadow-rose-900/40"
              >
                ยืนยันการลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
