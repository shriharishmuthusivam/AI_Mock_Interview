import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import CountUp from "../components/CountUp";
import { useToast } from "../components/Toast";
import { clearAuth } from "../api";
import api from "../api";
import { colors, fonts, gradients, radius } from "../styles/theme";

const SUBJECT_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#22d3ee",
  "#22c55e",
  "#f59e0b",
];

function Skeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={styles.skeletonRow}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            ...styles.skeletonBlock,
            width: i === 3 ? "40%" : "18%",
          }}
        />
      ))}
    </motion.div>
  );
}

function Dashboard({ onLogout }) {
  const navigate = useNavigate();

  const toast = useToast();

  const [startingLive, setStartingLive] = useState(false);

  const [interviews, setInterviews] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [query, setQuery] = useState("");

  const [sort, setSort] = useState("newest");

  useEffect(() => {
    fetchInterviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInterviews = async () => {
    setLoading(true);

    try {
      const response = await api.get(
        "/api/interviews",
        { authRole: "interviewer" }
      );

      setInterviews(response.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();

    if (onLogout) onLogout();

    navigate("/");
  };

  const handleStartLive = async () => {
    if (startingLive) return;

    setStartingLive(true);

    try {
      const response = await api.post(
        "/api/live/create",
        {},
        { authRole: "interviewer" }
      );

      navigate(`/live/${response.data.code}`);
    } catch (error) {
      console.log(error);

      toast.error(
        error.response?.data?.message ||
          "Could not start a live session. Please check the backend connection."
      );
    } finally {
      setStartingLive(false);
    }
  };

  const stats = useMemo(() => {
    const total = interviews.length;

    const avg =
      total > 0
        ? (
            interviews.reduce(
              (acc, i) =>
                acc + (i.score || 0),
              0
            ) / total
          ).toFixed(1)
        : 0;

    const classes = new Set(
      interviews.map((i) => i.className || "Unassigned")
    ).size;

    return { total, avg, classes };
  }, [interviews]);

  const distribution = useMemo(() => {
    const map = {};

    interviews.forEach((i) => {
      const key = i.className || "Unassigned";
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map).sort(
      (a, b) => b[1] - a[1]
    );
  }, [interviews]);

  const trend = useMemo(
    () => [...interviews].slice(0, 10).reverse(),
    [interviews]
  );

  const rows = useMemo(() => {
    let list = interviews.filter(
      (i) =>
        i.studentUsername
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        (i.className || "")
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        (i.question || "")
          .toLowerCase()
          .includes(query.toLowerCase())
    );

    if (sort === "high") {
      list = [...list].sort(
        (a, b) => (b.score || 0) - (a.score || 0)
      );
    } else if (sort === "low") {
      list = [...list].sort(
        (a, b) => (a.score || 0) - (b.score || 0)
      );
    } else {
      list = [...list].reverse();
    }

    return list;
  }, [interviews, query, sort]);

  const maxDist =
    distribution.length > 0
      ? distribution[0][1]
      : 1;

  return (
    <div style={styles.page}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.header}
      >
        <h1 style={styles.title}>Interviewer Dashboard</h1>

        <p style={styles.subtitle}>
          Monitor your students' interview performance and analytics
        </p>

        <div style={styles.headerActions}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>
            ← Back
          </button>

          <button
            onClick={() => navigate("/setup")}
            style={styles.manageBtn}
          >
            ⚙️ Manage Students & Syllabus
          </button>

          <button
            onClick={handleStartLive}
            style={styles.liveBtn}
            disabled={startingLive}
          >
            {startingLive ? "Starting..." : "🎥 Start Live Video Interview"}
          </button>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </motion.div>

      {/* Analytics Cards */}
      <div style={styles.cardContainer}>
        {[
          {
            icon: "🗒",
            label: "Total Interviews",
            value: stats.total,
            decimals: 0,
          },
          {
            icon: "⭐",
            label: "Average Score",
            value: stats.avg,
            decimals: 1,
          },
          {
            icon: "📚",
            label: "Classes Covered",
            value: stats.classes,
            decimals: 0,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            whileHover={{ y: -6 }}
            style={styles.analyticsCard}
          >
            <span style={styles.cardIcon}>{card.icon}</span>

            <h2 style={styles.cardLabel}>{card.label}</h2>

            <p style={styles.cardValue}>
              {loading ? (
                "—"
              ) : (
                <CountUp
                  value={Number(card.value)}
                  decimals={card.decimals}
                />
              )}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div style={styles.chartRow}>
        {/* Subject distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={styles.chartCard}
        >
          <h3 style={styles.chartTitle}>Interviews by Class</h3>

          {distribution.length === 0 && !loading && (
            <p style={styles.emptyText}>No data yet</p>
          )}

          <div style={styles.distList}>
            {distribution.map(([subject, count], idx) => (
              <div key={subject} style={styles.distItem}>
                <span style={styles.distLabel}>{subject}</span>

                <div style={styles.distTrack}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(count / maxDist) * 100}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      ...styles.distFill,
                      background: SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
                    }}
                  />
                </div>

                <span style={styles.distCount}>{count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent scores trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={styles.chartCard}
        >
          <h3 style={styles.chartTitle}>Recent Scores</h3>

          {trend.length === 0 && !loading && (
            <p style={styles.emptyText}>No data yet</p>
          )}

          <div style={styles.trendList}>
            {trend.map((item, idx) => {
              const pct = Math.max((item.score || 0) / 10, 0.04);

              return (
                <div key={idx} style={styles.trendItem}>
                  <span style={styles.trendBar}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${pct * 100}%` }}
                      transition={{ duration: 0.7, delay: idx * 0.05 }}
                      style={{
                        ...styles.trendFill,
                        background:
                          item.score >= 7
                            ? gradients.success
                            : gradients.danger,
                      }}
                    />
                  </span>

                  <span style={styles.trendScore}>
                    {item.score || 0}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        style={styles.tableCard}
      >
        <div style={styles.tableToolbar}>
          <input
            type="text"
            placeholder="Search student or subject..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.search}
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={styles.select}
          >
            <option value="newest">Newest first</option>
            <option value="high">Score: High to Low</option>
            <option value="low">Score: Low to High</option>
          </select>
        </div>

        {loading ? (
          <div>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p style={styles.emptyState}>
            {query
              ? "No results match your search."
              : "No interviews recorded yet. Ask a student to take an interview."}
          </p>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Question</th>
                  <th>Score</th>
                  <th>Violations</th>
                  <th>Feedback</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((item, index) => (
                  <motion.tr
                    key={`${item._id || index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    style={styles.row}
                  >
                    <td style={styles.td}>
                      <span style={styles.studentCell}>
                        <span style={styles.avatarDot}>
                          {item.studentUsername
                            ? item.studentUsername[0].toUpperCase()
                            : "?"}
                        </span>
                        {item.studentUsername}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span style={styles.subjectTag}>
                        {item.className || "Unassigned"}
                      </span>
                    </td>

                    <td style={{ ...styles.td, maxWidth: 260 }}>
                      <span style={styles.feedback}>
                        {item.question || "—"}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.scoreBadge,
                          background:
                            item.score >= 7
                              ? "rgba(34,197,94,0.15)"
                              : "rgba(239,68,68,0.15)",
                          color:
                            item.score >= 7 ? "#4ade80" : "#f87171",
                          border: `1px solid ${
                            item.score >= 7
                              ? "rgba(34,197,94,0.4)"
                              : "rgba(239,68,68,0.4)"
                          }`,
                        }}
                      >
                        {item.score || 0}/10
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.violationBadge,
                          color:
                            (item.violationCount || 0) > 0
                              ? "#fbbf24"
                              : colors.textMuted,
                        }}
                      >
                        {item.violationCount || 0}
                      </span>
                    </td>

                    <td style={{ ...styles.td, maxWidth: 280 }}>
                      <span style={styles.feedback}>
                        {item.feedback || "—"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "30px 24px 60px",
    fontFamily: fonts.family,
  },

  header: {
    marginBottom: 28,
    textAlign: "center",
  },

  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: 800,
    margin: "0 0 8px",
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    margin: 0,
  },

  logoutBtn: {
    marginTop: 14,
    padding: "9px 22px",
    borderRadius: radius.pill,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s, color 0.2s",
  },

  backBtn: {
    marginTop: 14,
    padding: "9px 22px",
    borderRadius: radius.pill,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  headerActions: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    marginTop: 14,
  },

  manageBtn: {
    padding: "9px 22px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.primary,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
  },

  liveBtn: {
    padding: "9px 22px",
    borderRadius: radius.pill,
    border: "none",
    background: gradients.success,
    color: "white",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.family,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
  },

  cardContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
    marginBottom: 28,
  },

  analyticsCard: {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: "22px 24px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
    cursor: "default",
  },

  cardIcon: {
    fontSize: 28,
  },

  cardLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: 600,
    margin: "12px 0 6px",
  },

  cardValue: {
    fontFamily: fonts.mono,
    fontSize: 36,
    fontWeight: 700,
    color: colors.accent,
    margin: 0,
  },

  chartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
    marginBottom: 28,
  },

  chartCard: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    padding: "20px 22px",
  },

  chartTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 18px",
  },

  distList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  distItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  distLabel: {
    width: 130,
    flexShrink: 0,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "right",
  },

  distTrack: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  distFill: {
    height: "100%",
    borderRadius: radius.pill,
  },

  distCount: {
    width: 22,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    textAlign: "right",
  },

  trendList: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    height: 150,
  },

  trendItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    height: "100%",
    justifyContent: "flex-end",
  },

  trendBar: {
    flex: 1,
    width: "100%",
    maxWidth: 34,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },

  trendFill: {
    width: "100%",
    borderRadius: 8,
  },

  trendScore: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },

  tableCard: {
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  tableToolbar: {
    display: "flex",
    gap: 12,
    padding: "16px 18px",
    borderBottom: `1px solid ${colors.border}`,
    flexWrap: "wrap",
  },

  search: {
    flex: 1,
    minWidth: 200,
    padding: "10px 14px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "rgba(255,255,255,0.06)",
    color: colors.text,
    fontFamily: fonts.family,
    fontSize: 14,
    outline: "none",
  },

  select: {
    padding: "10px 14px",
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: "#0f172a",
    color: colors.text,
    fontFamily: fonts.family,
    fontSize: 14,
    cursor: "pointer",
  },

  tableScroll: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 680,
  },

  row: {
    transition: "background 0.2s",
    cursor: "default",
  },

  td: {
    padding: "12px 16px",
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: 14,
    verticalAlign: "top",
  },

  studentCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(37,99,235,0.25)",
    color: colors.primaryLight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },

  subjectTag: {
    padding: "5px 12px",
    borderRadius: radius.pill,
    background: "rgba(124,58,237,0.15)",
    color: "#c084fc",
    fontSize: 13,
    fontWeight: 600,
  },

  scoreBadge: {
    padding: "6px 12px",
    borderRadius: radius.pill,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: fonts.mono,
  },

  violationBadge: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: 600,
  },

  feedback: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 1.4,
    display: "block",
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxHeight: 40,
  },

  skeletonRow: {
    display: "flex",
    gap: 24,
    padding: "18px",
    borderBottom: `1px solid ${colors.border}`,
  },

  skeletonBlock: {
    height: 16,
    borderRadius: 6,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
    backgroundSize: "200% 100%",
    animation: "skeletonShimmer 1.2s linear infinite",
  },

  emptyState: {
    padding: "40px 20px",
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 15,
    margin: 0,
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    padding: "20px 0",
    margin: 0,
  },
};

export default Dashboard;
