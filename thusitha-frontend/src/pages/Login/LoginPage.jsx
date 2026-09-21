import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { LogIn, KeyRound, Clock, ShieldCheck, ArrowLeft } from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { authService } from "../../services/authService";
import { request } from "../../services/api";
import Card from "../../components/common/Card";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Label from "../../components/common/Label";
import FormError from "../../components/common/FormError";
import { validatePassword } from "../../utils/formValidation";
import PasswordRules from "../../components/common/PasswordRules";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const LoginPage = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const { showNotification } = useNotification();

  // api.js sends people here with ?reason=expired when their token stopped validating
  // (24h JWT lifetime) - explain it instead of looking like a random logout.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired") {
      window.history.replaceState({}, document.title, window.location.pathname);
      const timer = setTimeout(
        () => showNotification("ඔබගේ session එක කල් ඉකුත් විය (පැය 24). කරුණාකර නැවත ඇතුළු වන්න.", "info"),
        50,
      );
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showPassword, setShowPassword] = useState(false);

  // First-time password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // ═══════════════════════════════════════════
  // Forgot Password — 3-step OTP Flow
  // ═══════════════════════════════════════════
  const [forgotStep, setForgotStep] = useState(0); // 0=login, 1=enter-user, 2=enter-otp, 3=new-password
  const [fpUsername, setFpUsername] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpConfirmPw, setFpConfirmPw] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpPhoneHint, setFpPhoneHint] = useState("");

  // Helper: get and consume the QR return path from sessionStorage (open-redirect safe)
  const consumeReturnPath = () => {
    const stored = sessionStorage.getItem("qr_return_path");
    if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
      sessionStorage.removeItem("qr_return_path");
      return stored;
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      showNotification("කරුණාකර හිස්ව ඇති තොරතුරු පුරවන්න.", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await authService.login(
        credentials.username,
        credentials.password,
      );

      if (data.must_change_password) {
        setShowPasswordChange(true);
        showNotification(
          "ඔබ ප්‍රථම වරට Login වෙයි. කරුණාකර නව මුරපදයක් සකසන්න.",
        );
      } else {
        showNotification("සාර්ථකව ඇතුළු විය!");
        const returnPath = consumeReturnPath();
        navigate(returnPath || "/dashboard");
      }
    } catch (err) {
      if (err.message.includes("අගුලු දමා ඇත")) {
        showNotification(`${err.message}`, "error");
      } else {
        showNotification(err.message || "සම්බන්ධතාවයේ දෝෂයකි.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const pwError = validatePassword(newPassword);
    if (pwError) {
      showNotification(pwError, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification("මුරපද දෙක සමාන නොවේ.", "error");
      return;
    }
    setChangingPassword(true);
    try {
      await request("/auth/change-password", {
        method: "POST",
        body: { newPassword },
      });
      showNotification("මුරපදය සාර්ථකව වෙනස් කළා! Dashboard එකට යොමු වෙයි...");
      setShowPasswordChange(false);
      const returnPath = consumeReturnPath();
      navigate(returnPath || "/dashboard");
    } catch (err) {
      showNotification(err.message || "මුරපදය වෙනස් කිරීමේ දෝෂයකි.", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  // Step 1: Username submit → OTP send via WhatsApp
  const handleFpSendOtp = async (e) => {
    e.preventDefault();
    if (!fpUsername.trim()) {
      showNotification("Username ඇතුළත් කරන්න.", "error");
      return;
    }
    setFpLoading(true);
    try {
      const res = await request("/auth/forgot-password", {
        method: "POST",
        body: { username: fpUsername },
        noAuth: true,
      });
      setFpPhoneHint(res.phone_hint || "");
      setForgotStep(2);
      showNotification("WhatsApp OTP code යවන ලදී! ");
    } catch (err) {
      showNotification(err.message || "OTP යැවීමේ දෝෂයකි.", "error");
    } finally {
      setFpLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleFpVerifyOtp = async (e) => {
    e.preventDefault();
    if (fpOtp.length !== 6) {
      showNotification("6-digit OTP ඇතුළත් කරන්න.", "error");
      return;
    }
    setFpLoading(true);
    try {
      await request("/auth/verify-otp", {
        method: "POST",
        body: { username: fpUsername, otp: fpOtp },
        noAuth: true,
      });
      setForgotStep(3);
      showNotification("OTP සාර්ථකයි! නව මුරපදය සකසන්න.");
    } catch (err) {
      showNotification(err.message || "OTP වැරදියි.", "error");
    } finally {
      setFpLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleFpResetPassword = async (e) => {
    e.preventDefault();
    const pwError = validatePassword(fpNewPw);
    if (pwError) {
      showNotification(pwError, "error");
      return;
    }
    if (fpNewPw !== fpConfirmPw) {
      showNotification("මුරපද දෙකෙ ගළපෙ නෑ.", "error");
      return;
    }
    setFpLoading(true);
    try {
      await request("/auth/reset-with-otp", {
        method: "POST",
        body: { username: fpUsername, otp: fpOtp, newPassword: fpNewPw },
        noAuth: true,
      });
      showNotification("මුරපදය සාර්ථකව නැවත සකසන ලදී!");
      setForgotStep(0);
      setFpUsername("");
      setFpOtp("");
      setFpNewPw("");
      setFpConfirmPw("");
    } catch (err) {
      showNotification(err.message || "Reset error.", "error");
    } finally {
      setFpLoading(false);
    }
  };

  const heading =
    (forgotStep === 0 && !showPasswordChange && "පද්ධතියට ඇතුළු වන්න") ||
    (showPasswordChange && "නව මුරපදයක් සකසන්න") ||
    (forgotStep === 1 && "Username ඇතුළත් කරන්න") ||
    (forgotStep === 2 && "WhatsApp OTP Enter") ||
    (forgotStep === 3 && "නව මුරපදය සකසන්න");

  const subheading =
    (forgotStep === 0 &&
      !showPasswordChange &&
      "Thusitha Smart Class Management") ||
    (forgotStep === 1 &&
      "ඔබගේ Username ඇතුළත් කරන්න — WhatsApp OTP code ලැබේ.") ||
    (forgotStep === 2 &&
      `ඔබගේ WhatsApp ${fpPhoneHint} ලැබෙන 6-digit OTP ඇතුළත් කරන්න.`) ||
    (forgotStep === 3 && "නව ශක්තිමත් මුරපදයක් සකසන්න.");

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Left brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light items-center justify-center p-12">
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, rgba(129,140,248,0.4) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 50%, rgba(129,140,248,0.4) 0%, transparent 50%)",
              "radial-gradient(circle at 50% 80%, rgba(236,72,153,0.3) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, rgba(129,140,248,0.4) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        {/* Decorative blurred blobs */}
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -20, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-72 h-72 bg-secondary/30 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -20, 30, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-0 w-80 h-80 bg-accent/30 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute top-1/3 left-1/4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"
        />

        {/* Floating education icons removed per user request to hide AI-generated templates */}

        {/* Animated rings behind logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map((ring) => (
            <motion.div
              key={ring}
              className="absolute rounded-full border border-white/5"
              style={{ width: `${ring * 140}px`, height: `${ring * 140}px` }}
              animate={{
                rotate: ring % 2 === 0 ? 360 : -360,
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 20 + ring * 5,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 text-center text-white max-w-sm"
        >
          {/* Logo with glow */}
          <div className="relative inline-block mb-6">
            <motion.div
              className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <img
              src="/Project%20LOGO.png"
              alt="Thusitha Academy Logo"
              className="relative w-24 h-24 mx-auto rounded-2xl bg-white/90 p-3 shadow-glass-hover"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wide mb-3">
            Thusitha Academy
          </h1>
          <p className="text-indigo-100 leading-relaxed mb-6">
            Smart Class Management System — AI පදනම් වූ පැමිණීම, ගෙවීම් සහ
            ඉගෙනුම් කළමනාකරණය එකම තැනකින්.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              "QR Attendance",
              "AI Monitoring",
              "Easy Payments",
              "Digital Learning",
            ].map((feat, i) => (
              <motion.span
                key={feat}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.15 }}
                className="bg-white/10 backdrop-blur-sm text-indigo-100 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-white/10"
              >
                {feat}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Mobile compact brand band */}
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <img
            src="/Project%20LOGO.png"
            alt="Logo"
            className="w-12 h-12 rounded-xl bg-white shadow-glass p-1.5"
          />
          <span className="text-xl font-extrabold text-primary-dark">
            Thusitha Academy
          </span>
        </div>

        <div className="w-full max-w-md">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-medium text-primary hover:text-primary-dark transition-colors"
            >
              මුල් පිටුව
            </button>
            <span>›</span>
            <span className="font-bold text-primary-dark">Login</span>
          </div>

          <Card
            padding="p-8 sm:p-10"
            hover={false}
            className="!shadow-xl !border-white/60 relative overflow-hidden"
          >
            {/* Subtle gradient border effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-light via-secondary to-accent" />
            <div className="text-center mb-8">
              <h2 className="m-0 text-2xl font-bold text-primary-dark">
                {heading}
              </h2>
              <p className="text-slate-500 text-sm mt-2">{subheading}</p>
            </div>

            <AnimatePresence mode="wait">
              {/* ═══ STEP 0: Normal Login ═══ */}
              {forgotStep === 0 && !showPasswordChange && (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleLogin}
                >
                  <div className="mb-5">
                    <Label htmlFor="username">පරිශීලක නාමය (Username)</Label>
                    <Input
                      id="username"
                      type="text"
                      required
                      placeholder="උදා: පරිශීලක නාමය ඇතුළත් කරන්න"
                      value={credentials.username}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          username: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          document.getElementById("password").focus();
                        }
                      }}
                    />
                  </div>
                  <div className="mb-5">
                    <Label htmlFor="password">මුරපදය (Password)</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="ඔබගේ මුරපදය ඇතුළත් කරන්න"
                        className="pr-11"
                        value={credentials.password}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            password: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <FaEyeSlash className="text-gray-500 hover:text-gray-700" />
                        ) : (
                          <FaEye className="text-gray-500 hover:text-gray-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-right mb-6">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#25d366] hover:text-[#1da851] transition-colors"
                    >
                      <FaWhatsapp /> මුරපදය අමතක වූවාද? (WhatsApp OTP)
                    </button>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={loading}
                    icon={<LogIn size={18} />}
                  >
                    {loading ? "පරීක්ෂා කරමින්..." : "ඇතුළු වන්න"}
                  </Button>
                </motion.form>
              )}

              {/* ═══ First-time Password Change ═══ */}
              {showPasswordChange && (
                <motion.form
                  key="pwchange"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleChangePassword}
                >
                  <div className="mb-5">
                    <Label htmlFor="newPassword">නව මුරපදය</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="උදා: Nimal@2026"
                    />
                    <PasswordRules value={newPassword} />
                  </div>
                  <div className="mb-6">
                    <Label htmlFor="confirmPassword">මුරපදය තහවුරු කරන්න</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="නැවත ඇතුළත් කරන්න"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="success"
                    size="lg"
                    fullWidth
                    loading={changingPassword}
                    icon={<KeyRound size={18} />}
                  >
                    {changingPassword ? "සුරකිමින්..." : "මුරපදය සුරකින්න"}
                  </Button>
                </motion.form>
              )}

              {/* ═══ STEP 1: Enter Username ═══ */}
              {forgotStep === 1 && (
                <motion.form
                  key="fp-step1"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleFpSendOtp}
                >
                  <div className="mb-5">
                    <Label>Username</Label>
                    <Input
                      type="text"
                      required
                      value={fpUsername}
                      onChange={(e) => setFpUsername(e.target.value)}
                      placeholder="උදා: ST084"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-success-light/20 text-success-dark text-sm mb-6">
                    <FaWhatsapp className="text-lg shrink-0 mt-0.5" />
                    <span>
                      ඔබගේ ගිණුමට සම්බන්ධ WhatsApp number වෙත OTP code එකක්
                      ලැබේ.
                    </span>
                  </div>
                  <Button
                    type="submit"
                    variant="whatsapp"
                    size="lg"
                    fullWidth
                    loading={fpLoading}
                    icon={<FaWhatsapp size={16} />}
                  >
                    {fpLoading ? "OTP යවමින්..." : "WhatsApp OTP Send කරන්න"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    fullWidth
                    className="mt-3"
                    onClick={() => setForgotStep(0)}
                    icon={<ArrowLeft size={16} />}
                  >
                    Login වෙත යන්න
                  </Button>
                </motion.form>
              )}

              {/* ═══ STEP 2: Enter OTP ═══ */}
              {forgotStep === 2 && (
                <motion.form
                  key="fp-step2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleFpVerifyOtp}
                >
                  <div className="mb-5">
                    <Label>WhatsApp OTP Code (6 digits)</Label>
                    <Input
                      type="text"
                      required
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      className="text-2xl tracking-[0.5em] text-center font-bold"
                      value={fpOtp}
                      onChange={(e) =>
                        setFpOtp(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-warning-light/20 text-warning-dark text-xs mb-6">
                    <Clock size={16} className="shrink-0" />
                    <span>
                      OTP code 10 මිනිත්තු ඇතුළත භාවිත නොකළ expire වේ.
                    </span>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={fpLoading}
                    disabled={fpOtp.length !== 6}
                    icon={<ShieldCheck size={18} />}
                  >
                    {fpLoading ? "Verifying..." : "OTP Verify කරන්න"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    fullWidth
                    className="mt-3"
                    onClick={() => {
                      setForgotStep(1);
                      setFpOtp("");
                    }}
                    icon={<ArrowLeft size={16} />}
                  >
                    OTP නැවත ලබාගන්න
                  </Button>
                </motion.form>
              )}

              {/* ═══ STEP 3: New Password ═══ */}
              {forgotStep === 3 && (
                <motion.form
                  key="fp-step3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleFpResetPassword}
                >
                  <div className="mb-4">
                    <Label>නව මුරපදය</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={fpNewPw}
                      onChange={(e) => setFpNewPw(e.target.value)}
                      placeholder="උදා: Nimal@2026"
                      autoFocus
                    />
                    <PasswordRules value={fpNewPw} />
                  </div>
                  <div className="mb-2">
                    <Label>නව මුරපදය නැවත ඇතුළත් කරන්න</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={fpConfirmPw}
                      onChange={(e) => setFpConfirmPw(e.target.value)}
                      placeholder="නැවත ඇතුළත් කරන්න"
                    />
                  </div>
                  <FormError>
                    {fpNewPw && fpConfirmPw && fpNewPw !== fpConfirmPw
                      ? "මුරපද දෙකෙ ගළපෙ නෑ"
                      : null}
                  </FormError>
                  <div className="mt-6">
                    <Button
                      type="submit"
                      variant="success"
                      size="lg"
                      fullWidth
                      loading={fpLoading}
                      icon={<KeyRound size={18} />}
                    >
                      {fpLoading ? "සුරකිමින්..." : "මුරපදය Reset කරන්න"}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
