import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000";

export const TOKEN_KEYS = {
  student: "am_student_token",
  interviewer: "am_interviewer_token",
};

export const USER_KEYS = {
  student: "am_student_user",
  interviewer: "am_interviewer_user",
};

export function getToken(role) {
  return localStorage.getItem(TOKEN_KEYS[role]) || "";
}

export function setAuth(role, token, username) {
  localStorage.setItem(TOKEN_KEYS[role], token);
  localStorage.setItem(USER_KEYS[role], username || "");
}

export function clearAuth() {
  Object.values(TOKEN_KEYS).forEach((k) =>
    localStorage.removeItem(k)
  );

  Object.values(USER_KEYS).forEach((k) =>
    localStorage.removeItem(k)
  );
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
      clearAuth();
    }

    return Promise.reject(error);
  }
);

export default api;
