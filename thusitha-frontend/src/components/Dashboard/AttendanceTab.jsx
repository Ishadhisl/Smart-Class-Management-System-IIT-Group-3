import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ClipboardList, History, Check, X, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { request } from '../../services/api';

const AttendanceTab = ({
  students,
  courses,
  selectedCourse,
  onCourseChange,
  attendanceRecords,
  onCheckboxChange,
  onBulkCheckboxChange,
  onSave,
  loading
}) => {
  const [aiData, setAiData] = useState(null);
  const [viewMode, setViewMode] = useState('marking'); // 'marking' or 'logs'
  const [historyLogs, setHistoryLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch AI Headcount Verification mismatch data when course changes
  useEffect(() => {
    if (selectedCourse) {
      request(`/attendance/master/${selectedCourse}`)
        .then(data => setAiData(data || null))
        .catch(err => console.error('AI Headcount Fetch Error:', err));
    } else {
      setAiData(null);
    }
  }, [selectedCourse]);

  // Fetch historical logs when course or viewMode changes
  const fetchLogs = () => {
    if (!selectedCourse) return;
    setLogsLoading(true);
    request(`/attendance/logs/${selectedCourse}?all=true`)
      .then(data => {
        setHistoryLogs(data || []);
      })
      .catch(err => console.error('Logs Fetch Error:', err))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    if (selectedCourse && viewMode === 'logs') {
      fetchLogs();
    } else {
      setHistoryLogs([]);
    }
  }, [selectedCourse, viewMode]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <ClipboardList size={22} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-indigo-950">පැමිණීම කළමනාකරණය (Attendance)</h2>
            <p className="text-gray-500 text-xs mt-0.5">පන්ති සඳහා පැමිණීම් ලකුණු කිරීම සහ ලොග නිරීක්ෂණය</p>
          </div>
        </div>

        {/* Tab Toggle buttons */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('marking')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'marking'
                ? 'bg-indigo-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Check size={14} />
            Marking
          </button>
          <button
            onClick={() => setViewMode('logs')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              viewMode === 'logs'
                ? 'bg-indigo-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History size={14} />
            History Logs
          </button>
        </div>
      </div>

      {/* AI Verification Alert (Face/Congestion headcount mismatch) */}
      {aiData?.mismatch_detected && (
        <div className="flex items-start gap-3 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl">
          <div className="shrink-0 text-amber-600 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div className="text-sm">
            <h4 className="font-bold text-amber-900">⚠️ පැමිණීමේ නොගැලපීමක් හඳුනාගෙන ඇත! (AI headcount mismatch)</h4>
            <p className="text-amber-700 mt-1">
              QR මගින් සටහන් වූ සංඛ්‍යාව: <strong className="text-indigo-950">{aiData.qr_count}</strong> | 
              කැමරාව මගින් හඳුනාගත් සංඛ්‍යාව: <strong className="text-indigo-950">{aiData.ai_headcount}</strong>
            </p>
            <p className="text-xs text-amber-600/80 mt-0.5">කරුණාකර පන්තියේ සිටින ශිෂ්‍ය සංඛ්‍යාව නැවත පරීක්ෂා කරන්න.</p>
          </div>
        </div>
      )}

      {/* Select Class Dropdown Container */}
      <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100">
        <label htmlFor="attendanceCourse" className="block text-sm font-bold text-gray-700 mb-2">
          පන්තිය තෝරන්න (Select Class)
        </label>
        <select
          id="attendanceCourse"
          value={selectedCourse}
          onChange={(e) => onCourseChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-sm"
        >
          <option value="">-- පන්තියක් තෝරන්න (Select Class) --</option>
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>
              {c.course_name}
            </option>
          ))}
        </select>
      </div>

      {/* Conditional View Mode */}
      {selectedCourse ? (
        viewMode === 'logs' ? (
          /* HISTORY LOGS SECTION */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-indigo-950 text-base">📋 පැමිණීම් ඉතිහාසය (Attendance logs)</h3>
              <button 
                onClick={fetchLogs}
                disabled={logsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-700 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-100 transition-all disabled:opacity-60"
              >
                <RefreshCw size={12} className={logsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                <p className="text-gray-400 text-sm font-medium">පැමිණීම් වාර්තා කිසිවක් හමු නොවිණි.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3.5">දිනය & වේලාව (Date & Time)</th>
                      <th className="px-6 py-3.5">Student ID / Ref</th>
                      <th className="px-6 py-3.5">ශිෂ්‍යයාගේ නම</th>
                      <th className="px-6 py-3.5 text-center">තත්ත්වය (Status)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historyLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {new Date(log.scanned_at).toLocaleString('si-LK')}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-indigo-950 font-bold">
                          {log.qr_code_key || `ST-${log.student_id}`}
                        </td>
                        <td className="px-6 py-4 text-gray-900 font-semibold">{log.student_name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            Present
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* MANUAL MARKING SECTION */
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-semibold">
              💡 අද දින පැමිණ සිටින සිසුන් ඉදිරියෙන් ඇති කොටුව සලකුණු කරන්න.
            </p>

            {students.length > 0 ? (
              <>
                {/* Bulk selection buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onBulkCheckboxChange(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-900 text-white hover:bg-indigo-950 text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <Check size={14} />
                    සියල්ලන්ම සලකුණු කරන්න (Select All)
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkCheckboxChange(false)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 hover:text-gray-900 border border-gray-300 text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <X size={14} />
                    සියල්ලන්ම ඉවත් කරන්න (Deselect All)
                  </button>
                </div>

                {/* Students check list table */}
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3.5">Student ID</th>
                        <th className="px-6 py-3.5">ශිෂ්‍යයාගේ නම</th>
                        <th className="px-6 py-3.5 text-center">පැමිණීම (Status)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {students.map((student, index) => {
                        const studentKey = student._id || student.studentId;
                        return (
                          <tr key={studentKey || index} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-gray-500 font-bold">
                              {student.studentId || 'N/A'}
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-800">{student.name}</td>
                            <td className="px-6 py-4 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                <input
                                  type="checkbox"
                                  checked={!!attendanceRecords[studentKey]}
                                  onChange={() => onCheckboxChange(studentKey)}
                                  className="w-5 h-5 rounded border-gray-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer accent-indigo-900"
                                />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {loading ? 'සුරකිමින්...' : '💾 පැමිණීම සුරකින්න'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
                <p className="text-gray-400 text-sm font-medium">මෙම පන්තියේ සිසුන් කිසිවෙකු ලියාපදිංචි වී නොමැත.</p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50/30">
          <p className="text-gray-400 text-sm font-medium">කරුණාකර පන්තියක් (Class) තෝරන්න.</p>
        </div>
      )}
    </div>
  );
};

AttendanceTab.propTypes = {
  students: PropTypes.arrayOf(PropTypes.object).isRequired,
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedCourse: PropTypes.string.isRequired,
  onCourseChange: PropTypes.func.isRequired,
  attendanceRecords: PropTypes.object.isRequired,
  onCheckboxChange: PropTypes.func.isRequired,
  onBulkCheckboxChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default AttendanceTab;