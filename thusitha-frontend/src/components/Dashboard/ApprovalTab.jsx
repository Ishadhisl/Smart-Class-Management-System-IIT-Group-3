import { useState, useEffect, useCallback } from 'react';
import { request } from '../../services/api';
import PropTypes from 'prop-types';
import { FaClock, FaCheckCircle } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Table, THead, TBody, TRow, TH, TD } from '../common/Table';

const ApprovalTab = ({ pendingStudents, onApprove }) => {
  // Student IDs are assigned automatically: the backend hands out the next free ST-numbers
  // (max existing + 1, +2, ...) and each pending row gets one in list order.
  const [assignedIds, setAssignedIds] = useState({});
  const [loadingIds, setLoadingIds] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const { showNotification } = useNotification();

  const loadNextIds = useCallback(async () => {
    if (pendingStudents.length === 0) return;
    setLoadingIds(true);
    try {
      const data = await request(`/students/next-id?count=${pendingStudents.length}`);
      const ids = Array.isArray(data?.ids) ? data.ids : [];
      const map = {};
      pendingStudents.forEach((s, i) => { map[s.id] = ids[i] || ''; });
      setAssignedIds(map);
    } catch (err) {
      showNotification(err.message || 'ශිෂ්‍ය අංක ලබා ගැනීමට නොහැකි විය.', 'error');
    } finally {
      setLoadingIds(false);
    }
  }, [pendingStudents, showNotification]);

  useEffect(() => {
    const timer = setTimeout(loadNextIds, 0);
    return () => clearTimeout(timer);
  }, [loadNextIds]);

  const handleApproveClick = async (id) => {
    const qr = assignedIds[id];
    if (!qr) return showNotification('ශිෂ්‍ය අංකය තවම ලැබී නැත. 🔄 refresh කර නැවත උත්සාහ කරන්න.', 'error');
    setApprovingId(id);
    try {
      await onApprove(id, qr);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <Card padding="p-6" hover={false}>
      <h3 className="text-primary-dark font-bold text-lg mb-5 flex items-center gap-2">
        <FaClock size={18} /> ශිෂ්‍ය අනුමැතිය (Pending Approvals)
      </h3>
      <Table>
        <THead>
          <TRow>
            <TH>නම</TH>
            <TH>ශ්‍රේණිය/පාසල</TH>
            <TH>උනන්දු වන පන්තිය</TH>
            <TH>
              <span className="inline-flex items-center gap-2">
                ශිෂ්‍ය අංකය (ස්වයංක්‍රීය)
                <button type="button" onClick={loadNextIds} title="ඊළඟ අංක නැවත ගණනය කරන්න" className="text-primary hover:underline text-xs font-normal">🔄</button>
              </span>
            </TH>
            <TH>ක්‍රියාමාර්ග</TH>
          </TRow>
        </THead>
        <TBody>
          {pendingStudents.map(s => (
            <TRow key={s.id}>
              <TD>{s.name}<br /><small className="text-slate-400">{s.phone}</small></TD>
              <TD>{s.grade}<br /><small className="text-slate-400">{s.school}</small></TD>
              <TD><span className="px-2 py-1 bg-indigo-50 text-primary rounded text-xs font-semibold">{s.course_interest || 'General'}</span></TD>
              <TD>
                <label htmlFor={`qr-input-${s.id}`} className="sr-only">ශිෂ්‍ය අංකය for {s.name}</label>
                <Input
                  id={`qr-input-${s.id}`}
                  type="text"
                  readOnly
                  value={loadingIds ? 'ගණනය කරමින්...' : (assignedIds[s.id] || '—')}
                  className="!py-2 !w-40 font-mono font-bold text-primary bg-slate-50 cursor-default"
                />
              </TD>
              <TD>
                <Button variant="success" size="sm" icon={<FaCheckCircle size={14} />} loading={approvingId === s.id} disabled={loadingIds || approvingId === s.id} onClick={() => handleApproveClick(s.id)}>
                  අනුමත කරන්න
                </Button>
              </TD>
            </TRow>
          ))}
          {pendingStudents.length === 0 && (
            <TRow><TD className="text-center py-8 text-slate-400" colSpan="5">දැනට අනුමැතිය සඳහා සිසුන් නැත.</TD></TRow>
          )}
        </TBody>
      </Table>
    </Card>
  );
};

ApprovalTab.propTypes = {
  pendingStudents: PropTypes.array.isRequired,
  onApprove: PropTypes.func.isRequired
};

export default ApprovalTab;
