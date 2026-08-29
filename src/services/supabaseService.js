import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

/**
 * Convert frontend JS ring log object to Supabase database row format
 */
export function formatRingToDbRow(ring) {
  const ringNumInt = typeof ring.ringNumber === 'number' 
    ? ring.ringNumber 
    : parseInt(String(ring.ringNumber || ring.ringNum || ring.step || '0').replace(/\D/g, ''), 10) || 1;

  return {
    ring_number: ringNumInt,
    ring_num_str: ring.ringNum || ring.ringNumFormatted || `R${String(ringNumInt).padStart(4, '0')}`,
    sta: ring.sta || ring.chainage || '00+000.000',
    dist: Number(ring.dist || ring.distance || 0),
    section_code: ring.sectionCode || '',
    key_position: ring.key || ring.selectedKey || 'U4',
    prev_key: ring.prevKey || '',
    segment_type: ring.type || ring.segmentType || 'U',
    segment_size: Number(ring.size || ring.segmentSize || 1200),
    h_lead: Number(ring.hLead || ring.segHLead || 0),
    v_plumb: Number(ring.vLead || ring.vPlumb || ring.segVLead || 0),
    lead_req: Number(ring.leadReq || 0),
    after_h: Number(ring.afterH || ring.hLead || 0),
    after_v: Number(ring.afterV || ring.vLead || ring.vPlumb || 0),
    deviation_mm: Number(ring.deviationMm || 0),
    suitability: ring.suitability || 'Yes',
    gap_top: Number(ring.gapT || ring.gapTop || 90),
    gap_bottom: Number(ring.gapB || ring.gapBottom || 90),
    gap_left: Number(ring.gapL || ring.gapLeft || 90),
    gap_right: Number(ring.gapR || ring.gapRight || 90),
    roll: Number(ring.roll || 0),
    pitch: Number(ring.pitch || 0),
    yaw: Number(ring.yaw || 0),
    thrust_force: Number(ring.thrustForce || 0),
    torque: Number(ring.torque || 0),
    operator_name: ring.operator || 'Chief Engineer',
    notes: ring.notes || '',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert Supabase database row to frontend JS ring log object
 */
export function formatDbRowToRing(row) {
  return {
    id: row.id,
    ringNumber: row.ring_number,
    ringNum: row.ring_num_str || `R${String(row.ring_number).padStart(4, '0')}`,
    step: row.ring_number,
    sta: row.sta,
    dist: Number(row.dist || 0),
    sectionCode: row.section_code,
    key: row.key_position,
    selectedKey: row.key_position,
    prevKey: row.prev_key,
    type: row.segment_type,
    segmentType: row.segment_type,
    size: Number(row.segment_size || 1200),
    sizeM: (Number(row.segment_size || 1200) / 1000).toFixed(1),
    hLead: Number(row.h_lead || 0),
    vLead: Number(row.v_plumb || 0),
    vPlumb: Number(row.v_plumb || 0),
    leadReq: Number(row.lead_req || 0),
    afterH: Number(row.after_h || row.h_lead || 0),
    afterV: Number(row.after_v || row.v_plumb || 0),
    deviationMm: Number(row.deviation_mm || 0),
    suitability: row.suitability || 'Yes',
    gapT: Number(row.gap_top || 90),
    gapB: Number(row.gap_bottom || 90),
    gapL: Number(row.gap_left || 90),
    gapR: Number(row.gap_right || 90),
    roll: Number(row.roll || 0),
    pitch: Number(row.pitch || 0),
    yaw: Number(row.yaw || 0),
    thrustForce: Number(row.thrust_force || 0),
    torque: Number(row.torque || 0),
    operator: row.operator_name || 'Chief Engineer',
    notes: row.notes || '',
    timestamp: row.created_at,
  };
}

/**
 * Fetch all ring logs from Supabase Cloud
 */
export async function fetchRingLogsFromCloud() {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase not configured' };

  try {
    const { data, error } = await client
      .from('ring_logs')
      .select('*')
      .order('ring_number', { ascending: true });

    if (error) throw error;
    return { data: (data || []).map(formatDbRowToRing), error: null };
  } catch (e) {
    console.error('Failed to fetch ring logs from Supabase:', e);
    return { data: null, error: e.message };
  }
}

/**
 * Save / Upsert a single ring log to Supabase Cloud
 */
export async function saveRingLogToCloud(ring) {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase not configured' };

  try {
    const row = formatRingToDbRow(ring);
    const { data, error } = await client
      .from('ring_logs')
      .upsert(row, { onConflict: 'ring_number' })
      .select();

    if (error) throw error;
    return { data: data?.[0] ? formatDbRowToRing(data[0]) : null, error: null };
  } catch (e) {
    console.error('Failed to save ring log to Supabase:', e);
    return { data: null, error: e.message };
  }
}

/**
 * Batch insert / upsert multiple ring logs to Supabase Cloud
 */
export async function batchSaveRingLogsToCloud(rings) {
  const client = getSupabaseClient();
  if (!client) return { data: null, error: 'Supabase not configured' };

  try {
    const rows = rings.map(formatRingToDbRow);
    const { data, error } = await client
      .from('ring_logs')
      .upsert(rows, { onConflict: 'ring_number' })
      .select();

    if (error) throw error;
    return { data: (data || []).map(formatDbRowToRing), error: null };
  } catch (e) {
    console.error('Failed to batch save ring logs to Supabase:', e);
    return { data: null, error: e.message };
  }
}

/**
 * Delete a single ring log by ring_number
 */
export async function deleteRingLogFromCloud(ringNumber) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase not configured' };

  try {
    const { error } = await client
      .from('ring_logs')
      .delete()
      .eq('ring_number', Number(ringNumber));

    if (error) throw error;
    return { success: true, error: null };
  } catch (e) {
    console.error('Failed to delete ring log from Supabase:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Batch delete ring logs by ring numbers
 */
export async function batchDeleteRingLogsFromCloud(ringNumbers) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase not configured' };

  try {
    const nums = ringNumbers.map(Number);
    const { error } = await client
      .from('ring_logs')
      .delete()
      .in('ring_number', nums);

    if (error) throw error;
    return { success: true, error: null };
  } catch (e) {
    console.error('Failed to batch delete ring logs from Supabase:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Delete ALL ring logs from Supabase (Protected by PIN in UI)
 */
export async function deleteAllRingLogsFromCloud() {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase not configured' };

  try {
    const { error } = await client
      .from('ring_logs')
      .delete()
      .neq('ring_number', -999999);

    if (error) throw error;
    return { success: true, error: null };
  } catch (e) {
    console.error('Failed to clear ring logs from Supabase:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Fetch Horizontal and Vertical Alignment profiles from Supabase
 */
export async function fetchAlignmentFromCloud() {
  const client = getSupabaseClient();
  if (!client) return { horizontal: null, vertical: null, error: 'Supabase not configured' };

  try {
    const [hRes, vRes] = await Promise.all([
      client.from('horizontal_alignment').select('*').order('sequence_order', { ascending: true }),
      client.from('vertical_alignment').select('*').order('sequence_order', { ascending: true }),
    ]);

    let horizontal = null;
    if (hRes.data && hRes.data.length > 0) {
      horizontal = hRes.data.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        sectionType: r.section_type,
        direction: r.direction,
        startSTA: r.start_sta,
        endSTA: r.end_sta,
        radius: Number(r.radius || 180),
        ratio: r.ratio || { un: 1, rt: 1, lt: 1 },
        allowedTypes: r.allowed_types || ['U', 'R', 'L'],
      }));
    }

    let vertical = null;
    if (vRes.data && vRes.data.length > 0) {
      vertical = vRes.data.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        startSTA: r.start_sta,
        endSTA: r.end_sta,
        startElev: Number(r.start_elev || 0),
        endElev: Number(r.end_elev || 0),
        gradePct: Number(r.grade_pct || 0),
        curveType: r.curve_type || 'constant_grade',
        radiusV: Number(r.radius_v || 0),
        lengthV: Number(r.length_v || 0),
      }));
    }

    return { horizontal, vertical, error: null };
  } catch (e) {
    console.error('Failed to fetch alignment from Supabase:', e);
    return { horizontal: null, vertical: null, error: e.message };
  }
}

/**
 * Save Alignment profiles to Supabase
 */
export async function saveAlignmentToCloud(horizontalSections, verticalElements) {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase not configured' };

  try {
    if (horizontalSections && horizontalSections.length > 0) {
      const hRows = horizontalSections.map((sec, idx) => ({
        id: sec.id || `sec-${idx + 1}`,
        code: sec.code,
        name: sec.name,
        section_type: sec.sectionType,
        direction: sec.direction,
        start_sta: sec.startSTA,
        end_sta: sec.endSTA,
        radius: Number(sec.radius || 180),
        ratio: sec.ratio || { un: 1, rt: 1, lt: 1 },
        allowed_types: sec.allowedTypes || ['U', 'R', 'L'],
        sequence_order: idx + 1,
        updated_at: new Date().toISOString(),
      }));

      await client.from('horizontal_alignment').upsert(hRows, { onConflict: 'id' });
    }

    if (verticalElements && verticalElements.length > 0) {
      const vRows = verticalElements.map((elem, idx) => ({
        id: elem.id || `vpi-${idx + 1}`,
        code: elem.code,
        name: elem.name,
        start_sta: elem.startSTA,
        end_sta: elem.endSTA,
        start_elev: Number(elem.startElev || 0),
        end_elev: Number(elem.endElev || 0),
        grade_pct: Number(elem.gradePct || 0),
        curve_type: elem.curveType || 'constant_grade',
        radius_v: Number(elem.radiusV || 0),
        length_v: Number(elem.lengthV || 0),
        sequence_order: idx + 1,
        updated_at: new Date().toISOString(),
      }));

      await client.from('vertical_alignment').upsert(vRows, { onConflict: 'id' });
    }

    return { success: true, error: null };
  } catch (e) {
    console.error('Failed to save alignment to Supabase:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Subscribe to Real-time Ring Log changes (Live updates across all devices!)
 */
export function subscribeToRealtimeRings(onInsert, onUpdate, onDelete) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('realtime_ring_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ring_logs' },
        (payload) => {
          if (onInsert && payload.new) onInsert(formatDbRowToRing(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ring_logs' },
        (payload) => {
          if (onUpdate && payload.new) onUpdate(formatDbRowToRing(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ring_logs' },
        (payload) => {
          if (onDelete && payload.old) onDelete(payload.old.ring_number);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (e) {
    console.error('Failed to subscribe to realtime changes:', e);
    return null;
  }
}
