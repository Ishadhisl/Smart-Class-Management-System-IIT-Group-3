const db = require('../db');
const auditService = require('../utils/auditService');

// Get all camera zones for a specific hall
exports.getZonesByHall = async (req, res) => {
  const { hallId } = req.params;
  try {
    const result = await db.pool.query(
      'SELECT zone_id, hall_id, zone_name, camera_url, position FROM Camera_Zones WHERE hall_id = $1 ORDER BY position ASC',
      [hallId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Get Zones by Hall Error:', err.message);
    res.status(500).json({ error: 'කැමරා කලාප ලබා ගැනීමට නොහැකි විය.' });
  }
};

// Create a new camera zone
exports.createZone = async (req, res) => {
  const { hall_id, zone_name, camera_url, position, calibration_factor } = req.body;
  if (!hall_id || !zone_name || !camera_url || position === undefined) {
    return res.status(400).json({ message: 'සියලුම ක්ෂේත්‍ර සම්පූර්ණ කරන්න.' });
  }
  try {
    const result = await db.pool.query(
      'INSERT INTO Camera_Zones (hall_id, zone_name, camera_url, position, calibration_factor) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [hall_id, zone_name, camera_url, position, calibration_factor || 1]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'CREATE', 'Camera_Zone', result.rows[0].zone_id, `Created camera zone: ${zone_name} for hall ${hall_id}`);
    res.status(201).json({ message: 'කැමරා කලාපය සාර්ථකව එකතු කරන ලදී.', zone: result.rows[0] });
  } catch (err) {
    console.error('❌ Create Zone Error:', err.message);
    res.status(500).json({ error: 'කැමරා කලාපය එකතු කිරීම අසාර්ථකයි.' });
  }
};

// Update a camera zone
exports.updateZone = async (req, res) => {
  const { zoneId } = req.params;
  const { zone_name, camera_url, position } = req.body;
  if (!zone_name || !camera_url || position === undefined) {
    return res.status(400).json({ message: 'සියලුම ක්ෂේත්‍ර සම්පූර්ණ කරන්න.' });
  }
  try {
    const result = await db.pool.query(
      'UPDATE Camera_Zones SET zone_name = $1, camera_url = $2, position = $3 WHERE zone_id = $4 RETURNING *',
      [zone_name, camera_url, position, zoneId]
    );
    await auditService.logAction(req.user.userId, req.user.role, 'UPDATE', 'Camera_Zone', zoneId, `Updated camera zone: ${zone_name}`);
    res.json({ message: 'කැමරා කලාපය සාර්ථකව යාවත්කාලීන කරන ලදී.', zone: result.rows[0] });
  } catch (err) {
    console.error('❌ Update Zone Error:', err.message);
    res.status(500).json({ error: 'කැමරා කලාපය යාවත්කාලීන කිරීම අසාර්ථකයි.' });
  }
};

// Delete a camera zone
exports.deleteZone = async (req, res) => {
  const { zoneId } = req.params;
  try {
    await db.pool.query('DELETE FROM Camera_Zones WHERE zone_id = $1', [zoneId]);
    await auditService.logAction(req.user.userId, req.user.role, 'DELETE', 'Camera_Zone', zoneId, `Deleted camera zone ID: ${zoneId}`);
    res.json({ message: 'කැමරා කලාපය සාර්ථකව ඉවත් කරන ලදී.' });
  } catch (err) {
    console.error('❌ Delete Zone Error:', err.message);
    res.status(500).json({ error: 'කැමරා කලාපය ඉවත් කිරීම අසාර්ථකයි.' });
  }
};