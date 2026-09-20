import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { request } from '../../services/api';
import { FaCalendarAlt, FaBook, FaClipboardList, FaExternalLinkAlt } from 'react-icons/fa';

// Shown once per browser session, right after login: today's classes, exams, and (best
// effort) any Moodle Assignment/Quiz due today - so the user sees what's coming up for the
// day *before* it happens, instead of finding out mid-class that something was due.
const TodayAgendaModal = () => {
  const [open, setOpen] = useState(false);
  const [agenda, setAgenda] = useState(null);

  useEffect(() => {
    // Once per browser tab session - reopening the dashboard tab shows it again tomorrow,
    // but not every time the SPA re-renders today.
    if (sessionStorage.getItem('todayAgendaShown') === 'true') return;

    let ignore = false;
    (async () => {
      try {
        const data = await request('/agenda/today');
        if (ignore) return;
        if (data && data.hasAny) {
          setAgenda(data);
          setOpen(true);
        }
      } catch (err) {
        console.warn('Today agenda fetch skipped:', err.message);
      } finally {
        if (!ignore) sessionStorage.setItem('todayAgendaShown', 'true');
      }
    })();

    return () => { ignore = true; };
  }, []);

  if (!agenda) return null;

  const formatTime = (t) => (t ? t.slice(0, 5) : '');

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="📋 අද දිනයේ කාලසටහන" maxWidth="max-w-lg">
      <div className="space-y-5">
        {agenda.classes.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 font-bold text-primary mb-2">
              <FaCalendarAlt className="w-4 h-4" /> අද පන්ති (Classes Today)
            </h4>
            <ul className="space-y-2">
              {agenda.classes.map((c) => (
                <li key={c.schedule_id} className="bg-indigo-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-semibold">{formatTime(c.start_time)} - {formatTime(c.end_time)}</span>
                  {' — '}{c.course_name}
                  {c.hall_name && <span className="text-gray-500"> ({c.hall_name})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {agenda.exams.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 font-bold text-danger mb-2">
              <FaClipboardList className="w-4 h-4" /> අද විභාග (Exams Today)
            </h4>
            <ul className="space-y-2">
              {agenda.exams.map((e) => (
                <li key={e.exam_id} className="bg-red-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-semibold">{e.exam_name}</span> — {e.course_name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {agenda.moodleEvents.length > 0 && (
          <div>
            <h4 className="flex items-center gap-2 font-bold text-amber-600 mb-2">
              <FaBook className="w-4 h-4" /> අද Assignment / Quiz Deadlines
            </h4>
            <ul className="space-y-2">
              {agenda.moodleEvents.map((m, i) => (
                <li key={i} className="bg-amber-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <span><span className="font-semibold">{m.name}</span>{m.course ? ` — ${m.course}` : ''}</span>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0">
                      <FaExternalLinkAlt className="w-3.5 h-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TodayAgendaModal;
