import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split(";") : [];

  for (let cookie of cookies) {
    const trimmedCookie = cookie.trim();

    if (trimmedCookie.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmedCookie.substring(name.length + 1));
    }
  }

  return "";
}

api.interceptors.request.use((config) => {
  const unsafeMethods = ["post", "put", "patch", "delete"];

  if (unsafeMethods.includes(config.method)) {
    config.headers["X-CSRFToken"] = getCookie("csrftoken");
  }

  return config;
});

const MAX_ACTIVITY = 8;

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getInitials(user) {
  const name = user?.full_name || user?.username || "User";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Badge({ type = "slate", children }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    dark: "bg-slate-950 text-white ring-slate-950",
  };

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1",
        styles[type] || styles.slate,
      )}
    >
      {children}
    </span>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">
          {label}
        </span>
      )}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function PrimaryButton({
  type = "button",
  variant = "blue",
  disabled,
  loading,
  onClick,
  children,
}) {
  const styles = {
    blue: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100",
    green: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100",
    red: "bg-red-600 text-white hover:bg-red-700 shadow-red-100",
    dark: "bg-slate-950 text-white hover:bg-slate-800 shadow-slate-200",
    light:
      "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 shadow-slate-100",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "rounded-2xl px-5 py-3.5 text-sm font-black shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:ring-0",
        styles[variant] || styles.blue,
      )}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}

function AuthModal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.35)] sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-black text-slate-600 transition hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function AuthPage({ onAuthSuccess }) {
  const [popupType, setPopupType] = useState(null);
  const [forgotStep, setForgotStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");

  const [loginForm, setLoginForm] = useState({
    username_or_email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
  });

  const [forgotForm, setForgotForm] = useState({
    email: "",
    otp_code: "",
    new_password: "",
  });

  useEffect(() => {
    api.get("/auth/csrf/").catch(() => {});
  }, []);

  const openRegisterPopup = () => {
    setMessage("");
    setPopupType("register");
  };

  const openForgotPopup = () => {
    setMessage("");
    setForgotStep("request");
    setResetToken("");
    setPopupType("forgot");
  };

  const closePopup = () => {
    setPopupType(null);
    setForgotStep("request");
    setResetToken("");
    setMessage("");
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.post("/auth/login/", loginForm);

      onAuthSuccess(response.data.user);
    } catch (error) {
      setMessage(
        error?.response?.data?.message || "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.post("/auth/register/", registerForm);

      onAuthSuccess(response.data.user);
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.post("/auth/password-reset/request-otp/", {
        email: forgotForm.email,
      });

      setMessage(response.data.message || "OTP sent successfully.");
      setForgotStep("verify");
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          "Unable to send OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.post("/auth/password-reset/verify-otp/", {
        email: forgotForm.email,
        otp_code: forgotForm.otp_code,
      });

      setResetToken(response.data.reset_token);
      setMessage(response.data.message || "OTP verified successfully.");
      setForgotStep("reset");
    } catch (error) {
      setMessage(
        error?.response?.data?.message || "Invalid OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.post("/auth/password-reset/confirm/", {
        email: forgotForm.email,
        reset_token: resetToken,
        new_password: forgotForm.new_password,
      });

      setPopupType(null);
      setForgotStep("request");
      setResetToken("");

      setLoginForm({
        username_or_email: forgotForm.email,
        password: "",
      });

      setForgotForm({
        email: "",
        otp_code: "",
        new_password: "",
      });

      setMessage(
        response.data.message || "Password reset successful. Please login now.",
      );
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          "Unable to reset password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#edf2f7] p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.12)] lg:grid-cols-[1fr_470px]">
        <section className="relative flex flex-col justify-between bg-slate-950 p-8 text-white sm:p-10">
          <div>
            <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black">
              PMS
            </div>

            <Badge type="blue">Industrial Monitoring Platform</Badge>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Professional pressure monitoring and device control system.
            </h1>

            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300">
              Secure session login, role-based access, live device status, relay
              control, user management, and OTP-based password recovery.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-blue-200">
                SuperAdmin
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                Complete platform access.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-blue-200">
                Company Admin
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                System and user access.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-blue-200">
                Operator
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                Observe and ON/OFF.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-white p-6 sm:p-8">
          <div className="w-full">
            <div className="mb-7">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">
                Sign in
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Login first to access the secure monitoring dashboard.
              </p>
            </div>

            {message && (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <InputField
                label="Username or Email"
                value={loginForm.username_or_email}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    username_or_email: e.target.value,
                  })
                }
                placeholder="Enter username or email"
              />

              <InputField
                label="Password"
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({
                    ...loginForm,
                    password: e.target.value,
                  })
                }
                placeholder="Enter password"
              />

              <PrimaryButton type="submit" variant="blue" disabled={loading}>
                {loading ? "Please wait..." : "Sign in to Dashboard"}
              </PrimaryButton>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={openRegisterPopup}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Create New Account
              </button>

              <button
                onClick={openForgotPopup}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-800 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
              >
                Forgot Password?
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Security Note</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                This version uses Django session cookies and CSRF protection. No
                auth token is stored in localStorage.
              </p>
            </div>
          </div>
        </section>
      </div>

      {popupType === "register" && (
        <AuthModal
          title="Create Operator Account"
          subtitle="Public registration creates Operator access only. Admin accounts are created from User Management."
          onClose={closePopup}
        >
          {message && (
            <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {message}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="First Name"
                value={registerForm.first_name}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    first_name: e.target.value,
                  })
                }
                placeholder="First name"
              />

              <InputField
                label="Last Name"
                value={registerForm.last_name}
                onChange={(e) =>
                  setRegisterForm({
                    ...registerForm,
                    last_name: e.target.value,
                  })
                }
                placeholder="Last name"
              />
            </div>

            <InputField
              label="Username"
              value={registerForm.username}
              onChange={(e) =>
                setRegisterForm({
                  ...registerForm,
                  username: e.target.value,
                })
              }
              placeholder="Choose username"
            />

            <InputField
              label="Email"
              type="email"
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm({
                  ...registerForm,
                  email: e.target.value,
                })
              }
              placeholder="Email address"
            />

            <InputField
              label="Password"
              type="password"
              value={registerForm.password}
              onChange={(e) =>
                setRegisterForm({
                  ...registerForm,
                  password: e.target.value,
                })
              }
              placeholder="Minimum 6 characters"
            />

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700">
              This account will be created as Operator.
            </div>

            <PrimaryButton type="submit" variant="blue" disabled={loading}>
              {loading ? "Please wait..." : "Register Account"}
            </PrimaryButton>
          </form>
        </AuthModal>
      )}

      {popupType === "forgot" && (
        <AuthModal
          title={
            forgotStep === "request"
              ? "Request Password Reset OTP"
              : forgotStep === "verify"
                ? "Verify OTP"
                : "Set New Password"
          }
          subtitle={
            forgotStep === "request"
              ? "Enter your registered email address. The OTP will be sent to your email."
              : forgotStep === "verify"
                ? "Enter the 6-digit OTP sent to your email."
                : "Create a new password for your account."
          }
          onClose={closePopup}
        >
          {message && (
            <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {message}
            </div>
          )}

          {forgotStep === "request" && (
            <form onSubmit={requestOtp} className="space-y-4">
              <InputField
                label="Registered Email"
                type="email"
                value={forgotForm.email}
                onChange={(e) =>
                  setForgotForm({
                    ...forgotForm,
                    email: e.target.value,
                  })
                }
                placeholder="Enter registered email"
              />

              <PrimaryButton type="submit" variant="blue" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </PrimaryButton>
            </form>
          )}

          {forgotStep === "verify" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <InputField
                label="OTP Code"
                value={forgotForm.otp_code}
                onChange={(e) =>
                  setForgotForm({
                    ...forgotForm,
                    otp_code: e.target.value,
                  })
                }
                placeholder="Enter 6-digit OTP"
              />

              <PrimaryButton type="submit" variant="blue" disabled={loading}>
                {loading ? "Verifying..." : "Verify OTP"}
              </PrimaryButton>
            </form>
          )}

          {forgotStep === "reset" && (
            <form onSubmit={resetPassword} className="space-y-4">
              <InputField
                label="New Password"
                type="password"
                value={forgotForm.new_password}
                onChange={(e) =>
                  setForgotForm({
                    ...forgotForm,
                    new_password: e.target.value,
                  })
                }
                placeholder="Enter new password"
              />

              <PrimaryButton type="submit" variant="blue" disabled={loading}>
                {loading ? "Saving..." : "Reset Password"}
              </PrimaryButton>
            </form>
          )}
        </AuthModal>
      )}
    </main>
  );
}

function SidebarItem({ label, subtext, active, href }) {
  return (
    <a
      href={href}
      className={classNames(
        "block rounded-2xl border px-4 py-3 transition",
        active
          ? "border-blue-200 bg-blue-50"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
      )}
    >
      <p
        className={classNames(
          "text-sm font-black",
          active ? "text-blue-700" : "text-slate-900",
        )}
      >
        {label}
      </p>

      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {subtext}
      </p>
    </a>
  );
}

function SectionCard({ id, title, subtitle, action, children }) {
  return (
    <section
      id={id}
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function MetricCard({ label, value, helper, status, code }) {
  const styles = {
    green: {
      card: "border-emerald-200 bg-emerald-50",
      code: "bg-emerald-600 text-white",
      value: "text-emerald-800",
    },
    red: {
      card: "border-red-200 bg-red-50",
      code: "bg-red-600 text-white",
      value: "text-red-800",
    },
    amber: {
      card: "border-amber-200 bg-amber-50",
      code: "bg-amber-500 text-white",
      value: "text-amber-800",
    },
    blue: {
      card: "border-blue-200 bg-blue-50",
      code: "bg-blue-600 text-white",
      value: "text-blue-800",
    },
    slate: {
      card: "border-slate-200 bg-white",
      code: "bg-slate-950 text-white",
      value: "text-slate-950",
    },
  };

  const current = styles[status] || styles.slate;

  return (
    <div
      className={classNames(
        "rounded-[26px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        current.card,
      )}
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>

        <span
          className={classNames(
            "flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-black",
            current.code,
          )}
        >
          {code}
        </span>
      </div>

      <h3
        className={classNames(
          "text-2xl font-black tracking-tight",
          current.value,
        )}
      >
        {value}
      </h3>

      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        {helper}
      </p>
    </div>
  );
}

function UserManagementPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);

  const emptyForm = {
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    role: "OPERATOR",
    is_active: true,
  };

  const [form, setForm] = useState(emptyForm);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);

      const response = await api.get("/auth/users/");

      setUsers(response.data.users || []);
    } catch {
      setMessage("Unable to load users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingUserId(null);
  };

  const startEdit = (user) => {
    setEditingUserId(user.id);

    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
      role: user.role || "OPERATOR",
      is_active: user.is_active,
    });

    setMessage("");
  };

  const saveUser = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      await api.get("/auth/csrf/");

      if (editingUserId) {
        const response = await api.patch(
          `/auth/users/${editingUserId}/update/`,
          form,
        );

        setMessage(response.data.message || "User updated successfully.");
      } else {
        const response = await api.post("/auth/users/create/", form);

        setMessage(response.data.message || "User created successfully.");
      }

      resetForm();
      loadUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.full_name || user.username}?`,
    );

    if (!confirmed) return;

    try {
      setMessage("");

      await api.get("/auth/csrf/");

      const response = await api.delete(`/auth/users/${user.id}/delete/`);

      setMessage(response.data.message || "User deleted successfully.");
      loadUsers();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Unable to delete user.");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <SectionCard
      id="users"
      title="User Management"
      subtitle="Create, update, activate/deactivate, and delete dashboard users."
      action={<Badge type="blue">Admin Access</Badge>}
    >
      {message && (
        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {message}
        </div>
      )}

      <form
        onSubmit={saveUser}
        className="mb-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              {editingUserId ? "Edit User Account" : "Create User Account"}
            </h3>

            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Assign role and account status carefully.
            </p>
          </div>

          {editingUserId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <InputField
            value={form.first_name}
            onChange={(e) =>
              setForm({
                ...form,
                first_name: e.target.value,
              })
            }
            placeholder="First name"
          />

          <InputField
            value={form.last_name}
            onChange={(e) =>
              setForm({
                ...form,
                last_name: e.target.value,
              })
            }
            placeholder="Last name"
          />

          <InputField
            value={form.username}
            onChange={(e) =>
              setForm({
                ...form,
                username: e.target.value,
              })
            }
            placeholder="Username"
          />

          <InputField
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
            placeholder="Email"
          />

          <InputField
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
            placeholder={editingUserId ? "New password optional" : "Password"}
          />

          <select
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
              })
            }
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="OPERATOR">Operator</option>
            <option value="COMPANY_ADMIN">Company Admin</option>
            {isSuperAdmin && <option value="SUPER_ADMIN">SuperAdmin</option>}
          </select>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm({
                  ...form,
                  is_active: e.target.checked,
                })
              }
            />
            Active Account
          </label>

          <button
            disabled={saving}
            className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 lg:col-span-2"
          >
            {saving
              ? "Saving..."
              : editingUserId
                ? "Update User"
                : "Create User"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[880px] border-collapse bg-white">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                User
              </th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                Email
              </th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                Role
              </th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {loadingUsers ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-sm font-bold text-slate-500"
                >
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-sm font-bold text-slate-500"
                >
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-4">
                    <p className="text-sm font-black text-slate-950">
                      {user.full_name || user.username}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      @{user.username}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    {user.email || "Not provided"}
                  </td>

                  <td className="px-4 py-4">
                    <Badge type={user.role === "OPERATOR" ? "slate" : "blue"}>
                      {user.role_label}
                    </Badge>
                  </td>

                  <td className="px-4 py-4">
                    <Badge type={user.is_active ? "green" : "red"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteUser(user)}
                        disabled={user.id === currentUser.id}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [activity, setActivity] = useState([]);
  const [relayActivity, setRelayActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoading, setOffLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [notice, setNotice] = useState("");

  const previousRelayStateRef = useRef(null);
  const firstLoadRef = useRef(true);
  const latestRelayActivityIdRef = useRef(null);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setLoading(false);
  };

  const getBangladeshTime = () => {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const logout = async () => {
    try {
      await api.get("/auth/csrf/");
      await api.post("/auth/logout/");
    } catch {
      // Ignore logout API failure
    } finally {
      setCurrentUser(null);
      setStatus(null);
      setActivity([]);
      setRelayActivity([]);
      setPendingCommand(null);
      setNotice("");
      latestRelayActivityIdRef.current = null;
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      await api.get("/auth/csrf/");

      const response = await api.get("/auth/me/");

      setCurrentUser(response.data.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelayActivity = async () => {
    if (!currentUser) {
      return;
    }

    try {
      const response = await api.get("/relay-activity/");

      const list = response.data.relay_activity || [];
      const latest = list[0];

      if (latest) {
        if (latestRelayActivityIdRef.current === null) {
          latestRelayActivityIdRef.current = latest.id;
        } else if (latestRelayActivityIdRef.current !== latest.id) {
          latestRelayActivityIdRef.current = latest.id;

          if (latest.is_manual && latest.status === "confirmed") {
            setNotice(
              latest.action === "on"
                ? "Manual button turned ON the relay device."
                : "Manual button turned OFF the relay device.",
            );
          }
        }
      }

      setRelayActivity(list);
    } catch {
      // Keep previous relay activity if request fails
    }
  };

  const fetchStatus = async () => {
    if (!currentUser) {
      return;
    }

    try {
      const response = await api.get("/status/");

      const result = response.data;

      setStatus(result);

      const currentRelayState = result?.relay_state;
      const previousRelayState = previousRelayStateRef.current;
      const validRelayState =
        currentRelayState === "on" || currentRelayState === "off";

      if (firstLoadRef.current) {
        previousRelayStateRef.current = validRelayState
          ? currentRelayState
          : null;
        firstLoadRef.current = false;
      } else {
        if (pendingCommand === "on" && currentRelayState === "on") {
          setPendingCommand(null);
          setNotice("Device turned ON successfully.");
        } else if (pendingCommand === "off" && currentRelayState === "off") {
          setPendingCommand(null);
          setNotice("Device turned OFF successfully.");
        } else if (
          !pendingCommand &&
          result?.system_online &&
          validRelayState &&
          previousRelayState &&
          previousRelayState !== currentRelayState
        ) {
          if (currentRelayState === "on") {
            setNotice("Device turned ON successfully.");
          } else {
            setNotice("Device turned OFF successfully.");
          }
        }

        if (validRelayState) {
          previousRelayStateRef.current = currentRelayState;
        }
      }

      const row = {
        id: Date.now(),
        time: getBangladeshTime(),
        system: result.system_online ? "Online" : "Offline",
        pressure: result.pressure_text || "Waiting for data",
        relay: result.relay_text || "Unknown",
      };

      setActivity((previous) => [row, ...previous].slice(0, MAX_ACTIVITY));
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setCurrentUser(null);
        return;
      }

      setStatus({
        api_success: false,
        system_online: false,
        system_status_text: "System Offline",
        pressure_status: "unknown",
        pressure_text: "Waiting for data",
        relay_state: "unknown",
        relay_text: "Unknown",
        relay_is_on: false,
        last_update: "Not available",
        message: "Unable to connect to the system.",
      });
    }
  };

  const turnOnDevice = async () => {
    try {
      setNotice("");
      setOnLoading(true);
      setPendingCommand("on");

      await api.get("/auth/csrf/");

      const response = await api.post("/device/on/", {});

      if (!response.data.api_success) {
        setPendingCommand(null);
        setNotice("Unable to turn ON the device. Please try again.");
      }

      setTimeout(() => {
        fetchStatus();
        fetchRelayActivity();
      }, 700);
    } catch (error) {
      setPendingCommand(null);
      setNotice(
        error?.response?.data?.message ||
          "Unable to turn ON the device. Please try again.",
      );
    } finally {
      setOnLoading(false);
    }
  };

  const turnOffDevice = async () => {
    try {
      setNotice("");
      setOffLoading(true);
      setPendingCommand("off");

      await api.get("/auth/csrf/");

      const response = await api.post("/device/off/", {});

      if (!response.data.api_success) {
        setPendingCommand(null);
        setNotice("Unable to turn OFF the device. Please try again.");
      }

      setTimeout(() => {
        fetchStatus();
        fetchRelayActivity();
      }, 700);
    } catch (error) {
      setPendingCommand(null);
      setNotice(
        error?.response?.data?.message ||
          "Unable to turn OFF the device. Please try again.",
      );
    } finally {
      setOffLoading(false);
    }
  };

  const resetSystem = async () => {
    try {
      setResetLoading(true);
      setPendingCommand(null);
      setNotice("");

      await api.get("/auth/csrf/");

      const response = await api.post("/device/reset/", {});

      setStatus(response.data);
      setActivity([]);
      setNotice("System data has been reset.");

      previousRelayStateRef.current = null;
      firstLoadRef.current = true;
    } catch (error) {
      setNotice(
        error?.response?.data?.message || "Unable to reset system data.",
      );
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchStatus();
    fetchRelayActivity();

    const interval = setInterval(() => {
      fetchStatus();
      fetchRelayActivity();
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser, pendingCommand]);

  const computed = useMemo(() => {
    const systemOnline = status?.system_online === true;
    const pressureStatus = status?.pressure_status || "unknown";
    const relayIsOn = status?.relay_is_on === true;
    const waiting = pendingCommand !== null;

    return {
      systemOnline,
      pressureStatus,
      relayIsOn,
      waiting,
      pressureCardType:
        pressureStatus === "normal"
          ? "green"
          : pressureStatus === "low"
            ? "red"
            : "amber",
      relayCardType: !systemOnline ? "slate" : relayIsOn ? "green" : "red",
      systemCardType: systemOnline ? "green" : "red",
    };
  }, [status, pendingCommand]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#edf2f7] px-5 py-10">
        <div className="mx-auto mt-24 max-w-sm rounded-[28px] bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <h2 className="text-xl font-black text-slate-950">
            Loading Dashboard
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Checking secure session.
          </p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  const {
    systemOnline,
    pressureStatus,
    relayIsOn,
    waiting,
    pressureCardType,
    relayCardType,
    systemCardType,
  } = computed;

  const userHasAllAccess = currentUser?.all_access === true;

  const turnOnDisabled =
    !systemOnline || waiting || relayIsOn || onLoading || offLoading;

  const turnOffDisabled =
    !systemOnline || waiting || !relayIsOn || onLoading || offLoading;

  const guideText = !systemOnline
    ? "The system is offline. Please check ESP32 power, WiFi, and MQTT connection."
    : waiting
      ? "A command has already been sent. Wait for confirmation before sending another command."
      : relayIsOn
        ? "The connected device is ON. Press OFF to stop it."
        : "The connected device is OFF. Press ON to start it.";

  return (
    <main className="min-h-screen bg-[#edf2f7]">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white px-5 py-6 lg:block">
          <div className="mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
              PMS
            </div>

            <h1 className="mt-4 text-xl font-black leading-tight text-slate-950">
              Pressure Monitoring System
            </h1>

            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Secure operations console for live pressure monitoring.
            </p>
          </div>

          <nav className="space-y-2">
            <SidebarItem
              active
              href="#overview"
              label="Overview"
              subtext="Live status and system summary"
            />

            <SidebarItem
              href="#control"
              label="Device Control"
              subtext="Safe relay ON/OFF operation"
            />

            <SidebarItem
              href="#activity"
              label="Activity Log"
              subtext="Recent dashboard updates"
            />

            <SidebarItem
              href="#relay-history"
              label="Relay History"
              subtext="Who controlled the device"
            />

            {userHasAllAccess && (
              <SidebarItem
                href="#users"
                label="User Management"
                subtext="Admin CRUD operations"
              />
            )}
          </nav>

          <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Current User
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white">
                {getInitials(currentUser)}
              </div>

              <div>
                <p className="text-sm font-black text-slate-950">
                  {currentUser.full_name || currentUser.username}
                </p>

                <p className="text-xs font-semibold text-slate-500">
                  {currentUser.role_label}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              {userHasAllAccess
                ? "Full dashboard and user management access enabled."
                : "Operator access: observe and ON/OFF control only."}
            </p>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge type="dark">Secure Session</Badge>

                  <Badge type={systemOnline ? "green" : "red"}>
                    {systemOnline ? "System Online" : "System Offline"}
                  </Badge>

                  <Badge type={userHasAllAccess ? "blue" : "slate"}>
                    {currentUser.role_label}
                  </Badge>
                </div>

                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Smart Pressure Dashboard
                </h2>

                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  Monitor pressure, view system health, control the connected
                  device, and manage authorized users.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
                    {getInitials(currentUser)}
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {currentUser.full_name || currentUser.username}
                    </p>

                    <p className="text-xs font-semibold text-slate-500">
                      {currentUser.email || "No email"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {notice && (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
                {notice}
              </div>
            )}

            {waiting && (
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                <span className="h-3 w-3 animate-pulse rounded-full bg-amber-500" />
                Command sent. Waiting for device confirmation...
              </div>
            )}

            <section
              id="overview"
              className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4"
            >
              <MetricCard
                label="System"
                value={status?.system_status_text || "System Offline"}
                helper={
                  systemOnline
                    ? "Live data is being received."
                    : "No recent device data received."
                }
                status={systemCardType}
                code="SYS"
              />

              <MetricCard
                label="Pressure"
                value={status?.pressure_text || "Waiting for data"}
                helper={
                  pressureStatus === "normal"
                    ? "Pressure condition is normal."
                    : pressureStatus === "low"
                      ? "Low pressure detected."
                      : "Waiting for sensor data."
                }
                status={pressureCardType}
                code="PRS"
              />

              <MetricCard
                label="Device"
                value={status?.relay_text || "Unknown"}
                helper={
                  !systemOnline
                    ? "Device state unavailable."
                    : relayIsOn
                      ? "Connected device is running."
                      : "Connected device is stopped."
                }
                status={relayCardType}
                code="DEV"
              />

              <MetricCard
                label="Last Update"
                value={status?.last_update || "Not available"}
                helper="Latest confirmed system update."
                status="blue"
                code="UPD"
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr]">
              <SectionCard
                id="control"
                title="Device Control"
                subtitle="Use these controls to operate the relay-connected device."
                action={
                  <Badge
                    type={relayIsOn ? "green" : systemOnline ? "red" : "slate"}
                  >
                    {systemOnline
                      ? status?.relay_text || "Unknown"
                      : "Unavailable"}
                  </Badge>
                }
              >
                <div
                  className={classNames(
                    "mb-5 rounded-[24px] border p-5",
                    !systemOnline
                      ? "border-slate-200 bg-slate-50"
                      : relayIsOn
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-red-200 bg-red-50",
                  )}
                >
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Action Guide
                  </p>

                  <h3 className="mt-2 text-2xl font-black text-slate-950">
                    {!systemOnline
                      ? "System Offline"
                      : relayIsOn
                        ? "Device is ON"
                        : "Device is OFF"}
                  </h3>

                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    {guideText}
                  </p>
                </div>

                <div className="grid gap-3">
                  <PrimaryButton
                    variant="green"
                    onClick={turnOnDevice}
                    disabled={turnOnDisabled}
                    loading={onLoading}
                  >
                    Turn ON Device
                  </PrimaryButton>

                  <PrimaryButton
                    variant="red"
                    onClick={turnOffDevice}
                    disabled={turnOffDisabled}
                    loading={offLoading}
                  >
                    Turn OFF Device
                  </PrimaryButton>

                  {userHasAllAccess && (
                    <PrimaryButton
                      variant="dark"
                      onClick={resetSystem}
                      disabled={resetLoading || waiting}
                      loading={resetLoading}
                    >
                      Reset Display Data
                    </PrimaryButton>
                  )}

                  {!userHasAllAccess && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">
                      Operator permission: observe pressure and control ON/OFF
                      only. Reset and user management are hidden.
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="System Explanation"
                subtitle="A clear professional summary for beginner users."
                action={
                  <Badge type={systemOnline ? "green" : "red"}>
                    {systemOnline ? "Healthy" : "Needs Check"}
                  </Badge>
                }
              >
                <div className="grid gap-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          Connection Status
                        </p>

                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                          Shows whether recent data is being received from the
                          device.
                        </p>
                      </div>

                      <Badge type={systemOnline ? "green" : "red"}>
                        {systemOnline ? "Receiving Data" : "No Recent Data"}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          Pressure Condition
                        </p>

                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                          Normal means pressure is okay. Low means the system
                          needs checking.
                        </p>
                      </div>

                      <Badge
                        type={
                          pressureStatus === "normal"
                            ? "green"
                            : pressureStatus === "low"
                              ? "red"
                              : "amber"
                        }
                      >
                        {status?.pressure_text || "Waiting"}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          Connected Device
                        </p>

                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                          This is the relay-connected device, not ESP32 power.
                        </p>
                      </div>

                      <Badge type={relayIsOn ? "green" : "red"}>
                        {status?.relay_text || "Unknown"}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-black text-blue-900">
                      System Message
                    </p>

                    <p className="mt-1 text-sm font-bold leading-6 text-blue-700">
                      {status?.message || "System status is not available."}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </section>

            <section className="mb-6">
              <SectionCard
                id="activity"
                title="Recent Activity"
                subtitle="Latest dashboard refresh history in Bangladesh local time."
                action={<Badge type="blue">Auto Refresh</Badge>}
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Time
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          System
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Pressure
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Device
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {activity.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                          >
                            No activity yet
                          </td>
                        </tr>
                      ) : (
                        activity.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                              {row.time}
                            </td>

                            <td className="px-4 py-4">
                              <Badge
                                type={row.system === "Online" ? "green" : "red"}
                              >
                                {row.system}
                              </Badge>
                            </td>

                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                              {row.pressure}
                            </td>

                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                              {row.relay}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </section>

            <section className="mb-6">
              <SectionCard
                id="relay-history"
                title="Relay Control History"
                subtitle="Everyone can see who turned the relay device ON/OFF and when it happened."
                action={<Badge type="blue">Visible to All Roles</Badge>}
              >
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[850px] border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Time
                        </th>

                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          User / Source
                        </th>

                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Role
                        </th>

                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Action
                        </th>

                        <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {relayActivity.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                          >
                            No relay activity yet
                          </td>
                        </tr>
                      ) : (
                        relayActivity.map((item) => (
                          <tr
                            key={item.id}
                            className={classNames(
                              "border-t border-slate-100 hover:bg-slate-50",
                              item.is_manual ? "bg-amber-50/70" : "",
                            )}
                          >
                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                              {item.confirmed_at_display !== "Not available"
                                ? item.confirmed_at_display
                                : item.requested_at_display}
                            </td>

                            <td className="px-4 py-4">
                              <p className="text-sm font-black text-slate-950">
                                {item.actor_name}
                              </p>

                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {item.is_manual
                                  ? "Manual Button Press"
                                  : item.source_text}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <Badge
                                type={
                                  item.is_manual
                                    ? "amber"
                                    : item.actor_role === "Operator"
                                      ? "slate"
                                      : "blue"
                                }
                              >
                                {item.is_manual
                                  ? "Manual Device Button"
                                  : item.actor_role || "Device"}
                              </Badge>
                            </td>

                            <td className="px-4 py-4">
                              <Badge
                                type={item.action === "on" ? "green" : "red"}
                              >
                                {item.action_text}
                              </Badge>
                            </td>

                            <td className="px-4 py-4">
                              <Badge
                                type={
                                  item.status === "confirmed"
                                    ? "green"
                                    : item.status === "failed"
                                      ? "red"
                                      : "amber"
                                }
                              >
                                {item.status_text}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </section>

            {userHasAllAccess && (
              <section className="mb-6">
                <UserManagementPanel currentUser={currentUser} />
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
    