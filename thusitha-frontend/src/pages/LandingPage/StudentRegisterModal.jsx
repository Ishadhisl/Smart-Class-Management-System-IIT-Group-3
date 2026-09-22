import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/common/Modal';
import Label from '../../components/common/Label';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import FormError from '../../components/common/FormError';
import Button from '../../components/common/Button';
import { request } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import {
  filterNameInput,
  filterPhoneInput,
  filterTextInput,
  NAME_INVALID_MSG,
  PHONE_INVALID_MSG,
  TEXT_INVALID_MSG,
  validateName,
  validateEmail,
  validatePhone,
  validateRequired,
  validateText,
} from '../../utils/formValidation';
import { useFieldValidation } from '../../utils/useFieldValidation';

const EMPTY_FORM = {
  student_name: '',
  school: '',
  grade: '',
  parent_name: '',
  parent_phone: '',
  email: '',
  course_id: '',
};

// Shared student pre-registration modal - used both by the home page's own
// "දැන්ම ලියාපදිංචි වන්න" button and by CoursesPage's per-course "ලියාපදිංචි වන්න" button
// (which passes initialCourseId so the dropdown opens pre-selected, right there on the
// courses page, instead of routing the visitor away to a different page to find it).
const StudentRegisterModal = ({ open, onClose, courses, initialCourseId }) => {
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form (and apply any pre-selected course) every time the modal opens.
  useEffect(() => {
    if (open) {
      setFormData((prev) => ({
        ...EMPTY_FORM,
        course_id: initialCourseId != null ? String(initialCourseId) : prev.course_id,
      }));
    }
  }, [open, initialCourseId]);

  const rules = (data) => ({
    student_name: () => validateName(data.student_name, { label: 'ශිෂ්‍යයාගේ නම' }),
    school: () => validateText(data.school, { label: 'පාසල', max: 150 }),
    grade: () => validateText(data.grade, { required: true, label: 'ශ්‍රේණිය', max: 30 }),
    parent_name: () => validateName(data.parent_name, { label: 'මව්පිය / භාරකාර නම' }),
    parent_phone: () => validatePhone(data.parent_phone, { required: true }),
    course_id: () => validateRequired(data.course_id, 'උනන්දුවක් දක්වන පන්තිය'),
    email: () => validateEmail(data.email, { required: false }),
  });
  const reg = useFieldValidation(formData, setFormData, rules);

  const close = () => {
    onClose();
    reg.clear();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reg.validateAll()) {
      showNotification('කරුණාකර රතු පාටින් සලකුණු කර ඇති තොරතුරු නිවැරදි කරන්න.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const response = await request('/students/register-public', {
        method: 'POST',
        body: formData,
      });
      if (response) {
        showNotification('ලියාපදිංචිය සාර්ථකයි! කරුණාකර අනුමැතිය සඳහා කාර්යාලයට පැමිණෙන්න.');
        close();
        setFormData(EMPTY_FORM);
      } else {
        showNotification('ලියාපදිංචිය අසාර්ථකයි.', 'error');
      }
    } catch (err) {
      console.error('Pre-registration error:', err);
      showNotification(err.message || 'පද්ධති දෝෂයකි. පසුව උත්සාහ කරන්න.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="ලියාපදිංචි වන්න" maxWidth="max-w-lg">
      <p className="text-center text-slate-500 mb-2 text-sm">
        ඔබේ තොරතුරු ඇතුළත් කර පන්තියට අදාළ අසුනක් වෙන් කරවා ගන්න.
      </p>
      <p className="text-center text-slate-400 mb-6 text-xs">
        <span className="text-danger">*</span> සලකුණු කළ තොරතුරු අනිවාර්ය වේ.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <Label htmlFor="student_name">
            ශිෂ්‍යයාගේ නම <span className="text-danger">*</span>
          </Label>
          <Input
            id="student_name"
            type="text"
            placeholder="උදා: Kamal Perera / කමල් පෙරේරා"
            maxLength={150}
            value={formData.student_name}
            invalid={!!reg.errors.student_name}
            onChange={(e) =>
              reg.set('student_name', e.target.value, filterNameInput, NAME_INVALID_MSG)
            }
            onBlur={() => reg.blur('student_name')}
          />
          <FormError>{reg.errors.student_name}</FormError>
        </div>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <Label htmlFor="school">පාසල</Label>
            <Input
              id="school"
              type="text"
              placeholder="උදා: Royal College, Colombo"
              maxLength={150}
              value={formData.school}
              invalid={!!reg.errors.school}
              onChange={(e) =>
                reg.set('school', e.target.value, filterTextInput, TEXT_INVALID_MSG)
              }
              onBlur={() => reg.blur('school')}
            />
            <FormError>{reg.errors.school}</FormError>
          </div>
          <div className="flex-1">
            <Label htmlFor="grade">
              ශ්‍රේණිය <span className="text-danger">*</span>
            </Label>
            <Input
              id="grade"
              type="text"
              placeholder="උදා: Grade 11 / 12-AL"
              maxLength={30}
              value={formData.grade}
              invalid={!!reg.errors.grade}
              onChange={(e) =>
                reg.set('grade', e.target.value, filterTextInput, TEXT_INVALID_MSG)
              }
              onBlur={() => reg.blur('grade')}
            />
            <FormError>{reg.errors.grade}</FormError>
          </div>
        </div>
        <div className="mb-4">
          <Label htmlFor="parent_name">
            මව්පිය / භාරකාර නම <span className="text-danger">*</span>
          </Label>
          <Input
            id="parent_name"
            type="text"
            placeholder="උදා: Sunil Perera / සුනිල් පෙරේරා"
            maxLength={150}
            value={formData.parent_name}
            invalid={!!reg.errors.parent_name}
            onChange={(e) =>
              reg.set('parent_name', e.target.value, filterNameInput, NAME_INVALID_MSG)
            }
            onBlur={() => reg.blur('parent_name')}
          />
          <FormError>{reg.errors.parent_name}</FormError>
        </div>
        <div className="mb-4">
          <Label htmlFor="parent_phone">
            දෙමාපිය දුරකථන අංකය <span className="text-danger">*</span>
          </Label>
          <Input
            id="parent_phone"
            type="tel"
            inputMode="numeric"
            placeholder="උදා: 0771234567 (ඉලක්කම් 10ක්)"
            maxLength={12}
            value={formData.parent_phone}
            invalid={!!reg.errors.parent_phone}
            onChange={(e) =>
              reg.set('parent_phone', e.target.value, filterPhoneInput, PHONE_INVALID_MSG)
            }
            onBlur={() => reg.blur('parent_phone')}
          />
          <FormError>{reg.errors.parent_phone}</FormError>
        </div>
        <div className="mb-4">
          <Label htmlFor="course_id">
            උනන්දුවක් දක්වන පන්තිය (Interested Course) <span className="text-danger">*</span>
          </Label>
          <Select
            id="course_id"
            value={formData.course_id}
            invalid={!!reg.errors.course_id}
            onChange={(e) => reg.set('course_id', e.target.value)}
            onBlur={() => reg.blur('course_id')}
          >
            <option value="">-- පන්තියක් තෝරන්න --</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_name}
              </option>
            ))}
          </Select>
          <FormError>{reg.errors.course_id}</FormError>
        </div>
        <div className="mb-6">
          <Label htmlFor="email">ඊමේල් ලිපිනය (ඇත්නම්)</Label>
          <Input
            id="email"
            type="email"
            placeholder="උදා: kamal@gmail.com"
            maxLength={150}
            value={formData.email}
            invalid={!!reg.errors.email}
            onChange={(e) =>
              reg.set('email', e.target.value, filterTextInput, TEXT_INVALID_MSG, { live: true })
            }
            onBlur={() => reg.blur('email')}
          />
          <FormError>{reg.errors.email}</FormError>
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting} disabled={submitting}>
          ලියාපදිංචි කිරීම තහවුරු කරන්න
        </Button>
      </form>
    </Modal>
  );
};

StudentRegisterModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  courses: PropTypes.arrayOf(
    PropTypes.shape({
      course_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      course_name: PropTypes.string,
    })
  ).isRequired,
  initialCourseId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default StudentRegisterModal;
