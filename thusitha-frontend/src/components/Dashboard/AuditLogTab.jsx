import PropTypes from 'prop-types';
import { ScrollText } from 'lucide-react';
import Card from '../common/Card';
import { Table, THead, TBody, TRow, TH, TD } from '../common/Table';

const ACTION_BADGE_CLASSES = {
  CREATE: 'bg-success-light/20 text-success-dark',
  UPDATE: 'bg-accent-light/20 text-accent-dark',
  DELETE: 'bg-danger-light/20 text-danger-dark',
};

const getActionBadgeClass = (actionType) =>
  ACTION_BADGE_CLASSES[actionType] || 'bg-slate-100 text-slate-600';

const AuditLogTab = ({ logs }) => {
  return (
    <Card padding="p-6" hover={false}>
      <h3 className="text-primary-dark font-bold text-lg mb-5 flex items-center gap-2">
        <ScrollText size={20} /> පද්ධති විගණන වාර්තා (Audit Logs)
      </h3>
      <Table>
        <THead>
          <TRow>
            <TH>දිනය සහ වේලාව</TH>
            <TH>ක්‍රියාව සිදු කළේ</TH>
            <TH>ක්‍රියාව</TH>
            <TH>විස්තරය</TH>
            <TH>අදාළ අයිතමය</TH>
          </TRow>
        </THead>
        <TBody>
          {logs.length === 0 && (
            <TRow><TD colSpan="5" className="text-center py-8 text-slate-400">වාර්තා කිසිවක් නොමැත.</TD></TRow>
          )}
          {logs.map((log) => (
            <TRow key={log.log_id}>
              <TD className="text-[13px]">{new Date(log.timestamp).toLocaleString()}</TD>
              <TD>
                <strong className="text-slate-700">{log.performed_by_username || 'Public'}</strong><br />
                <span className="text-xs text-slate-400">{log.user_role}</span>
              </TD>
              <TD>
                <span className={`px-2 py-1 rounded text-xs font-bold ${getActionBadgeClass(log.action_type)}`}>
                  {log.action_type}
                </span>
              </TD>
              <TD className="text-sm max-w-[300px]">{log.description}</TD>
              <TD className="text-sm">
                {log.entity_type} {log.entity_id ? `(ID: ${log.entity_id})` : ''}
              </TD>
            </TRow>
          ))}
        </TBody>
      </Table>
    </Card>
  );
};

AuditLogTab.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      log_id: PropTypes.number.isRequired,
      performed_by_username: PropTypes.string,
      user_role: PropTypes.string,
      action_type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
      entity_type: PropTypes.string.isRequired,
      entity_id: PropTypes.number,
    })
  ).isRequired,
};

export default AuditLogTab;
