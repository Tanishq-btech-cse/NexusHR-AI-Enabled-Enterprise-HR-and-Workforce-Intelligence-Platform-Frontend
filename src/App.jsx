import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "nexushr_access_token";

const navItems = [
  { id: "dashboard", label: "Dashboard", mark: "D" },
  { id: "employees", label: "Employees", mark: "E", adminOnly: true },
  { id: "attendance", label: "Attendance", mark: "A" },
  { id: "payroll", label: "Payroll", mark: "P" }, // Left available for employees to view personal slips
  { id: "performance", label: "Performance", mark: "R" },
  { id: "insights", label: "Insights", mark: "I", adminOnly: true },
  { id: "notifications", label: "Notifications", mark: "N", adminOnly: true }
];

const defaultEmployee = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  workEmail: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  department: "",
  designation: "",
  annualSalary: ""
};

const today = new Date().toISOString().slice(0, 10);

// Helper function to extract user details safely from raw Spring Security JWT
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
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

  // Extracted user context profile states
  const userContext = useMemo(() => {
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload) return null;

    // Normalize role string checks coming from our backend config format
    const parsedRoles = payload.roles || [];
    const isEmployee = parsedRoles.includes("EMPLOYEE") || parsedRoles.includes("ROLE_EMPLOYEE");
    const isAdmin = parsedRoles.includes("ADMIN") || parsedRoles.includes("ROLE_ADMIN") || parsedRoles.includes("HR");

    return {
      email: payload.sub,
      roles: parsedRoles,
      isEmployee: isEmployee && !isAdmin, // Explicit flag mapping
    };
  }, [token]);

  // Determine current employee identity reference tracking safely
  const currentEmployeeId = useMemo(() => {
    if (!userContext || employees.length === 0) return "";
    if (userContext.isEmployee) {
      const match = employees.find(e => e.workEmail?.toLowerCase() === userContext.email?.toLowerCase());
      return match ? match.id : "";
    }
    return employees[0]?.id || "";
  }, [userContext, employees]);

  const api = useMemo(() => createApi(token), [token]);

  // Filter sidebar navigational nodes dynamically depending on credentials status
  const visibleNavItems = useMemo(() => {
    if (userContext?.isEmployee) {
      return navItems.filter(item => !item.adminOnly);
    }
    return navItems;
  }, [userContext]);

  function handleToken(nextToken) {
    setToken(nextToken);
    localStorage.setItem(TOKEN_KEY, nextToken);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMetrics(null);
    setEmployees([]);
    setInsights([]);
    setActive("dashboard");
  }

  async function runAction(action, successText) {
    setLoading(true);
    setMessage("");
    try {
      const result = await action();
      if (successText) setMessage(successText);
      return result;
    } catch (error) {
      setMessage(error.message || "Request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function refreshBaseData() {
    if (!token) return;
    await runAction(async () => {
      // Employees call is needed for matching email to target ID profile structure
      const [nextMetrics, nextEmployees] = await Promise.all([
        api.get("/api/v1/dashboard/metrics"),
        api.get("/api/v1/employees")
      ]);
      setMetrics(nextMetrics);
      setEmployees(nextEmployees);
    });
  }

  async function refreshAttendanceDashboard() {
    if (!token) return;
    await runAction(async () => {
      setAttendanceMetrics(await api.get(`/api/v1/attendance/dashboard?date=${today}`));
    });
  }

  async function refreshInsights() {
    if (!token) return;
    if (userContext?.isEmployee) return; // Prevent unauthorized background noise calls
    await runAction(async () => {
      setInsights(await api.get("/api/v1/insights/organization"));
    });
  }

  useEffect(() => {
    refreshBaseData();
  }, [token]);

  if (!token) {
    return <LoginScreen onLogin={handleToken} />;
  }

  return (
      <div className="min-h-screen bg-panel">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
          <div className="border-b border-line px-6 py-5">
            <p className="text-xs font-semibold uppercase text-muted">NexusHR</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">Workforce Console</h1>
            {userContext && (
                <div className="mt-2 rounded bg-panel px-2 py-1 text-xs font-medium text-brand">
                  Role: {userContext.isEmployee ? "Employee Only" : "Management / Admin"}
                </div>
            )}
          </div>
          <nav className="p-3">
            {visibleNavItems.map((item) => (
                <button
                    key={item.id}
                    className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${
                        active === item.id ? "bg-brand text-white" : "text-ink hover:bg-panel"
                    }`}
                    onClick={() => setActive(item.id)}
                >
              <span className={`grid size-7 place-items-center rounded-md text-xs ${active === item.id ? "bg-white/18" : "bg-panel"}`}>
                {item.mark}
              </span>
                  {item.label}
                </button>
            ))}
          </nav>
        </aside>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Active Session</p>
                <p className="text-sm font-medium text-ink">{userContext?.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="field max-w-52 lg:hidden" value={active} onChange={(event) => setActive(event.target.value)}>
                  {visibleNavItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={refreshBaseData} disabled={loading}>Refresh</button>
                <button className="btn btn-secondary" onClick={logout}>Sign out</button>
              </div>
            </div>
            {message ? <div className="border-t border-line bg-gold/10 px-4 py-2 text-sm text-ink lg:px-8">{message}</div> : null}
          </header>

          <main>
            {active === "dashboard" && <Dashboard metrics={metrics} attendanceMetrics={attendanceMetrics} onLoadAttendance={refreshAttendanceDashboard} userContext={userContext} />}
            {active === "employees" && !userContext?.isEmployee && <Employees api={api} employees={employees} refresh={refreshBaseData} runAction={runAction} />}
            {active === "attendance" && <Attendance api={api} employees={employees} selectedEmployee={currentEmployeeId} refreshAttendance={refreshAttendanceDashboard} runAction={runAction} userContext={userContext} />}
            {active === "payroll" && <Payroll api={api} selectedEmployee={currentEmployeeId} runAction={runAction} userContext={userContext} />}
            {active === "performance" && <Performance api={api} selectedEmployee={currentEmployeeId} runAction={runAction} userContext={userContext} />}
            {active === "insights" && !userContext?.isEmployee && <Insights api={api} insights={insights} selectedEmployee={currentEmployeeId} refresh={refreshInsights} runAction={runAction} />}
            {active === "notifications" && !userContext?.isEmployee && <Notifications api={api} runAction={runAction} />}
          </main>
        </div>
      </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("admin@nexushr.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await parseResponse(response);
      onLogin(data.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
      <main className="grid min-h-screen place-items-center bg-panel px-4">
        <form className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft" onSubmit={submit}>
          <p className="text-xs font-semibold uppercase text-muted">NexusHR</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Use standard administrative accounts or seeded employee credentials profile metrics.</p>
          <div className="mt-6 space-y-4">
            <Field label="Email">
              <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Password">
              <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
          </div>
          <div className="mt-3 rounded border border-line bg-panel p-2.5 text-xs text-muted">
            <p className="font-semibold text-ink">Seeded Demo Credentials:</p>
            <p className="mt-1">👑 Admin: <code className="text-brand">admin@nexushr.local</code> / <code className="text-brand">admin123</code></p>
            <p>💼 Employee: <code className="text-brand">employee@nexushr.local</code> / <code className="text-brand">password123</code></p>
          </div>
          {error ? <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
          <button className="btn btn-primary mt-6 w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
      </main>
  );
}

function Dashboard({ metrics, attendanceMetrics, onLoadAttendance, userContext }) {
  const items = [
    ["Total employees", metrics?.totalEmployees],
    ["Active", metrics?.activeEmployees],
    ["Onboarding", metrics?.onboardingEmployees],
    ["Pending approvals", metrics?.pendingApprovals],
    ["Pending leave", metrics?.pendingLeaveRequests],
    ["Notification success", formatPercent(metrics?.notificationSuccessRate)]
  ];

  return (
      <Page title={userContext?.isEmployee ? "My Employee Dashboard" : "Executive Dashboard"} subtitle={userContext?.isEmployee ? "Personal workforce track summaries." : "Global executive oversight matrix indicators."}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value]) => <Stat key={label} label={label} value={value ?? "-"} />)}
        </div>
        {!userContext?.isEmployee && (
            <Panel title="Attendance today" action={<button className="btn btn-secondary" onClick={onLoadAttendance}>Load</button>}>
              {attendanceMetrics ? <JsonBlock data={attendanceMetrics} /> : <Empty text="Load today's attendance dashboard." />}
            </Panel>
        )}
      </Page>
  );
}

function Employees({ api, employees, refresh, runAction }) {
  const [form, setForm] = useState(defaultEmployee);
  const [role, setRole] = useState({ employeeId: "", department: "", designation: "", managerId: "" });

  async function createEmployee(event) {
    event.preventDefault();
    await runAction(async () => {
      const profile = form.annualSalary ? { annualSalary: Number(form.annualSalary) } : {};
      const employee = await api.post("/api/v1/employees", {
        employeeCode: form.employeeCode,
        firstName: form.firstName,
        lastName: form.lastName,
        workEmail: form.workEmail,
        joiningDate: form.joiningDate,
        profile
      });
      if (form.department && form.designation) {
        await api.put(`/api/v1/employees/${employee.id}/role`, {
          department: form.department,
          designation: form.designation,
          managerId: null
        });
      }
      setForm(defaultEmployee);
      await refresh();
    }, "Employee saved");
  }

  async function assignRole(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.put(`/api/v1/employees/${role.employeeId}/role`, {
        department: role.department,
        designation: role.designation,
        managerId: role.managerId || null
      });
      setRole({ employeeId: "", department: "", designation: "", managerId: "" });
      await refresh();
    }, "Role updated");
  }

  async function offboard(id) {
    await runAction(async () => {
      await api.post(`/api/v1/employees/${id}/offboarding`, {});
      await refresh();
    }, "Offboarding started");
  }

  return (
      <Page title="Employees" subtitle="Create employees, assign departments, and start offboarding workflows.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Panel title="Employee directory">
            <DataTable
                columns={["Code", "Name", "Email", "Team", "Status", "Action"]}
                rows={employees.map((employee) => [
                  employee.employeeCode,
                  `${employee.firstName} ${employee.lastName}`,
                  employee.workEmail,
                  [employee.department, employee.designation].filter(Boolean).join(" / ") || "-",
                  <Badge value={employee.status} />,
                  <button className="btn btn-secondary min-h-8 px-3 py-1" onClick={() => offboard(employee.id)}>Offboard</button>
                ])}
            />
          </Panel>
          <div className="space-y-4">
            <Panel title="New employee">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={createEmployee}>
                <Input label="Employee code" value={form.employeeCode} onChange={(value) => setForm({ ...form, employeeCode: value })} required />
                <Input label="Work email" type="email" value={form.workEmail} onChange={(value) => setForm({ ...form, workEmail: value })} required />
                <Input label="First name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} required />
                <Input label="Last name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} required />
                <Input label="Joining date" type="date" value={form.joiningDate} onChange={(value) => setForm({ ...form, joiningDate: value })} required />
                <Input label="Annual salary" type="number" value={form.annualSalary} onChange={(value) => setForm({ ...form, annualSalary: value })} />
                <Input label="Department" value={form.department} onChange={(value) => setForm({ ...form, department: value })} />
                <Input label="Designation" value={form.designation} onChange={(value) => setForm({ ...form, designation: value })} />
                <button className="btn btn-primary sm:col-span-2">Create employee</button>
              </form>
            </Panel>
            <Panel title="Assign role">
              <form className="grid gap-3" onSubmit={assignRole}>
                <EmployeeSelect employees={employees} value={role.employeeId} onChange={(employeeId) => setRole({ ...role, employeeId })} />
                <Input label="Department" value={role.department} onChange={(department) => setRole({ ...role, department })} required />
                <Input label="Designation" value={role.designation} onChange={(designation) => setRole({ ...role, designation })} required />
                <Input label="Manager ID" value={role.managerId} onChange={(managerId) => setRole({ ...role, managerId })} />
                <button className="btn btn-primary">Update role</button>
              </form>
            </Panel>
          </div>
        </div>
      </Page>
  );
}

function Attendance({ api, employees, selectedEmployee, refreshAttendance, runAction, userContext }) {
  const [employeeId, setEmployeeId] = useState(selectedEmployee);
  const [leave, setLeave] = useState({ leaveType: "ANNUAL", startDate: today, endDate: today, reason: "" });
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    setEmployeeId(selectedEmployee);
  }, [selectedEmployee]);

  async function punch() {
    await runAction(async () => {
      await api.post("/api/v1/attendance/biometric-punch", { employeeId, deviceId: "WEB-KIOSK-01" });
      await refreshAttendance();
    }, "Punch recorded");
  }

  async function requestLeave(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.post("/api/v1/attendance/leave-requests", { employeeId, ...leave });
      setLeave({ leaveType: "ANNUAL", startDate: today, endDate: today, reason: "" });
    }, "Leave request submitted");
  }

  async function loadBalances() {
    await runAction(async () => {
      setBalances(await api.get(`/api/v1/attendance/employees/${employeeId}/leave-balances`));
    });
  }

  return (
      <Page title="Attendance Tracker" subtitle="Punch simulation logging tracks directly into the database layers.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Clock Execution Terminal">
            <div className="grid gap-3">
              {!userContext?.isEmployee ? (
                  <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
              ) : (
                  <div className="text-sm font-medium p-2 border border-line bg-panel rounded">
                    Lock Bound Context Profile ID: <span className="font-mono text-xs text-brand">{employeeId || "resolving..."}</span>
                  </div>
              )}
              <button className="btn btn-primary" onClick={punch} disabled={!employeeId}>Trigger Biometric Punch</button>
              <button className="btn btn-secondary" onClick={loadBalances} disabled={!employeeId}>Inspect Leave Balances</button>
            </div>
          </Panel>
          <Panel title="Request Leave Absence">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={requestLeave}>
              <Select label="Leave type" value={leave.leaveType} onChange={(leaveType) => setLeave({ ...leave, leaveType })} options={["ANNUAL", "SICK", "CASUAL", "UNPAID"]} />
              <div />
              <Input label="Start date" type="date" value={leave.startDate} onChange={(startDate) => setLeave({ ...leave, startDate })} required />
              <Input label="End date" type="date" value={leave.endDate} onChange={(endDate) => setLeave({ ...leave, endDate })} required />
              <Field label="Reason">
                <textarea className="field min-h-24" value={leave.reason} onChange={(event) => setLeave({ ...leave, reason: event.target.value })} />
              </Field>
              <button className="btn btn-primary self-end" disabled={!employeeId}>Submit leave</button>
            </form>
          </Panel>
        </div>
        <Panel title="Leave balances status tracker">
          {balances.length ? <DataTable columns={["Type", "Entitled", "Used", "Available"]} rows={balances.map((item) => [item.leaveType, item.openingBalance, item.consumed, item.availableDays || item.openingBalance])} /> : <Empty text="No data streams parsed." />}
        </Panel>
      </Page>
  );
}

function Payroll({ api, selectedEmployee, runAction, userContext }) {
  const [run, setRun] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [payrollRun, setPayrollRun] = useState(null);
  const [employeeId, setEmployeeId] = useState(selectedEmployee);
  const [payslips, setPayslips] = useState([]);

  useEffect(() => {
    setEmployeeId(selectedEmployee);
  }, [selectedEmployee]);

  async function calculate(event) {
    event.preventDefault();
    await runAction(async () => {
      const nextRun = await api.post("/api/v1/payroll/runs", { year: Number(run.year), month: Number(run.month) });
      setPayrollRun(nextRun);
    }, "Payroll calculated");
  }

  async function approve() {
    await runAction(async () => {
      setPayrollRun(await api.post(`/api/v1/payroll/runs/${payrollRun.id}/approve`, {}));
    }, "Payroll approved");
  }

  async function loadPayslips() {
    await runAction(async () => {
      const path = (!userContext?.isEmployee && payrollRun?.id)
          ? `/api/v1/payroll/runs/${payrollRun.id}/payslips`
          : `/api/v1/payroll/employees/${employeeId}/payslips`;
      setPayslips(await api.get(path));
    });
  }

  return (
      <Page title="Compensation Matrix" subtitle="View issued statements or perform background calculations.">
        <div className={`grid gap-4 ${userContext?.isEmployee ? "grid-cols-1" : "xl:grid-cols-[360px_minmax(0,1fr)]"}`}>
          {!userContext?.isEmployee && (
              <Panel title="Run payroll calculations">
                <form className="grid gap-3" onSubmit={calculate}>
                  <Input label="Year" type="number" value={run.year} onChange={(year) => setRun({ ...run, year })} required />
                  <Input label="Month" type="number" min="1" max="12" value={run.month} onChange={(month) => setRun({ ...run, month })} required />
                  <button className="btn btn-primary">Calculate</button>
                </form>
                {payrollRun ? (
                    <div className="mt-4 rounded-md border border-line bg-panel p-3 text-sm">
                      <p className="font-semibold">{payrollRun.payrollYear}-{String(payrollRun.payrollMonth).padStart(2, "0")}</p>
                      <p className="mt-1 text-muted">Status: {payrollRun.status}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="btn btn-secondary" onClick={approve}>Approve</button>
                        <a className="btn btn-secondary" href={`${API_BASE_URL}/payroll/runs/${payrollRun.id}/export.csv`}>Export CSV</a>
                      </div>
                    </div>
                ) : null}
              </Panel>
          )}
          <Panel title="Personal Payslips Directory">
            <div className="mb-3 flex gap-3 items-end">
              {userContext?.isEmployee ? (
                  <div className="text-sm font-medium p-2 border border-line bg-panel rounded w-full">
                    Active verification token target: <span className="font-mono text-xs text-brand">{employeeId}</span>
                  </div>
              ) : (
                  <Input label="Employee ID lookup manual override" value={employeeId} onChange={setEmployeeId} />
              )}
              <button className="btn btn-secondary" onClick={loadPayslips} disabled={!employeeId}>Load statements</button>
            </div>
            {payslips.length ? (
                <DataTable columns={["Profile Context", "Gross", "Tax", "Other Deductions", "Net Distributed"]} rows={payslips.map((slip) => [shortId(slip.employeeId), money(slip.grossSalary), money(slip.taxDeduction), money(slip.otherDeductions), money(slip.netSalary)])} />
            ) : <Empty text="No statements found." />}
          </Panel>
        </div>
      </Page>
  );
}

function Performance({ api, selectedEmployee, runAction, userContext }) {
  const [employeeId, setEmployeeId] = useState(selectedEmployee);
  const [goal, setGoal] = useState({ title: "", description: "", dueDate: today });
  const [review, setReview] = useState({ cycle: "2026-H1", managerRating: "4", peerRating: "4", selfRating: "4", feedback: "" });
  const [goals, setGoals] = useState([]);
  const [scorecard, setScorecard] = useState([]);

  useEffect(() => {
    setEmployeeId(selectedEmployee);
  }, [selectedEmployee]);

  async function createGoal(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.post("/api/v1/performance/goals", { employeeId, ...goal });
      setGoal({ title: "", description: "", dueDate: today });
      setGoals(await api.get(`/api/v1/performance/employees/${employeeId}/goals`));
    }, "Goal created");
  }

  async function createReview(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.post("/api/v1/performance/reviews", { employeeId, ...review });
      setScorecard(await api.get(`/api/v1/performance/employees/${employeeId}/scorecard`));
    }, "Review created");
  }

  async function loadPerformance() {
    if (!employeeId) return;
    await runAction(async () => {
      const [nextGoals, nextScorecard] = await Promise.all([
        api.get(`/api/v1/performance/employees/${employeeId}/goals`),
        api.get(`/api/v1/performance/employees/${employeeId}/scorecard`)
      ]);
      setGoals(nextGoals);
      setScorecard(nextScorecard);
    });
  }

  // Automate fetching context metrics for individual views
  useEffect(() => {
    if (employeeId && userContext?.isEmployee) {
      loadPerformance();
    }
  }, [employeeId]);

  return (
      <Page title="Performance Hub" subtitle="Track milestone tracking configurations inside security containers.">
        {!userContext?.isEmployee && (
            <Panel title="Employee context matching">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input label="Employee target tracker ID" value={employeeId} onChange={setEmployeeId} />
                <button className="btn btn-secondary self-end" onClick={loadPerformance} disabled={!employeeId}>Load parameters</button>
              </div>
            </Panel>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Create active tracking task milestone">
            <form className="grid gap-3" onSubmit={createGoal}>
              <Input label="Title" value={goal.title} onChange={(title) => setGoal({ ...goal, title })} required />
              <Input label="Due date" type="date" value={goal.dueDate} onChange={(dueDate) => setGoal({ ...goal, dueDate })} />
              <Field label="Description">
                <textarea className="field min-h-24" value={goal.description} onChange={(event) => setGoal({ ...goal, description: event.target.value })} />
              </Field>
              <button className="btn btn-primary" disabled={!employeeId}>Save goal</button>
            </form>
          </Panel>

          {!userContext?.isEmployee && (
              <Panel title="Create performance evaluation metrics matrix">
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={createReview}>
                  <Input label="Cycle" value={review.cycle} onChange={(cycle) => setReview({ ...review, cycle })} required />
                  <Input label="Manager rating" type="number" min="1" max="5" step="0.1" value={review.managerRating} onChange={(managerRating) => setReview({ ...review, managerRating })} required />
                  <Input label="Peer rating" type="number" min="1" max="5" step="0.1" value={review.peerRating} onChange={(peerRating) => setReview({ ...review, peerRating })} required />
                  <Input label="Self rating" type="number" min="1" max="5" step="0.1" value={review.selfRating} onChange={(selfRating) => setReview({ ...review, selfRating })} required />
                  <Field label="Feedback">
                    <textarea className="field min-h-24" value={review.feedback} onChange={(event) => setReview({ ...review, feedback: event.target.value })} />
                  </Field>
                  <button className="btn btn-primary self-end" disabled={!employeeId}>Save review</button>
                </form>
              </Panel>
          )}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Milestones tracks list">
            {goals.length ? <DataTable columns={["Title", "Due", "Progress"]} rows={goals.map((item) => [item.title, item.dueDate || "-", `${item.progress ?? 0}%`])} /> : <Empty text="No records active." />}
          </Panel>
          <Panel title="360 Degree evaluation report card">
            {scorecard.length ? <DataTable columns={["Cycle", "Manager weight", "Peer weight", "Self weight", "Calculated index score", "Status"]} rows={scorecard.map((item) => [item.cycle, item.managerRating, item.peerRating, item.selfRating, item.score, <Badge value={item.status} />])} /> : <Empty text="No formal reports compiled." />}
          </Panel>
        </div>
      </Page>
  );
}

function Insights({ api, insights, selectedEmployee, refresh, runAction }) {
  const [employeeId, setEmployeeId] = useState(selectedEmployee);
  const [employeeInsight, setEmployeeInsight] = useState(null);

  async function loadEmployeeInsight() {
    await runAction(async () => {
      setEmployeeInsight(await api.get(`/api/v1/insights/employees/${employeeId}`));
    });
  }

  return (
      <Page title="Insights" subtitle="AI workforce risk, engagement, skills, and recommendations.">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Panel title="Employee insight">
            <div className="grid gap-3">
              <Input label="Employee ID" value={employeeId} onChange={setEmployeeId} />
              <button className="btn btn-primary" onClick={loadEmployeeInsight} disabled={!employeeId}>Load employee insight</button>
            </div>
            {employeeInsight ? <InsightCard insight={employeeInsight} /> : null}
          </Panel>
          <Panel title="Organization insights" action={<button className="btn btn-secondary" onClick={refresh}>Load all</button>}>
            {insights.length ? <div className="grid gap-3 md:grid-cols-2">{insights.map((insight) => <InsightCard key={insight.employeeId} insight={insight} />)}</div> : <Empty text="No insights loaded." />}
          </Panel>
        </div>
      </Page>
  );
}

function Notifications({ api, runAction }) {
  const [form, setForm] = useState({ recipient: "", channel: "EMAIL", subject: "", body: "" });

  async function send(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.post("/api/v1/notifications", form);
      setForm({ recipient: "", channel: "EMAIL", subject: "", body: "" });
    }, "Notification queued");
  }

  return (
      <Page title="Notifications" subtitle="Queue email, SMS, or in-app notifications through the backend service.">
        <Panel title="Send notification">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
            <Input label="Recipient" value={form.recipient} onChange={(recipient) => setForm({ ...form, recipient })} required />
            <Select label="Channel" value={form.channel} onChange={(channel) => setForm({ ...form, channel })} options={["EMAIL", "SMS", "IN_APP"]} />
            <Input label="Subject" value={form.subject} onChange={(subject) => setForm({ ...form, subject })} required />
            <div />
            <Field label="Body">
              <textarea className="field min-h-32" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
            </Field>
            <button className="btn btn-primary self-end">Queue notification</button>
          </form>
        </Panel>
      </Page>
  );
}

function Page({ title, subtitle, children }) {
  return (
      <section className="space-y-4 px-4 py-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </section>
  );
}

function Panel({ title, action, children }) {
  return (
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          {action}
        </div>
        <div className="p-4">{children}</div>
      </section>
  );
}

function Stat({ label, value }) {
  return (
      <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      </div>
  );
}

function DataTable({ columns, rows }) {
  if (!rows.length) return <Empty text="No records found." />;
  return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
          <tr>
            {columns.map((column) => (
                <th key={column} className="border-b border-line bg-panel px-3 py-2 text-xs font-semibold uppercase text-muted">{column}</th>
            ))}
          </tr>
          </thead>
          <tbody>
          {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b border-line px-3 py-3 align-top text-ink">{cell}</td>
                ))}
              </tr>
          ))}
          </tbody>
        </table>
      </div>
  );
}

function Field({ label, children }) {
  return (
      <label className="block">
        <span className="label mb-1 block">{label}</span>
        {children}
      </label>
  );
}

function Input({ label, value, onChange, type = "text", ...props }) {
  return (
      <Field label={label}>
        <input className="field" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...props} />
      </Field>
  );
}

// Fixed dropdown values parsing to use correct string mappings
function Select({ label, value, onChange, options }) {
  return (
      <Field label={label}>
        <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </Field>
  );
}

function EmployeeSelect({ employees, value, onChange }) {
  return (
      <Field label="Employee">
        <select className="field" value={value || ""} onChange={(event) => onChange(event.target.value)} required>
          <option value="">Choose employee</option>
          {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeCode} - {employee.firstName} {employee.lastName}
              </option>
          ))}
        </select>
      </Field>
  );
}

function Badge({ value }) { return <span className="inline-flex rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">{value || "-"}</span>; }
function Empty({ text }) { return <p className="rounded-md border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-muted">{text}</p>; }
function JsonBlock({ data }) { return <pre className="max-h-96 overflow-auto rounded-md bg-ink p-4 text-xs text-white">{JSON.stringify(data, null, 2)}</pre>; }
function InsightCard({ insight }) { return ( <div className="rounded-lg border border-line bg-panel p-4"> <p className="text-xs font-semibold uppercase text-muted">{shortId(insight.employeeId)}</p> <div className="mt-3 grid grid-cols-2 gap-2"> <Stat label="Attrition risk" value={formatPercent(insight.attritionRisk)} /> <Stat label="Engagement" value={formatPercent(insight.engagementScore)} /> </div> <p className="mt-4 text-sm font-semibold text-ink">Skill gaps</p> <p className="mt-1 text-sm text-muted">{(insight.skillGaps || []).join(", ") || "-"}</p> <p className="mt-4 text-sm font-semibold text-ink">Recommendations</p> <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted"> {(insight.recommendations || ["No recommendations"]).map((item) => <li key={item}>{item}</li>)} </ul> </div> ); }

function createApi(token) {
  async function request(method, path, body) {
    const absolutePath = `${API_BASE_URL}${path.replace('/api/v1', '')}`;
    const response = await fetch(absolutePath, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return parseResponse(response);
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body)
  };
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof data === "object" ? data.message || JSON.stringify(data.details || data) : data;
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return data;
}

function shortId(value) { return value ? `${value.slice(0, 8)}...` : "-"; }
function money(value) { const number = Number(value || 0); return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number); }
function formatPercent(value) { if (value === undefined || value === null || value === "-") return "-"; const number = Number(value); return `${Math.round(number * 100)}%`; }

export default App;