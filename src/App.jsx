import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "nexushr_access_token";

const navItems = [
  { id: "dashboard", label: "Dashboard", mark: "D" },
  { id: "employees", label: "Employees", mark: "E", adminOnly: true },
  { id: "attendance", label: "Attendance", mark: "A" },
  { id: "payroll", label: "Payroll", mark: "P" },
  { id: "performance", label: "Performance", mark: "R" },
  { id: "insights", label: "Insights", mark: "I", adminOnly: true },
  { id: "notifications", label: "Notifications", mark: "N", adminOnly: true }
];

const defaultEmployee = {
  employeeCode: "", firstName: "", lastName: "", workEmail: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  department: "", designation: "", annualSalary: ""
};

const today = new Date().toISOString().slice(0, 10);

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(jsonPayload);
  } catch (e) { return null; }
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [active, setActive] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [attendanceMetrics, setAttendanceMetrics] = useState(null);
  const [insights, setInsights] = useState([]);

  const userContext = useMemo(() => {
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload) return null;
    const parsedRoles = payload.roles || [];
    const isEmployee = parsedRoles.includes("EMPLOYEE") || parsedRoles.includes("ROLE_EMPLOYEE");
    const isAdmin = parsedRoles.includes("ADMIN") || parsedRoles.includes("ROLE_ADMIN") || parsedRoles.includes("HR");
    return { email: payload.sub, roles: parsedRoles, isEmployee: isEmployee && !isAdmin };
  }, [token]);

  const currentEmployeeId = useMemo(() => {
    if (!userContext || employees.length === 0) return "";
    if (userContext.isEmployee) {
      const match = employees.find(e => e.workEmail?.toLowerCase() === userContext.email?.toLowerCase());
      return match ? match.id : "";
    }
    return employees[0]?.id || "";
  }, [userContext, employees]);

  const api = useMemo(() => createApi(token), [token]);
  const visibleNavItems = useMemo(() => userContext?.isEmployee ? navItems.filter(i => !i.adminOnly) : navItems, [userContext]);

  async function runAction(action, successText) {
    setLoading(true); setMessage("");
    try { const result = await action(); if (successText) setMessage(successText); return result; }
    catch (error) { setMessage(error.message || "Request failed"); return null; }
    finally { setLoading(false); }
  }

  async function refreshBaseData() {
    if (!token) return;
    await runAction(async () => {
      if (userContext?.isEmployee) {
        const [nextMetrics, myProfile] = await Promise.all([api.get("/api/v1/dashboard/metrics"), api.get("/api/v1/employees/me")]);
        setMetrics(nextMetrics); setEmployees(myProfile ? [myProfile] : []);
      } else {
        const [nextMetrics, nextEmployees] = await Promise.all([api.get("/api/v1/dashboard/metrics"), api.get("/api/v1/employees")]);
        setMetrics(nextMetrics); setEmployees(nextEmployees);
      }
    });
  }

  useEffect(() => { refreshBaseData(); }, [token, userContext]);

  if (!token) return <LoginScreen onLogin={(t) => { setToken(t); localStorage.setItem(TOKEN_KEY, t); }} />;

  return (
      <div className="min-h-screen bg-panel">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
          <div className="border-b border-line px-6 py-5">
            <p className="text-xs font-semibold uppercase text-muted">NexusHR</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">Workforce Console</h1>
          </div>
          <nav className="p-3">
            {visibleNavItems.map(item => (
                <button key={item.id} className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${active === item.id ? "bg-brand text-white" : "text-ink hover:bg-panel"}`} onClick={() => setActive(item.id)}>
                  <span className={`grid size-7 place-items-center rounded-md text-xs ${active === item.id ? "bg-white/18" : "bg-panel"}`}>{item.mark}</span>
                  {item.label}
                </button>
            ))}
          </nav>
        </aside>
        <main className="lg:pl-64">
          {active === "employees" && !userContext?.isEmployee && <Employees api={api} employees={employees} refresh={refreshBaseData} runAction={runAction} />}
          {/* ... Other active views ... */}
        </main>
      </div>
  );
}

function Employees({ api, employees, refresh, runAction }) {
  const [securityRole, setSecurityRole] = useState({ employeeId: "", role: "EMPLOYEE" });

  async function removeEmployee(id) {
    if (!window.confirm("Permanently delete employee?")) return;
    await runAction(async () => {
      await api.request("DELETE", `/api/v1/employees/${id}`);
      await refresh();
    }, "Employee deleted.");
  }

  async function assignSecurityRole(e) {
    e.preventDefault();
    await runAction(async () => {
      await api.put(`/api/v1/employees/${securityRole.employeeId}/security-role`, { role: securityRole.role });
      await refresh();
    }, "Role assigned.");
  }

  return (
      <Page title="Employees">
        <Panel title="Employee Directory">
          <DataTable columns={["Name", "Actions"]} rows={employees.map(e => [
            `${e.firstName} ${e.lastName}`,
            <button className="text-coral" onClick={() => removeEmployee(e.id)}>Delete</button>
          ])} />
        </Panel>
        <Panel title="Assign Security Role">
          <form onSubmit={assignSecurityRole}>
            <EmployeeSelect employees={employees} value={securityRole.employeeId} onChange={(id) => setSecurityRole({...securityRole, employeeId: id})} />
            <Select value={securityRole.role} onChange={(r) => setSecurityRole({...securityRole, role: r})} options={["EMPLOYEE", "MANAGER", "HR", "ADMIN"]} />
            <button className="btn btn-primary">Save</button>
          </form>
        </Panel>
      </Page>
  );
}

// Keep other UI helpers (Dashboard, Page, Panel, DataTable, etc) as previously defined.

function createApi(token) {
  async function request(method, path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return parseResponse(response);
  }
  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    request: (method, path, body) => request(method, path, body) // Essential for DELETE
  };
}

async function parseResponse(response) {
  const data = await response.json().catch(() => response.text());
  if (!response.ok) throw new Error(data.message || "Error");
  return data;
}

export default App;