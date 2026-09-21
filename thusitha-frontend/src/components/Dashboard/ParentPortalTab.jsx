import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { request, BASE_URL, getImageUrl } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { generateReceiptPDF } from '../../utils/generateReceiptPDF';
import { Download, Calendar, FileText, Wallet, QrCode, Upload, Eye, User } from 'lucide-react';

const badgeClasses = (status) => {
  if (status === 'Pending' || status === 'Absent') {
    return 'bg-rose-50 text-rose-700';
  }
  if (status === 'Pending Verification' || status === 'Late') {
    return 'bg-amber-50 text-amber-700';
  }
  return 'bg-emerald-50 text-emerald-700';
};

const SUB_TABS = [
  { key: 'attendance', label: 'පැමිණීමේ වාර්තා', icon: Calendar },
  { key: 'exams', label: 'විභාග සහ ලකුණු', icon: FileText },
  { key: 'payments', label: 'ගෙවීම් විස්තර', icon: Wallet },
];

const ParentPortalTab = ({ myChildren, onRefresh }) => {
  const { showNotification } = useNotification();
  const [selectedChildId, setSelectedChildId] = useState(
    myChildren && myChildren.length > 0 ? myChildren[0].student_id : ''
  );
  const [activeSubTab, setActiveSubTab] = useState('attendance');
  const [uploadingPaymentId, setUploadingPaymentId] = useState(null);

  if (!myChildren || myChildren.length === 0) {
    return (
      <div className="bg-white p-10 rounded-2xl text-center shadow-glass border border-white/50">
        <h3 className="text-primary-dark m-0 mb-2 text-lg font-bold">දරුවන්ගේ දත්ත නොමැත</h3>
        <p className="text-slate-500 m-0">මෙම මව්පිය ගිණුමට සම්බන්ධ ශිෂ්‍ය ගිණුම් කිසිවක් පද්ධතියේ හමු නොවීය.</p>
      </div>
    );
  }

  const activeChild = myChildren.find(c => c.student_id === Number(selectedChildId)) || myChildren[0];

  const handleReceiptUpload = async (e, paymentId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPaymentId(paymentId);
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      await request(`/payments/${paymentId}/upload-confirmation`, {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      showNotification('ගෙවීම් පත්‍රිකාව සාර්ථකව උඩුගත කරන ලදී! පද්ධති සත්‍යාපනයෙන් පසු තහවුරු වනු ඇත.', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      showNotification(err.message || 'ගෙවීම් පත්‍රිකාව උඩුගත කිරීම අසාර්ථක විය.', 'error');
    } finally {
      setUploadingPaymentId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Children Selector Row */}
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
        {myChildren.map((child) => {
          const isActive = selectedChildId === child.student_id;
          return (
            <button
              key={child.student_id}
              type="button"
              onClick={() => setSelectedChildId(child.student_id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[210px] text-left transition-all shadow-glass shrink-0
                ${isActive
                  ? 'bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white'
                  : 'bg-white text-slate-700 border border-slate-100 hover:border-primary/30 hover:-translate-y-0.5'}`}
            >
              {child.profile_photo_path ? (
                <img
                  src={getImageUrl(child.profile_photo_path)}
                  alt={child.student_name}
                  className={`w-10 h-10 rounded-full object-cover shrink-0 ${isActive ? 'ring-2 ring-white/70' : 'ring-2 ring-primary-light/30'}`}
                />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${isActive ? 'bg-white/20' : 'bg-indigo-50 text-primary-dark'}`}>
                  {child.student_name?.charAt(0)?.toUpperCase() || <User size={20} />}
                </div>
              )}
              <div className="min-w-0">
                <div className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{child.student_name}</div>
                <div className={`text-xs truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{child.grade}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-6 flex-wrap items-start">

        {/* Child Info & QR Code Card */}
        <motion.div
          key={activeChild.student_id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex-1 min-w-[300px] bg-white rounded-2xl shadow-glass border border-white/50 overflow-hidden h-fit"
        >
          <div className="bg-gradient-to-br from-primary-dark via-primary to-primary-light px-6 pt-8 pb-16 text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
            {activeChild.profile_photo_path ? (
              <img
                src={getImageUrl(activeChild.profile_photo_path)}
                alt={activeChild.student_name}
                className="w-24 h-24 rounded-full object-cover mx-auto shadow-lg ring-4 ring-white/80 relative z-10"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl mx-auto shadow-lg ring-4 ring-white/50 relative z-10">
                
              </div>
            )}
          </div>

          <div className="px-6 -mt-10 pb-6 relative z-10">
            <div className="bg-white rounded-xl shadow-md px-4 py-3 text-center mb-5">
              <h4 className="m-0 mb-1 text-lg font-bold text-primary-dark">{activeChild.student_name}</h4>
              <p className="m-0 text-slate-500 text-xs">{activeChild.school} · {activeChild.grade}</p>
            </div>

            <div className="bg-indigo-50/60 rounded-xl p-4 text-center border border-indigo-100">
              <span className="text-xs text-slate-500 flex items-center justify-center gap-1.5 mb-2 font-semibold">
                <QrCode size={14} /> පැමිණීමේ QR කේතය (QR Key)
              </span>
              <div className="text-base font-bold text-primary-dark py-2 border border-dashed border-primary/40 rounded-lg bg-white tracking-wider">
                {activeChild.qr_code_key}
              </div>
              <small className="text-slate-400 block mt-2">ආයතනයට ඇතුළු වීමේදී මෙම කේතය ස්කෑන් කරන්න.</small>
            </div>
          </div>
        </motion.div>

        {/* Details Panels (Attendance, Exams, Payments) */}
        <div className="flex-[2] min-w-[420px] bg-white rounded-2xl shadow-glass border border-white/50 p-6">

          {/* Sub Navigation */}
          <div className="flex border-b border-slate-100 gap-2 mb-5 overflow-x-auto">
            {SUB_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSubTab(key)}
                className={`flex items-center gap-2 px-4 py-3 border-0 bg-transparent font-bold text-sm cursor-pointer whitespace-nowrap border-b-[3px] transition-colors
                  ${activeSubTab === key ? 'border-primary text-primary-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSubTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* SUB TAB: Attendance */}
              {activeSubTab === 'attendance' && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-left bg-slate-50">
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">දිනය සහ වේලාව</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">පන්තිය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">කලාපය (Zone)</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">තත්ත්වය</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!activeChild.attendance || activeChild.attendance.length === 0 ? (
                        <tr><td colSpan="4" className="text-center p-6 text-slate-400">පැමිණීමේ සටහන් කිසිවක් හමු නොවීය.</td></tr>
                      ) : (
                        activeChild.attendance.map((log) => (
                          <tr key={log.log_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="p-3">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3">{log.course_name || 'සාමාන්‍ය පැමිණීම'}</td>
                            <td className="p-3">{log.zone || 'Lobby / Gate'}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${badgeClasses(log.verification_status)}`}>
                                {log.verification_status === 'Verified' ? 'පැමිණ ඇත' : log.verification_status === 'Late' ? 'ප්‍රමාදයි' : log.verification_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUB TAB: Exam Results */}
              {activeSubTab === 'exams' && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-left bg-slate-50">
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">විභාගය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">දිනය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">ලකුණු</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">සමත්/අසමත්</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!activeChild.results || activeChild.results.length === 0 ? (
                        <tr><td colSpan="4" className="text-center p-6 text-slate-400">ප්‍රතිඵල සටහන් කිසිවක් හමු නොවීය.</td></tr>
                      ) : (
                        activeChild.results.map((res, idx) => {
                          const percentage = (res.marks / res.total_marks) * 100;
                          const isPass = percentage >= res.pass_percentage;
                          return (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                              <td className="p-3">{res.exam_name}</td>
                              <td className="p-3">{new Date(res.exam_date).toLocaleDateString()}</td>
                              <td className="p-3 text-center font-bold">{res.marks} / {res.total_marks}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${badgeClasses(isPass ? 'Verified' : 'Pending')}`}>
                                  {isPass ? 'සමත්' : 'අසමත්'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUB TAB: Payments */}
              {activeSubTab === 'payments' && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-100 text-left bg-slate-50">
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">මාසය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">පන්තිය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">මුදල</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">තත්ත්වය</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-center">ස්ලිප් එක (Receipt)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!activeChild.payments || activeChild.payments.length === 0 ? (
                        <tr><td colSpan="5" className="text-center p-6 text-slate-400">ගෙවීම් සටහන් කිසිවක් හමු නොවීය.</td></tr>
                      ) : (
                        activeChild.payments.map((pay) => (
                          <tr key={pay.payment_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="p-3 font-medium">{pay.for_month}</td>
                            <td className="p-3">{pay.course_name}</td>
                            <td className="p-3">රු. {Number(pay.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${badgeClasses(pay.payment_status)}`}>
                                {pay.payment_status === 'Completed' || pay.payment_status === 'Paid' ? 'ගෙවා ඇත' : pay.payment_status === 'Pending Verification' ? 'සත්‍යාපනය වෙමින්' : 'ගෙවා නැත'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2 justify-center flex-wrap items-center">
                                {(pay.payment_status === 'Completed' || pay.payment_status === 'Paid') && (
                                  <button
                                    type="button"
                                    onClick={() => generateReceiptPDF({ ...pay, amount_paid: pay.amount })}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <Download size={12} /> PDF
                                  </button>
                                )}
                                {pay.payment_slip_path || pay.confirmation_url ? (
                                  <a
                                    href={`${BASE_URL}${pay.payment_slip_path || pay.confirmation_url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-primary-dark font-bold text-xs hover:underline"
                                  >
                                    <Eye size={12} /> බලන්න
                                  </a>
                                ) : pay.payment_status !== 'Completed' && pay.payment_status !== 'Paid' ? (
                                  <div>
                                    <input
                                      type="file"
                                      id={`slip-${pay.payment_id}`}
                                      accept="image/*, .pdf"
                                      className="hidden"
                                      onChange={(e) => handleReceiptUpload(e, pay.payment_id)}
                                    />
                                    <label
                                      htmlFor={`slip-${pay.payment_id}`}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                                    >
                                      <Upload size={12} /> {uploadingPaymentId === pay.payment_id ? 'පූරණය වෙමින්...' : 'Slip එක දාන්න'}
                                    </label>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">නොමැත</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
};

ParentPortalTab.propTypes = {
  myChildren: PropTypes.arrayOf(
    PropTypes.shape({
      student_id: PropTypes.number.isRequired,
      student_name: PropTypes.string.isRequired,
      school: PropTypes.string,
      grade: PropTypes.string,
      qr_code_key: PropTypes.string,
      profile_photo_path: PropTypes.string,
      courses: PropTypes.array,
      attendance: PropTypes.array,
      results: PropTypes.array,
      payments: PropTypes.array
    })
  ).isRequired,
  onRefresh: PropTypes.func
};

export default ParentPortalTab;
