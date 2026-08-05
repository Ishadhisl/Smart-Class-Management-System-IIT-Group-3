import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { Loader2, Upload, FileSpreadsheet, Plus, AlertCircle, Download, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const ExamTab = ({ courses, role }) => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const { showNotification } = useNotification();
  const isStudent = role === 'Student';
  const isTeacher = role === 'Teacher' || role === 'Admin';

  const fetchExams = useCallback(async (courseId) => {
    if (!courseId) {
      setExams([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request(`/exams/course/${courseId}`);
      setExams(data || []);
      setSelectedExam(null);
      setResults([]);
    } catch (err) {
      showNotification('විභාග ලැයිස්තුව ලබා ගැනීමේදී දෝෂයක් ඇති විය.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const fetchResults = useCallback(async (examId) => {
    if (!examId) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request(`/exams/results/${examId}`);
      setResults(data || []);
    } catch (err) {
      showNotification('ප්‍රතිඵල ලබා ගැනීමේදී දෝෂයක් ඇති විය.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchExams(selectedCourse);
  }, [selectedCourse, fetchExams]);

  useEffect(() => {
    fetchResults(selectedExam);
  }, [selectedExam, fetchResults]);

  const getGrade = (marks) => {
    if (marks >= 75) return { grade: 'A', color: 'text-green-600 bg-green-50 border-green-200' };
    if (marks >= 65) return { grade: 'B', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (marks >= 55) return { grade: 'C', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    if (marks >= 35) return { grade: 'S', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { grade: 'F', color: 'text-red-600 bg-red-50 border-red-200' };
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['student_id', 'marks'],
      ['ST10001', '85'],
      ['ST10002', '72']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    XLSX.writeFile(wb, 'Marks_Upload_Template.xlsx');
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-glass flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-primary mb-2">📊 {isStudent ? 'මගේ විභාග සහ ප්‍රතිඵල' : 'විභාග සහ ලකුණු කළමනාකරණය'}</h3>
          <p className="text-gray-500">ශිෂ්‍ය ලකුණු දර්ශකය</p>
        </div>

        <div className="w-full md:w-72 mt-4 md:mt-0">
          <label className="block text-sm font-bold text-gray-700 mb-2">පන්තිය තෝරන්න (Select Class)</label>
          <select 
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)} 
          >
            <option value="">-- පන්තිය තෝරන්න --</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 flex flex-col overflow-hidden relative">
        {!selectedCourse ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <div className="text-6xl mb-4">🎓</div>
            <p className="text-lg font-medium">විභාග සහ ප්‍රතිඵල බැලීම සඳහා පන්තියක් තෝරන්න</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full">
            {/* Sidebar for Exams List */}
            <div className="w-full md:w-1/3 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  විභාග ලැයිස්තුව
                </h4>
                {isTeacher && (
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                    title="නව විභාගයක් සාදන්න"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {exams.length === 0 && !loading && (
                  <div className="p-4 text-center text-sm text-gray-500">මෙම පන්තිය සඳහා විභාග නොමැත.</div>
                )}
                {exams.map(exam => (
                  <button
                    key={exam.exam_id}
                    onClick={() => setSelectedExam(exam.exam_id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedExam === exam.exam_id 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-gray-100 hover:border-primary/30 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{exam.exam_name}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                      <span>{new Date(exam.exam_date).toLocaleDateString()}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full">Total: {exam.total_marks}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Area for Results */}
            <div className="w-full md:w-2/3 flex flex-col bg-gray-50 relative h-full">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-primary">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
              
              {!selectedExam ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <FileSpreadsheet className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg font-medium text-center">ප්‍රතිඵල බැලීම සඳහා විභාගයක් තෝරන්න</p>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-0">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ප්‍රතිඵල සාරාංශය
                    </h4>
                    {isTeacher && (
                      <button 
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 transition-colors shadow-sm"
                      >
                        <Upload className="w-4 h-4" />
                        Excel Upload
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4">
                    {results.length === 0 && !loading ? (
                      <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">තවමත් ප්‍රතිඵල ඇතුළත් කර නොමැත.</p>
                          {isTeacher && <p className="text-sm mt-1 opacity-80">"Excel Upload" බොත්තම භාවිතා කර ලකුණු ඇතුළත් කරන්න.</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                            <tr>
                              <th className="p-4 font-semibold">ශිෂ්‍ය අංකය</th>
                              {isTeacher && <th className="p-4 font-semibold">නම</th>}
                              <th className="p-4 font-semibold text-center">ලකුණු</th>
                              <th className="p-4 font-semibold text-center">සාමාර්ථය (Grade)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {results.map((r, i) => {
                              const gradeInfo = getGrade(r.marks);
                              return (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="p-4 font-medium text-gray-800">{r.student_id}</td>
                                  {isTeacher && <td className="p-4 text-gray-600">{r.student_name}</td>}
                                  <td className="p-4 text-center font-bold text-gray-900">{r.marks}</td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${gradeInfo.color}`}>
                                      {gradeInfo.grade}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && isTeacher && (
        <UploadModal 
          examId={selectedExam} 
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchResults(selectedExam);
            showNotification('ලකුණු සාර්ථකව උඩුගත කරන ලදී!', 'success');
          }}
          onDownloadTemplate={handleDownloadTemplate}
        />
      )}

      {/* Create Exam Modal */}
      {showCreateModal && isTeacher && (
        <CreateExamModal 
          courseId={selectedCourse}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchExams(selectedCourse);
            showNotification('විභාගය සාර්ථකව සෑදුවා!', 'success');
          }}
        />
      )}
    </div>
  );
};

// --- Sub Components for Modals ---

const UploadModal = ({ examId, onClose, onSuccess, onDownloadTemplate }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { showNotification } = useNotification();

  const handleUpload = async () => {
    if (!file) {
      showNotification('කරුණාකර Excel ගොනුවක් තෝරන්න.', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('exam_id', examId);

    try {
      const res = await request('/exams/upload-marks', {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      if(res) {
          onSuccess();
      }
    } catch (err) {
      showNotification(err.message || 'උඩුගත කිරීම අසාර්ථකයි.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            ලකුණු උඩුගත කරන්න (Excel)
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100 text-sm text-blue-800">
          <p className="mb-2"><strong>උපදෙස්:</strong> කරුණාකර නිවැරදි ආකෘතියෙන් (Template) යුතු Excel ගොනුවක් උඩුගත කරන්න.</p>
          <ul className="list-disc pl-5 space-y-1 mb-3">
            <li>තීරුව 1: ශිෂ්‍ය අංකය (ST10001)</li>
            <li>තීරුව 2: ලකුණු (0-100)</li>
          </ul>
          <button 
            onClick={onDownloadTemplate}
            className="flex items-center gap-1.5 text-primary font-semibold hover:underline text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            ආදර්ශ ගොනුව බාගත කරන්න (Download Template)
          </button>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary/50 transition-colors bg-gray-50 mb-6">
          <input 
            type="file" 
            id="excel-upload" 
            className="hidden" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
            <FileSpreadsheet className={`w-12 h-12 mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700">
              {file ? file.name : 'Excel ගොනුව මෙතැනට Drag කරන්න හෝ තෝරන්න'}
            </span>
            <span className="text-xs text-gray-500 mt-1">.xlsx, .xls (Max 5MB)</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            අවලංගු කරන්න
          </button>
          <button 
            onClick={handleUpload}
            disabled={uploading || !file}
            className="px-5 py-2.5 rounded-xl font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'උඩුගත කරන්න'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateExamModal = ({ courseId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    exam_name: '',
    exam_date: new Date().toISOString().split('T')[0],
    total_marks: 100,
    pass_percentage: 35
  });
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.exam_name) return showNotification('විභාගයේ නම ඇතුළත් කරන්න', 'error');

    setLoading(true);
    try {
      await request('/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, course_id: courseId })
      });
      onSuccess();
    } catch (err) {
      showNotification('විභාගය සෑදීම අසාර්ථකයි.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          නව විභාගයක් සාදන්න
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">විභාගයේ නම</label>
            <input 
              type="text" 
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50"
              placeholder="උදා: 2026 Mid-Term Exam"
              value={formData.exam_name}
              onChange={(e) => setFormData({...formData, exam_name: e.target.value})}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">දිනය</label>
              <input 
                type="date" 
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50"
                value={formData.exam_date}
                onChange={(e) => setFormData({...formData, exam_date: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">මුළු ලකුණු</label>
              <input 
                type="number" 
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50"
                value={formData.total_marks}
                onChange={(e) => setFormData({...formData, total_marks: e.target.value})}
                required min="1"
              />
            </div>
          </div>
          
          <div className="flex gap-3 justify-end mt-8">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              අවලංගු කරන්න
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'සුරකින්න'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

ExamTab.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.object).isRequired,
  role: PropTypes.string,
};

export default ExamTab;