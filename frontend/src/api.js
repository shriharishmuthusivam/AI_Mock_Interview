import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000";

export const TOKEN_KEYS = {
  student: "am_student_token",
  interviewer: "am_interviewer_token",
  admin: "am_admin_token",
};

export const USER_KEYS = {
  student: "am_student_user",
  interviewer: "am_interviewer_user",
  admin: "am_admin_user",
};

export const STUDENT_CLASS_KEY = "am_student_class";

export function getToken(role) {
  return localStorage.getItem(TOKEN_KEYS[role]) || "";
}

export function setAuth(role, token, username) {
  localStorage.setItem(TOKEN_KEYS[role], token);
  localStorage.setItem(USER_KEYS[role], username || "");
}

export function setStudentClass(className) {
  localStorage.setItem(STUDENT_CLASS_KEY, className || "");
}

export function getStudentClass() {
  return localStorage.getItem(STUDENT_CLASS_KEY) || "";
}

export function clearAuth() {
  Object.values(TOKEN_KEYS).forEach((k) =>
    localStorage.removeItem(k)
  );

  Object.values(USER_KEYS).forEach((k) =>
    localStorage.removeItem(k)
  );

  localStorage.removeItem(STUDENT_CLASS_KEY);
}

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const role = config.authRole;

  if (role) {
    const token = getToken(role);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear the session for the role that actually got the 401, so
      // one expired student call does not log the interviewer out too.
      const role = error.config?.authRole;

      if (role && TOKEN_KEYS[role]) {
        localStorage.removeItem(TOKEN_KEYS[role]);
        localStorage.removeItem(USER_KEYS[role]);

        if (role === "student") {
          localStorage.removeItem(STUDENT_CLASS_KEY);
        }
      } else {
        clearAuth();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
