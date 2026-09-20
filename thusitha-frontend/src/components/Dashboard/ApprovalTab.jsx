import { useState } from 'react';
import PropTypes from 'prop-types';
import { FaClock, FaCheckCircle } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Table, THead, TBody, TRow, TH, TD } from '../common/Table';

const ApprovalTab = ({ pendingStudents, onApprove }) => {
  const [qrInputs, setQrInputs] = useState({});
  const { showNotification } = useNotification();

  const handleApproveClick = (id) => {
    const qr = qrInputs[id];
    if (!qr) return showNotification('කරුණාකර QR ID එක ඇතුළත් කරන්න.', 'error');
    onApprove(id, qr);
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
            <TH>Interested Course</TH>
            <TH>QR ID එක ඇතුළත් කරන්න</TH>
            <TH>Action</TH>
          </TRow>
        </THead>
        <TBody>
          {pendingStudents.map(s => (
            <TRow key={s.id}>
              <TD>{s.name}<br /><small className="text-slate-400">{s.phone}</small></TD>
              <TD>{s.grade}<br /><small className="text-slate-400">{s.school}</small></TD>
              <TD><span className="px-2 py-1 bg-indigo-50 text-primary rounded text-xs font-semibold">{s.course_interest || 'General'}</span></TD>
              <TD>
                <label htmlFor={`qr-input-${s.id}`} className="sr-only">QR ID for {s.name}</label>
                <Input
                  id={`qr-input-${s.id}`}
                  type="text"
                  placeholder="Scan or Enter QR"
                  value={qrInputs[s.id] || ''}
                  onChange={(e) => setQrInputs({ ...qrInputs, [s.id]: e.target.value })}
                  className="!py-2 !w-48"
                />
              </TD>
              <TD>
                <Button variant="success" size="sm" icon={<FaCheckCircle size={14} />} onClick={() => handleApproveClick(s.id)}>
                  Approve
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
