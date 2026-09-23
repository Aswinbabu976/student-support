import { Navigate, Route, Routes } from 'react-router-dom';
import { HelpSeekerRegisterPage } from './pages/auth/HelpSeekerRegisterPage';
import { LoginPage } from './pages/auth/LoginPage';
import { StudentRegisterPage } from './pages/auth/StudentRegisterPage';
import { VerifyStudentEmailPage } from './pages/auth/VerifyStudentEmailPage';
import { CreateBookingRequestPage } from './pages/help-seeker/CreateBookingRequestPage';
import { BookingRequestStatusPage } from './pages/help-seeker/BookingRequestStatusPage';
import { CreateTaskPage } from './pages/help-seeker/CreateTaskPage';
import { HelpSeekerHomePage } from './pages/help-seeker/HelpSeekerHomePage';
import { TaskDetailsPage } from './pages/help-seeker/TaskDetailsPage';
import { TaskRecommendationsPage } from './pages/help-seeker/TaskRecommendationsPage';
import { HomePage } from './pages/HomePage';
import { StudentAvailabilityPage } from './pages/student/StudentAvailabilityPage';
import { StudentBookingRequestPage } from './pages/student/StudentBookingRequestPage';
import { StudentSkillsPage } from './pages/student/StudentSkillsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/register/student" element={<StudentRegisterPage />} />
      <Route path="/register/help-seeker" element={<HelpSeekerRegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/help-seeker" element={<HelpSeekerHomePage />} />
      <Route path="/help-seeker/tasks/create" element={<CreateTaskPage />} />
      <Route path="/help-seeker/tasks/:taskId/recommendations" element={<TaskRecommendationsPage />} />
      <Route path="/help-seeker/tasks/:taskId/book/:studentId" element={<CreateBookingRequestPage />} />
      <Route path="/help-seeker/bookings/:bookingId" element={<BookingRequestStatusPage />} />
      <Route path="/help-seeker/tasks/:taskId" element={<TaskDetailsPage />} />
      <Route path="/student/skills" element={<StudentSkillsPage />} />
      <Route path="/student/availability" element={<StudentAvailabilityPage />} />
      <Route path="/student/requests/:bookingId" element={<StudentBookingRequestPage />} />
      <Route path="/verify-email/success" element={<VerifyStudentEmailPage success />} />
      <Route path="/verify-email" element={<VerifyStudentEmailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
