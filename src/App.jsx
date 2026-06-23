import { useEffect, useMemo, useState } from "react";

// --- Configuration & Constants ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "nexushr_access_token";
const today = new Date().toISOString().slice(0, 10);

const navItems = [
  { id: "dashboard", label: "Dashboard", mark: "D" },
  { id: "employees", label: "Employees", mark: "E", adminOnly: true },
  { id: "attendance", label: "Attendance", mark: "A" },
  { id: "payroll", label: "Payroll", mark: "P" },
  { id: "performance", label: "Performance", mark: "R" },
  { id: "insights", label: "Insights", mark: "I", adminOnly: true },
  { id: "notifications", label: "Notifications", mark: "N", adminOnly: true }
];

// --- Main App Component ---
function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [active, setActive] = useState("dashboard");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const api = useMemo(() => createApi(token), [token]);
  const userContext = useMemo(() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const roles = payload.roles || [];
      const isAdmin = roles.some(r => ["ADMIN", "ROLE_ADMIN", "HR"].includes(r));
      return { email: payload.sub, isEmployee: !isAdmin };
    } catch { return null; }
  }, [token]);

  const visibleNavItems = useMemo(() => userContext?.isEmployee ? navItems.filter(i => !i.adminOnly) : navItems, [userContext]);

  async function runAction(action, successText) {
    setLoading(true); setMessage("");
    try { const res = await action(); if (successText) setMessage(successText); return res; }
    catch (e) { setMessage(e.message); return null; }
    finally { setLoading(false); }
  }

  async function refreshEmployees() {
    if (!token) return;
    const data = await api.get("/api/v1/employees");
    setEmployees(Array.isArray(data) ? data : []);
  }

  useEffect(() => { if (token) refreshEmployees(); }, [token]);

  if (!token) return <LoginScreen onLogin={(t) => { setToken(t); localStorage.setItem(TOKEN_KEY, t); }} />;

  return (
      <div className="min-h-screen bg-panel flex">
        <aside className="w-64 bg-white border-r border-line hidden lg:block">
          <div className="p-6 border-b border-line"><h1 className="font-bold text-ink">NexusHR</h1></div>
          <nav className="p-3">
            {visibleNavItems.map(item => (
                <button key={item.id} className={`w-full p-3 text-left rounded ${active === item.id ? "bg-brand text-white" : "hover:bg-panel"}`} onClick={() => setActive(item.id)}>
                  {item.label}
                </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-8">
          {message && <div className="mb-4 p-3 bg-brand/10 text-brand rounded">{message}</div>}
          {active === "employees" && !userContext?.isEmployee && <Employees api={api} employees={employees} refresh={refreshEmployees} runAction={runAction} />}
        </main>
      </div>
  );
}

// --- Sub-Components ---
function Employees({ api, employees, refresh, runAction }) {
  const [securityRole, setSecurityRole] = useState({ employeeId: "", role: "EMPLOYEE" });

  async function removeEmployee(id) {
    if (!window.confirm("Permanently delete employee?")) return;
    await runAction(() => api.request("DELETE", `/api/v1/employees/${id}`), "Employee deleted.");
    refresh();
  }

  async function assignSecurityRole(e) {
    e.preventDefault();
    await runAction(() => api.put(`/api/v1/employees/${securityRole.employeeId}/security-role`, { role: securityRole.role }), "Role updated.");
    refresh();
  }

  return (
      <div className="space-y-6">
        <Panel title="Employee Directory">
          <DataTable columns={["Name", "Actions"]} rows={(employees || []).map(e => [
            `${e.firstName} ${e.lastName}`,
            <button className="text-coral font-bold" onClick={() => removeEmployee(e.id)}>Delete</button>
          ])} />
        </Panel>
        <Panel title="Assign Security Role">
          <form onSubmit={assignSecurityRole} className="space-y-3">
            <select className="field" onChange={(e) => setSecurityRole({...securityRole, employeeId: e.target.value})}>
              <option>Select Employee</option>
              {(employees || []).map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            <select className="field" onChange={(e) => setSecurityRole({...securityRole, role: e.target.value})}>
              {["EMPLOYEE", "MANAGER", "HR", "ADMIN"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-primary">Save Role</button>
          </form>
        </Panel>
      </div>
  );
}

// --- Helper UI Components ---
function Panel({ title, children }) { return <div className="bg-white border border-line p-4 rounded shadow-sm mb-4"><h3 className="font-bold mb-4">{title}</h3>{children}</div>; }
function DataTable({ columns, rows }) { return <table className="w-full text-left"><thead><tr>{columns.map(c => <th key={c} className="p-2 border-b text-xs uppercase text-muted">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="p-2 border-b">{c}</td>)}</tr>)}</tbody></table>; }
function LoginScreen({ onLogin }) { return <div className="grid h-screen place-items-center bg-panel"><button className="btn btn-primary" onClick={() => onLogin("mock-token")}>Sign In</button></div>; }

// --- API Helper ---
function createApi(token) {
  const req = async (m, p, b) => {
    const res = await fetch(`${API_BASE_URL}${p}`, { method: m, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: b ? JSON.stringify(b) : null });
    if (!res.ok) throw new Error("API Error");
    return m !== "DELETE" ? await res.json() : null;
  };
  return { get: (p) => req("GET", p), put: (p, b) => req("PUT", p, b), request: req };
}

export default App;