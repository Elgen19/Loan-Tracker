import { auth } from "./firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
}

export function fetchLoans() {
  return request("/loans");
}

export function fetchContainers() {
  return request("/containers");
}

export function createContainer(payload) {
  return request("/containers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createLoan(payload) {
  return request("/loans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLoan(loanId, payload) {
  return request(`/loans/${loanId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteLoan(loanId) {
  return request(`/loans/${loanId}`, {
    method: "DELETE",
  });
}

export function addPayment(loanId, payload) {
  return request(`/loans/${loanId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function claimLegacyData() {
  return request("/auth/claim-legacy-data", {
    method: "POST",
  });
}
