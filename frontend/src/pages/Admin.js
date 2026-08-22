import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import AnimatedBackground from "../components/AnimatedBackground";
import ConfirmModal from "../components/ConfirmModal";
import GlassCard from "../components/GlassCard";
import GradientButton from "../components/GradientButton";
import TextField from "../components/TextField";
import { useToast } from "../components/Toast";
import api, { USER_KEYS } from "../api";
import { colors, fonts, gradients, radius } from "../styles/theme";

function Admin({ onLogout }) {
  const toast = useToast();

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [interviewers, setInterviewers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);

  const [dialog, setDialog] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [iv, st] = await Promise.all([
        api.get("/api/admin/interviewers", { authRole: "admin" }),
        api.get("/api/admin/students", { authRole: "admin" }),
      ]);

      setInterviewers(iv.data.interviewers);
      setStudents(st.data.students);
    } catch (error) {
      toastRef.current.error(
        error.response?.data?.message || "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createInterviewer = async () => {
    if (username.trim().length < 3) {
      toast.warning("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }

    try {
      const response = await api.post(
        "/api/admin/interviewers",
        {
          username,
          email,
          password,
          makeAdmin,
        },
        { authRole: "admin" }
      );

      toast.success(response.data.message);

      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMakeAdmin(false);

      loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to create interviewer"
      );
    }
  };

  const adminUsername = localStorage.getItem(USER_KEYS.admin) || "";

  const resetStudentPassword = (student) => {
    setNewPassword("");
    setDialog({ kind: "resetPassword", item: student });
  };

  const deleteInterviewer = (interviewer) => {
    if (interviewer.username === adminUsername) {
      toast.warning("You cannot delete your own account");
      return;
    }

    setDialog({ kind: "deleteInterviewer", item: interviewer });
  };

  const deleteStudent = (student) => {
    setDialog({ kind: "deleteStudent", item: student });
  };

  const confirmDialog = async () => {
    if (!dialog) return;

    setDeleting(true);

    try {
      let response;

      if (dialog.kind === "deleteInterviewer") {
        response = await api.delete(
          `/api/admin/interviewers/${dialog.item._id}`,
          { authRole: "admin" }
        );

        toast.success(response.data.message);
      } else if (dialog.kind === "deleteStudent") {
        response = await api.delete(
          `/api/admin/students/${dialog.item._id}`,
          { authRole: "admin" }
        );

        toast.success(response.data.message);
      } else {
        response = await api.post(
          `/api/admin/students/${dialog.item._id}/reset-password`,
          { password: newPassword },
          { authRole: "admin" }
        );

        toast.success(
          `Password updated — new password for ${response.data.username} is "${response.data.plainPassword}"`
        );
      }

      setDialog(null);

      loadData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Action failed"
      );
    } finally {
      setDeleting(false);
    }
  };

  const dialogProps = dialog
    ? (() => {
        if (dialog.kind === "deleteInterviewer") {
          return {
            title: "Delete interviewer",
            message: `Delete interviewer "${dialog.item.username}"? This cannot be undone.`,
            icon: "🗑️",
            confirmLabel: "Delete",
            tone: "danger",
          };
        }

        if (dialog.kind === "deleteStudent") {
          return {
            title: "Delete student",
            message: `Delete student "${dialog.item.username}"? Their interview history is kept, but the account will no longer log in.`,
            icon: "🗑️",
            confirmLabel: "Delete",
            tone: "danger",
          };
        }

        return {
          title: "Reset password",
          message: `Set a new password for ${dialog.item.username}.`,
          icon: "🔑",
          confirmLabel: "Reset",
          tone: "accent",
          inputLabel: "New password",
          inputValue: newPassword,
          onInputChange: setNewPassword,
        };
      })()
    : {};

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString() : "—";

  return (
    <AnimatedBackground>
      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={styles.page}
        >
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>🛡️ Admin Panel</h1>
              <p style={styles.subtitle}>
                Create interviewer accounts and manage student credentials.
              </p>
            </div>

            <button onClick={onLogout} style={styles.logout}>
              Logout
            </button>
          </div>

          <div style={styles.columns}>
            <GlassCard style={styles.leftCol}>
              <h2 style={styles.sectionTitle}>Create Interviewer</h2>

              <TextField
                label="Username"
                placeholder="Enter username"
                icon="👤"
                value={username}
                onChange={setUsername}
              />

              <TextField
                label="Email (optional)"
                placeholder="Enter email"
                icon="📧"
                value={email}
                onChange={setEmail}
              />

              <TextField
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                icon="🔒"
                value={password}
                onChange={setPassword}
              />

              <TextField
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                icon="🔒"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={makeAdmin}
                  onChange={(e) => setMakeAdmin(e.target.checked)}
                />
                Grant admin access
              </label>

              <GradientButton
                onClick={createInterviewer}
                gradient={gradients.accent}
                style={{ width: "100%", marginTop: 6 }}
              >
                Create Interviewer
              </GradientButton>

              <div style={styles.warnBox}>
                Existing accounts created before this feature store only a
                hashed password, so their password column shows "—". Use the
                reset option to set a new one.
              </div>
            </GlassCard>

            <div style={styles.rightCol}>
              <GlassCard style={styles.tableCard}>
                <h2 style={styles.sectionTitle}>Interviewers</h2>

                {loading ? (
                  <p style={styles.loading}>Loading…</p>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Username</th>
                          <th style={styles.th}>Email</th>
                          <th style={styles.th}>Role</th>
                          <th style={styles.th}>Password</th>
                          <th style={styles.th}>Created</th>
                          <th style={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {interviewers.map((iv) => (
                          <tr key={iv._id}>
                            <td style={styles.td}>{iv.username}</td>
                            <td style={styles.td}>{iv.email || "—"}</td>
                            <td style={styles.td}>
                              <span
                                style={
                                  iv.role === "admin"
                                    ? styles.roleAdmin
                                    : styles.roleInterviewer
                                }
                              >
                                {iv.role}
                              </span>
                            </td>
                            <td style={styles.td}>{iv.plainPassword || "—"}</td>
                            <td style={styles.td}>{formatDate(iv.createdAt)}</td>
                            <td style={styles.td}>
                              <button
                                onClick={() => deleteInterviewer(iv)}
                                disabled={iv.username === adminUsername}
                                style={
                                  iv.username === adminUsername
                                    ? styles.deleteBtnDisabled
                                    : styles.deleteBtn
                                }
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

              <GlassCard style={styles.tableCard}>
                <h2 style={styles.sectionTitle}>Students</h2>

                {loading ? (
                  <p style={styles.loading}>Loading…</p>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Username</th>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Class</th>
                          <th style={styles.th}>Password</th>
                          <th style={styles.th}>Created</th>
                          <th style={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s) => (
                          <tr key={s._id}>
                            <td style={styles.td}>{s.username}</td>
                            <td style={styles.td}>{s.name || "—"}</td>
                            <td style={styles.td}>{s.className || "—"}</td>
                            <td style={styles.td}>{s.plainPassword || "—"}</td>
                            <td style={styles.td}>{formatDate(s.createdAt)}</td>
                            <td style={styles.td}>
                              <div style={styles.actions}>
                                <button
                                  onClick={() => resetStudentPassword(s)}
                                  style={styles.resetBtn}
                                >
                                  Reset
                                </button>
                                <button
                                  onClick={() => deleteStudent(s)}
                                  style={styles.deleteBtn}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        </motion.div>
      </div>

      <ConfirmModal
        open={!!dialog}
        title={dialogProps.title}
        message={dialogProps.message}
        icon={dialogProps.icon}
        confirmLabel={dialogProps.confirmLabel}
        tone={dialogProps.tone}
        inputLabel={dialogProps.inputLabel}
        inputValue={dialogProps.inputValue}
        onInputChange={dialogProps.onInputChange}
        confirmDisabled={
          dialog?.kind === "resetPassword" && newPassword.length < 6
        }
        loading={deleting}
        onConfirm={confirmDialog}
        onCancel={() => setDialog(null)}
      />
    </AnimatedBackground>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "30px 24px",
    fontFamily: fonts.family,
  },

  page: {
    maxWidth: 1100,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    gap: 16,
    flexWrap: "wrap",
  },

  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: 800,
    margin: "0 0 4px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    margin: 0,
  },

  logout: {
    background: "rgba(239,68,68,0.15)",
    border: `1px solid ${colors.danger}`,
    color: colors.dangerLight,
    padding: "10px 20px",
    borderRadius: radius.pill,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
  },

  columns: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 380px) 1fr",
    gap: 20,
    alignItems: "start",
  },

  leftCol: {
    padding: "24px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 6px",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: colors.textMuted,
    fontSize: 14,
    cursor: "pointer",
    marginTop: 2,
  },

  warnBox: {
    background: "rgba(245,158,11,0.1)",
    border: `1px solid rgba(245,158,11,0.35)`,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 1.5,
    padding: "10px 12px",
    borderRadius: radius.sm,
  },

  tableCard: {
    padding: "22px",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  th: {
    textAlign: "left",
    color: colors.textMuted,
    fontWeight: 600,
    padding: "8px 10px",
    borderBottom: `1px solid ${colors.border}`,
  },

  td: {
    textAlign: "left",
    color: colors.text,
    padding: "8px 10px",
    borderBottom: `1px solid ${colors.border}`,
  },

  roleAdmin: {
    background: "rgba(124,58,237,0.2)",
    color: "#c4b5fd",
    padding: "2px 10px",
    borderRadius: radius.pill,
    fontSize: 12,
  },

  roleInterviewer: {
    background: "rgba(34,211,238,0.12)",
    color: colors.accent,
    padding: "2px 10px",
    borderRadius: radius.pill,
    fontSize: 12,
  },

  resetBtn: {
    background: "rgba(37,99,235,0.15)",
    border: `1px solid ${colors.primary}`,
    color: colors.primaryLight,
    padding: "5px 12px",
    borderRadius: radius.sm,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: fonts.family,
    whiteSpace: "nowrap",
  },

  deleteBtn: {
    background: "rgba(239,68,68,0.15)",
    border: `1px solid ${colors.danger}`,
    color: colors.dangerLight,
    padding: "5px 12px",
    borderRadius: radius.sm,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: fonts.family,
    whiteSpace: "nowrap",
    opacity: 1,
  },

  deleteBtnDisabled: {
    background: "rgba(239,68,68,0.15)",
    border: `1px solid ${colors.danger}`,
    color: colors.dangerLight,
    padding: "5px 12px",
    borderRadius: radius.sm,
    cursor: "not-allowed",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: fonts.family,
    whiteSpace: "nowrap",
    opacity: 0.4,
  },

  actions: {
    display: "flex",
    gap: 8,
    whiteSpace: "nowrap",
  },

  loading: {
    color: colors.textMuted,
    fontSize: 14,
  },
};

export default Admin;
