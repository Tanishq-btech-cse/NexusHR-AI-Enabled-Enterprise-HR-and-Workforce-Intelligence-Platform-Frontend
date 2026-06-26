import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "nexushr_access_token";

const navItems = [
    { id: "dashboard", label: "Dashboard", mark: "D" },
    { id: "employees", label: "Employees", mark: "E", adminOnly: true },
    { id: "attendance", label: "Attendance", mark: "A" },
    { id: "payroll", label: "Payroll", mark: "P" },
    { id: "performance", label: "Performance", mark: "R" },
    { id: "documents", label: "Documents", mark: "📄" },
    { id: "recruitment", label: "Recruitment", mark: "🎯", adminOnly: true },
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
        const jsonPayload = decodeURIComponent(
            atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
        );
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
    const [authView, setAuthView] = useState("login");
    const [resetToken, setResetToken] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken && !token) {
            setResetToken(urlToken);
            setAuthView("reset");
        }
    }, [token]);

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

    const visibleNavItems = useMemo(() => {
        if (userContext?.isEmployee) return navItems.filter(item => !item.adminOnly);
        return navItems;
    }, [userContext]);

    function handleToken(nextToken) {
        setToken(nextToken);
        localStorage.setItem(TOKEN_KEY, nextToken);
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(""); setMetrics(null); setEmployees([]); setInsights([]);
        setActive("dashboard"); setAuthView("login");
    }

    async function runAction(action, successText) {
        setLoading(true); setMessage("");
        try {
            const result = await action();
            if (successText) setMessage(successText);
            return result;
        } catch (error) {
            setMessage(error.message || "Request failed");
            return null;
        } finally { setLoading(false); }
    }

    async function refreshBaseData() {
        if (!token) return;
        await runAction(async () => {
            if (userContext?.isEmployee) {
                const [nextMetrics, myProfile] = await Promise.all([
                    api.get("/api/v1/dashboard/metrics"),
                    api.get("/api/v1/employees/me")
                ]);
                setMetrics(nextMetrics);
                setEmployees(myProfile ? [myProfile] : []);
            } else {
                const [nextMetrics, nextEmployees] = await Promise.all([
                    api.get("/api/v1/dashboard/metrics"),
                    api.get("/api/v1/employees")
                ]);
                setMetrics(nextMetrics);
                setEmployees(nextEmployees);
            }
        });
    }

    async function refreshAttendanceDashboard() {
        if (!token || userContext?.isEmployee) return;
        await runAction(async () => setAttendanceMetrics(await api.get(`/api/v1/attendance/dashboard?date=${today}`)));
    }

    async function refreshInsights() {
        if (!token || userContext?.isEmployee) return;
        await runAction(async () => setInsights(await api.get("/api/v1/insights/organization")));
    }

    useEffect(() => { refreshBaseData(); }, [token, userContext]);

    if (!token) {
        if (authView === "forgot") return <ForgotPasswordScreen onBack={() => setAuthView("login")} />;
        if (authView === "reset") {
            return <ResetPasswordScreen resetToken={resetToken} onDone={() => { setAuthView("login"); window.history.replaceState({}, document.title, window.location.pathname); }} />;
        }
        if (authView === "careers") return <CareersScreen onBack={() => setAuthView("login")} />;
        return <LoginScreen onLogin={handleToken} onForgotPassword={() => setAuthView("forgot")} onCareers={() => setAuthView("careers")} />;
    }

    return (
        <div className="min-h-screen bg-panel">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
                <div className="border-b border-line px-6 py-5">
                    <p className="text-xs font-semibold uppercase text-muted">NexusHR</p>
                    <h1 className="mt-1 text-2xl font-bold text-ink">Workforce Console</h1>
                    {userContext && <div className="mt-2 rounded bg-panel px-2 py-1 text-xs font-medium text-brand">Role: {userContext.isEmployee ? "Employee Only" : "Management / Admin"}</div>}
                </div>
                <nav className="p-3">
                    {visibleNavItems.map((item) => (
                        <button key={item.id} className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold ${active === item.id ? "bg-brand text-white" : "text-ink hover:bg-panel"}`} onClick={() => setActive(item.id)}>
                            <span className={`grid size-7 place-items-center rounded-md text-xs ${active === item.id ? "bg-white/18" : "bg-panel"}`}>{item.mark}</span>
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
                                {visibleNavItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                            </select>
                            <button className="btn btn-secondary" onClick={refreshBaseData} disabled={loading}>Refresh</button>
                            <button className="btn btn-secondary" onClick={logout}>Sign out</button>
                        </div>
                    </div>
                    {message ? <div className="border-t border-line bg-gold/10 px-4 py-2 text-sm text-ink lg:px-8">{message}</div> : null}
                </header>

                <main>
                    {active === "dashboard" && <Dashboard metrics={metrics} attendanceMetrics={attendanceMetrics} onLoadAttendance={refreshAttendanceDashboard} userContext={userContext} api={api} runAction={runAction} employees={employees} />}
                    {active === "employees" && !userContext?.isEmployee && <Employees api={api} employees={employees} refresh={refreshBaseData} runAction={runAction} userContext={userContext} />}
                    {active === "attendance" && <Attendance api={api} employees={employees} selectedEmployee={currentEmployeeId} refreshAttendance={refreshAttendanceDashboard} runAction={runAction} userContext={userContext} />}
                    {active === "payroll" && <Payroll api={api} selectedEmployee={currentEmployeeId} runAction={runAction} userContext={userContext} />}
                    {active === "performance" && <Performance api={api} selectedEmployee={currentEmployeeId} runAction={runAction} userContext={userContext} />}
                    {active === "documents" && <Documents api={api} runAction={runAction} userContext={userContext} currentEmployeeId={currentEmployeeId} token={token} />}
                    {active === "recruitment" && !userContext?.isEmployee && <Recruitment api={api} runAction={runAction} userContext={userContext} />}
                    {active === "insights" && !userContext?.isEmployee && <Insights api={api} insights={insights} selectedEmployee={currentEmployeeId} refresh={refreshInsights} runAction={runAction} />}
                    {active === "notifications" && !userContext?.isEmployee && <Notifications api={api} runAction={runAction} />}
                </main>
            </div>
        </div>
    );
}

function EmployeeProfileOnboarding({ api, runAction, employee }) {
    const [profile, setProfile] = useState({ fatherName: "", motherName: "", address: "", aadhaarNumber: "", panNumber: "", profileCompleted: false, editRequestStatus: "NONE" });
    const [timeLeft, setTimeLeft] = useState("");

    async function loadProfile() {
        try {
            const data = await api.get("/api/v1/employees/me/profile");
            if (data) setProfile(data);
        } catch (e) {}
    }

    useEffect(() => { loadProfile(); }, []);

    useEffect(() => {
        if (profile.profileCompleted) return;
        const joinDate = employee?.joiningDate ? new Date(employee.joiningDate).getTime() : new Date().getTime();
        const deadline = joinDate + (24 * 60 * 60 * 1000);

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const diff = deadline - now;
            if (diff <= 0) {
                setTimeLeft("OVERDUE - ACTION REQUIRED IMMEDIATELY");
                clearInterval(timer);
            } else {
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [employee, profile.profileCompleted]);

    async function saveProfile(e) {
        e.preventDefault();
        await runAction(async () => {
            await api.post("/api/v1/employees/me/profile", profile);
            await loadProfile();
        }, "Profile saved and securely locked.");
    }

    async function requestEditAccess() {
        await runAction(async () => {
            await api.post("/api/v1/employees/me/profile/request-edit", {});
            await loadProfile();
        }, "Edit request sent to Administration.");
    }

    const isLocked = profile.profileCompleted && profile.editRequestStatus !== "APPROVED";

    return (
        <Panel title="Personal Information Registry">
            {!profile.profileCompleted && (
                <div className="mb-4 bg-coral/10 border border-coral text-coral px-4 py-3 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="font-bold text-sm">⚠️ Mandatory Profile Completion Required</span>
                    <span className="font-mono font-bold text-lg animate-pulse">{timeLeft}</span>
                </div>
            )}

            {profile.profileCompleted && profile.editRequestStatus === "PENDING" && (
                <div className="mb-4 bg-gold/10 border border-gold text-gold px-4 py-3 rounded-md">
                    <span className="font-bold text-sm">⏳ Your request to edit personal information is pending Admin approval.</span>
                </div>
            )}

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                <Input label="Father's Name" value={profile.fatherName} onChange={(v) => setProfile({...profile, fatherName: v})} disabled={isLocked} required />
                <Input label="Mother's Name" value={profile.motherName} onChange={(v) => setProfile({...profile, motherName: v})} disabled={isLocked} required />
                <div className="sm:col-span-2">
                    <Field label="Permanent Address">
                        <textarea className="field min-h-20" value={profile.address} onChange={(e) => setProfile({...profile, address: e.target.value})} disabled={isLocked} required />
                    </Field>
                </div>
                <Input label="Aadhaar Number" value={profile.aadhaarNumber} onChange={(v) => setProfile({...profile, aadhaarNumber: v})} disabled={isLocked} required />
                <Input label="PAN Number" value={profile.panNumber} onChange={(v) => setProfile({...profile, panNumber: v})} disabled={isLocked} required />

                <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                    {isLocked ? (
                        <button type="button" className="btn btn-secondary" onClick={requestEditAccess} disabled={profile.editRequestStatus === "PENDING"}>
                            {profile.editRequestStatus === "PENDING" ? "Request Pending" : "Request Edit Access"}
                        </button>
                    ) : (
                        <button type="submit" className="btn btn-primary">{profile.editRequestStatus === "APPROVED" ? "Save Changes & Relock" : "Save & Lock Profile"}</button>
                    )}
                </div>
            </form>
        </Panel>
    );
}

function AdminProfileApprovals({ api, runAction }) {
    const [requests, setRequests] = useState([]);

    async function loadRequests() {
        try {
            const data = await api.get("/api/v1/employees/requests/profile-edits");
            setRequests(data || []);
        } catch(e) { }
    }

    useEffect(() => { loadRequests(); }, []);

    async function approve(employeeId) {
        await runAction(async () => {
            await api.post(`/api/v1/employees/${employeeId}/profile/approve-edit`, {});
            await loadRequests();
        }, "Edit access granted.");
    }

    return (
        <Panel title="Pending Profile Edit Requests" action={<button className="btn btn-secondary" onClick={loadRequests}>Refresh</button>}>
            {requests.length ? (
                <DataTable
                    columns={["Employee Code", "Name", "Email", "Actions"]}
                    rows={requests.map(req => [
                        req.employeeCode,
                        `${req.firstName} ${req.lastName}`,
                        req.workEmail,
                        <button key={req.id} className="btn min-h-8 px-2.5 py-1 text-xs bg-brand text-white rounded-md font-semibold" onClick={() => approve(req.id)}>Approve Edit</button>
                    ])}
                />
            ) : <Empty text="No pending edit requests." />}
        </Panel>
    );
}

function Dashboard({ metrics, attendanceMetrics, onLoadAttendance, userContext, api, runAction, employees }) {
    const [aiQuery, setAiQuery] = useState("");
    const [aiResponse, setAiResponse] = useState("");
    const [asking, setAsking] = useState(false);

    async function askAi(event) {
        event.preventDefault(); setAsking(true);
        try {
            const response = await api.post("/api/v1/ai/query", { prompt: aiQuery });
            setAiResponse(response.answer || response.message || "Query processed successfully.");
        } catch (error) {
            setAiResponse("⚠️ AI Service is currently unreachable. Please check your backend AI endpoint configuration.");
        } finally { setAsking(false); }
    }

    const items = [
        ["Total employees", metrics?.totalEmployees], ["Active", metrics?.activeEmployees],
        ["Onboarding", metrics?.onboardingEmployees], ["Pending approvals", metrics?.pendingApprovals],
        ["Pending leave", metrics?.pendingLeaveRequests], ["Notification success", formatPercent(metrics?.notificationSuccessRate)]
    ];

    let dashboardTitle = "Dashboard";
    let dashboardSubtitle = "System overview.";

    if (userContext?.roles) {
        const roles = userContext.roles.map(r => r.replace("ROLE_", ""));
        if (roles.includes("ADMIN")) { dashboardTitle = "Admin Dashboard"; dashboardSubtitle = "Global administrative control and system metrics."; }
        else if (roles.includes("HR")) { dashboardTitle = "HR Dashboard"; dashboardSubtitle = "Human resources overview and compliance tracking."; }
        else { dashboardTitle = "My Employee Dashboard"; dashboardSubtitle = "Personal workforce track summaries."; }
    }

    return (
        <Page title={dashboardTitle} subtitle={dashboardSubtitle}>

            {userContext?.isEmployee && employees.length > 0 && (
                <div className="mb-6">
                    <EmployeeProfileOnboarding api={api} runAction={runAction} employee={employees[0]} />
                </div>
            )}

            {!userContext?.isEmployee && (
                <div className="mb-6 grid gap-4 xl:grid-cols-2">
                    <Panel title="✨ Ask Nexus AI">
                        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={askAi}>
                            <div className="flex-1">
                                <Input label="" placeholder="e.g., Give me the top 5 performing employees..." value={aiQuery} onChange={setAiQuery} required />
                            </div>
                            <button className="btn btn-primary h-10 self-end sm:self-auto" disabled={asking}>{asking ? "Thinking..." : "Ask AI"}</button>
                        </form>
                        {aiResponse && <div className="mt-4 rounded-md border border-brand/20 bg-brand/5 p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed">{aiResponse}</div>}
                    </Panel>

                    <AdminProfileApprovals api={api} runAction={runAction} />
                </div>
            )}

            {!userContext?.isEmployee && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-4 mb-6">
                    {items.map(([label, value]) => <Stat key={label} label={label} value={value ?? "-"} />)}
                </div>
            )}

            {!userContext?.isEmployee && (
                <Panel title="Attendance today" action={<button className="btn btn-secondary" onClick={onLoadAttendance}>Load</button>}>
                    {attendanceMetrics ? (
                        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                            <div className="rounded-lg border border-line bg-panel p-4 text-center">
                                <p className="text-xs font-bold uppercase text-muted">Present</p><p className="mt-2 text-3xl font-extrabold text-ink">{attendanceMetrics.present ?? 0}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-panel p-4 text-center">
                                <p className="text-xs font-bold uppercase text-muted">Absent</p><p className="mt-2 text-3xl font-extrabold text-coral">{attendanceMetrics.absent ?? 0}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-panel p-4 text-center">
                                <p className="text-xs font-bold uppercase text-muted">Remote</p><p className="mt-2 text-3xl font-extrabold text-brand">{attendanceMetrics.remote ?? 0}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-panel p-4 text-center">
                                <p className="text-xs font-bold uppercase text-muted">Pending Leaves</p><p className="mt-2 text-3xl font-extrabold text-gold">{attendanceMetrics.pendingLeaves ?? 0}</p>
                            </div>
                        </div>
                    ) : <Empty text="Load today's attendance dashboard." />}
                </Panel>
            )}
        </Page>
    );
}

function CareersScreen({ onBack }) {
    const [form, setForm] = useState({ name: "", email: "", targetRole: "Software Engineer" });
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault(); setBusy(true); setStatus("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/recruitment/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            await parseResponse(response);
            setStatus({ type: "success", text: "Application submitted successfully! Our HR team will review it shortly." });
            setForm({ name: "", email: "", targetRole: "Software Engineer" });
        } catch (err) { setStatus({ type: "error", text: err.message || "An error occurred submitting your application." }); } finally { setBusy(false); }
    }

    return (
        <main className="grid min-h-screen place-items-center bg-panel px-4 py-12">
            <div className="w-full max-w-lg rounded-lg border border-line bg-white p-8 shadow-soft">
                <div className="text-center mb-8">
                    <p className="text-xs font-semibold uppercase text-brand tracking-widest">Careers</p>
                    <h1 className="mt-2 text-3xl font-bold text-ink">Join NexusHR</h1>
                </div>
                {status.type === "success" ? (
                    <div className="p-6 mb-6 rounded-md border border-brand/20 bg-brand/5 text-center">
                        <p className="text-sm font-semibold text-brand">{status.text}</p>
                        <button className="btn btn-primary mt-6 w-full" onClick={onBack}>Return to System Login</button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        <Field label="Full Name"><input className="field" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
                        <Field label="Contact Email"><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
                        <Select label="Position Applying For" value={form.targetRole} onChange={(targetRole) => setForm({ ...form, targetRole })} options={["Software Engineer", "Senior Full-Stack Developer", "Product Manager", "HR Specialist", "Data Scientist", "UI/UX Designer"]} />
                        {status.type === "error" && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{status.text}</p>}
                        <button className="btn btn-primary w-full mt-4 h-11 text-base" disabled={busy}>{busy ? "Submitting..." : "Submit Application"}</button>
                    </form>
                )}
                <div className="mt-8 pt-6 border-t border-line text-center"><button type="button" onClick={onBack} className="text-sm font-semibold text-muted hover:text-brand hover:underline transition-colors">← Back to Employee Login</button></div>
            </div>
        </main>
    );
}

function LoginScreen({ onLogin, onForgotPassword, onCareers }) {
    const [email, setEmail] = useState("admin@nexushr.local");
    const [password, setPassword] = useState("ChangeMe123!");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault(); setBusy(true); setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
            const data = await parseResponse(response);
            onLogin(data.accessToken);
        } catch (err) { setError(err.message); } finally { setBusy(false); }
    }

    return (
        <main className="grid min-h-screen place-items-center bg-panel px-4 py-8">
            <div className="w-full max-w-md">
                <form className="rounded-lg border border-line bg-white p-6 shadow-soft" onSubmit={submit}>
                    <p className="text-xs font-semibold uppercase text-muted">NexusHR</p>
                    <h1 className="mt-1 text-3xl font-bold text-ink">Sign in</h1>
                    <div className="mt-6 space-y-4">
                        <Field label="Email"><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
                        <Field label="Password" action={<button type="button" onClick={onForgotPassword} className="text-xs font-semibold text-brand hover:underline">Forgot password?</button>}>
                            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                        </Field>
                    </div>
                    {error ? <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
                    <button className="btn btn-primary mt-6 w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
                </form>
                <div className="mt-6 text-center"><p className="text-sm text-muted">Looking to join our team? <button onClick={onCareers} className="font-semibold text-brand hover:underline">View Open Positions & Apply</button></p></div>
            </div>
        </main>
    );
}

function ForgotPasswordScreen({ onBack }) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault(); setBusy(true); setStatus("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const data = await parseResponse(response);
            setStatus({ type: "success", text: data.message || "If that email exists, a reset link has been sent." });
        } catch (err) { setStatus({ type: "error", text: err.message || "An error occurred." }); } finally { setBusy(false); }
    }

    return (
        <main className="grid min-h-screen place-items-center bg-panel px-4">
            <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
                <h1 className="text-2xl font-bold text-ink">Reset Password</h1>
                {status.type === "success" ? (
                    <div className="p-4 mb-6 rounded-md border border-brand/20 bg-brand/5 text-sm font-medium text-brand">{status.text}</div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <Field label="Work Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
                        {status.type === "error" && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{status.text}</p>}
                        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Sending..." : "Send Reset Link"}</button>
                    </form>
                )}
                <div className="mt-6 text-center"><button type="button" onClick={onBack} className="text-sm font-semibold text-brand hover:underline">Back to Sign In</button></div>
            </div>
        </main>
    );
}

function ResetPasswordScreen({ resetToken, onDone }) {
    const [newPassword, setNewPassword] = useState("");
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault(); setBusy(true); setStatus("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, newPassword }) });
            const data = await parseResponse(response);
            setStatus({ type: "success", text: data.message || "Password successfully reset!" });
            setTimeout(onDone, 2500);
        } catch (err) { setStatus({ type: "error", text: err.message || "Invalid or expired token." }); } finally { setBusy(false); }
    }

    return (
        <main className="grid min-h-screen place-items-center bg-panel px-4">
            <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
                <h1 className="text-2xl font-bold text-ink">Create New Password</h1>
                {status.type === "success" ? (
                    <div className="p-4 mb-6 rounded-md border border-brand/20 bg-brand/5 text-sm font-medium text-brand text-center">{status.text}<br />Redirecting to sign in...</div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <Field label="New Password"><input className="field" type="password" minLength="8" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></Field>
                        {status.type === "error" && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{status.text}</p>}
                        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Updating..." : "Save Password"}</button>
                    </form>
                )}
            </div>
        </main>
    );
}

function Employees({ api, employees, refresh, runAction, userContext }) {
    const [form, setForm] = useState(defaultEmployee);
    const [role, setRole] = useState({ employeeId: "", department: "", designation: "", managerId: "" });
    const [securityRole, setSecurityRole] = useState({ employeeId: "", role: "EMPLOYEE" });

    async function createEmployee(event) {
        event.preventDefault();
        await runAction(async () => {
            const profile = form.annualSalary ? { annualSalary: Number(form.annualSalary) } : {};
            const employee = await api.post("/api/v1/employees", { employeeCode: form.employeeCode, firstName: form.firstName, lastName: form.lastName, workEmail: form.workEmail, joiningDate: form.joiningDate, profile });
            if (form.department && form.designation) await api.put(`/api/v1/employees/${employee.id}/role`, { department: form.department, designation: form.designation, managerId: null });
            setForm(defaultEmployee);
            await refresh();
        }, "Employee saved");
    }

    async function assignRole(event) {
        event.preventDefault();
        await runAction(async () => {
            await api.put(`/api/v1/employees/${role.employeeId}/role`, { department: role.department, designation: role.designation, managerId: role.managerId || null });
            setRole({ employeeId: "", department: "", designation: "", managerId: "" });
            await refresh();
        }, "Role updated");
    }

    async function assignSecurityRole(event) {
        event.preventDefault();
        if (!securityRole.employeeId) return;
        await runAction(async () => {
            await api.put(`/api/v1/employees/${securityRole.employeeId}/security-role`, { role: securityRole.role });
            setSecurityRole({ employeeId: "", role: "EMPLOYEE" });
            await refresh();
        }, `System clearance level successfully shifted to ${securityRole.role}`);
    }

    async function offboard(id) { await runAction(async () => { await api.post(`/api/v1/employees/${id}/offboarding`, {}); await refresh(); }, "Offboarding started"); }
    async function removeEmployee(id) { if (!window.confirm("Are you sure you want to permanently delete this employee?")) return; await runAction(async () => { await api.request("DELETE", `/api/v1/employees/${id}`); await refresh(); }, "Employee records permanently removed"); }
    async function toggleRemote(id, isCurrentlyRemote) { await runAction(async () => { await api.patch(`/api/v1/employees/${id}/remote?isRemote=${!isCurrentlyRemote}`); await refresh(); }, `Work model successfully updated.`); }

    return (
        <Page title="Employees" subtitle="Create employees, assign departments, and manage global workforce configurations.">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                <Panel title="Employee directory">
                    <DataTable
                        columns={["Code", "Name", "Email", "Team", "Work Model", "Status", "Actions"]}
                        rows={employees.map((employee) => [
                            employee.employeeCode, `${employee.firstName} ${employee.lastName}`, employee.workEmail,
                            [employee.department, employee.designation].filter(Boolean).join(" / ") || "-",
                            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${employee.remote ? "bg-brand/10 text-brand" : "bg-panel border border-line text-ink"}`}>{employee.remote ? "REMOTE" : "OFFICE"}</span>,
                            <Badge value={employee.status} />,
                            <div className="flex flex-wrap gap-1.5" key={employee.id}>
                                <button className="btn btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => toggleRemote(employee.id, !!employee.remote)}>{employee.remote ? "Set to Office" : "Set to Remote"}</button>
                                <button className="btn btn-secondary min-h-8 px-2.5 py-1 text-xs" onClick={() => offboard(employee.id)}>Offboard</button>
                                <button className="btn min-h-8 px-2.5 py-1 text-xs bg-coral/10 text-coral hover:bg-coral/20 border border-coral/20 rounded-md font-semibold" onClick={() => removeEmployee(employee.id)}>Delete</button>
                            </div>
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
                    <Panel title="Assign operational role">
                        <form className="grid gap-3" onSubmit={assignRole}>
                            <EmployeeSelect employees={employees} value={role.employeeId} onChange={(employeeId) => setRole({ ...role, employeeId })} />
                            <Input label="Department" value={role.department} onChange={(department) => setRole({ ...role, department })} required />
                            <Input label="Designation" value={role.designation} onChange={(designation) => setRole({ ...role, designation })} required />
                            <Input label="Manager ID" value={role.managerId} onChange={(managerId) => setRole({ ...role, managerId })} />
                            <button className="btn btn-primary">Update role</button>
                        </form>
                    </Panel>

                    {(userContext?.roles?.includes("ADMIN") || userContext?.roles?.includes("HR")) && (
                        <Panel title="Assign security platform authorization">
                            <form className="grid gap-3" onSubmit={assignSecurityRole}>
                                <EmployeeSelect employees={employees} value={securityRole.employeeId} onChange={(employeeId) => setSecurityRole({ ...securityRole, employeeId })} />
                                <Select label="System permission tier clearance" value={securityRole.role} onChange={(role) => setSecurityRole({ ...securityRole, role })} options={userContext?.roles?.includes("ADMIN") ? ["EMPLOYEE", "MANAGER", "HR", "ADMIN"] : ["EMPLOYEE", "MANAGER", "HR"]} />
                                <button className="btn btn-primary">Commit permission shift</button>
                            </form>
                        </Panel>
                    )}
                </div>
            </div>
        </Page>
    );
}

function Attendance({ api, employees, selectedEmployee, refreshAttendance, runAction, userContext }) {
    const [employeeId, setEmployeeId] = useState(selectedEmployee);
    const [leave, setLeave] = useState({ leaveType: "ANNUAL", startDate: today, endDate: today, reason: "" });
    const [balances, setBalances] = useState([]);
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);

    useEffect(() => { setEmployeeId(selectedEmployee); }, [selectedEmployee]);

    const isAdminOrHR = userContext?.roles?.some(r => r.includes("ADMIN") || r.includes("HR"));

    async function loadPendingLeaves() {
        if (userContext?.isEmployee) return;
        await runAction(async () => {
            const response = await api.get(`/api/v1/attendance/dashboard?date=${today}`);
            setPendingLeaves(response?.pendingRequests || response?.rawRequests || []);
            setAttendanceRecords(response?.todaysRecords || []);
        });
    }

    async function handleDecision(leaveId, statusString) {
        await runAction(async () => {
            await api.post(`/api/v1/attendance/leave-requests/${leaveId}/decision`, { status: statusString, approverId: employeeId || null });
            await loadPendingLeaves();
            await refreshAttendance();
        }, `Leave context has been updated to ${statusString}`);
    }

    async function punch(type) { await runAction(async () => { await api.post("/api/v1/attendance/biometric-punch", { employeeId, deviceId: "WEB-KIOSK-01", punchType: type }); await refreshAttendance(); }, `Punch ${type} recorded successfully`); }
    async function requestLeave(event) {
        event.preventDefault();
        await runAction(async () => {
            await api.post("/api/v1/attendance/leave-requests", { employeeId, ...leave });
            setLeave({ leaveType: "ANNUAL", startDate: today, endDate: today, reason: "" });
            if (!userContext?.isEmployee) await loadPendingLeaves();
        }, "Leave request submitted");
    }

    async function loadBalances() { await runAction(async () => { setBalances(await api.get(`/api/v1/attendance/employees/${employeeId}/leave-balances`)); }); }
    useEffect(() => { if (!userContext?.isEmployee) { loadPendingLeaves(); } }, [userContext]);

    function formatTimeWithColor(isoString, type) {
        if (!isoString) return <span className="text-muted">-</span>;
        const date = new Date(isoString);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let isRed = false;
        if (type === 'IN') { isRed = hours > 9 || (hours === 9 && minutes > 0); } else if (type === 'OUT') { isRed = hours < 17; }
        return <span className={`font-semibold ${isRed ? 'text-coral' : ''}`} style={{ color: !isRed ? '#10b981' : undefined }}>{timeString}</span>;
    }

    return (
        <Page title="Attendance Tracker" subtitle="Punch simulation logging tracks directly into the database layers.">
            <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="Clock Execution Terminal">
                    <div className="grid gap-3">
                        {!userContext?.isEmployee ? <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} /> : <div className="text-sm font-medium p-2 border border-line bg-panel rounded">Lock Bound Context Profile ID: <span className="font-mono text-xs text-brand">{employeeId || "resolving..."}</span></div>}
                        <div className="flex gap-2">
                            <button className="btn btn-primary flex-1" onClick={() => punch('IN')} disabled={!employeeId}>Punch IN</button>
                            <button className="btn flex-1 min-h-8 px-4 py-2 text-sm bg-coral/10 text-coral hover:bg-coral/20 border border-coral/20 rounded-md font-semibold" onClick={() => punch('OUT')} disabled={!employeeId}>Punch OUT</button>
                        </div>
                        <button className="btn btn-secondary" onClick={loadBalances} disabled={!employeeId}>Inspect Leave Balances</button>
                    </div>
                </Panel>
                <Panel title="Request Leave Absence">
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={requestLeave}>
                        <Select label="Leave type" value={leave.leaveType} onChange={(leaveType) => setLeave({ ...leave, leaveType })} options={["ANNUAL", "SICK", "CASUAL", "UNPAID"]} />
                        <div />
                        <Input label="Start date" type="date" value={leave.startDate} onChange={(startDate) => setLeave({ ...leave, startDate })} required />
                        <Input label="End date" type="date" value={leave.endDate} onChange={(endDate) => setLeave({ ...leave, endDate })} required />
                        <Field label="Reason"><textarea className="field min-h-24" value={leave.reason} onChange={(event) => setLeave({ ...leave, reason: event.target.value })} /></Field>
                        <button className="btn btn-primary self-end" disabled={!employeeId}>Submit leave</button>
                    </form>
                </Panel>
            </div>

            {isAdminOrHR && (
                <Panel title="Today's Attendance Logs" action={<button className="btn btn-secondary" onClick={loadPendingLeaves}>Refresh Logs</button>}>
                    {attendanceRecords.length ? (
                        <DataTable
                            columns={["Employee", "Punch In", "Punch Out", "Status"]}
                            rows={attendanceRecords.map((record) => {
                                const emp = employees.find((e) => e.id === record.employeeId);
                                const empName = emp ? `${emp.firstName} ${emp.lastName}` : shortId(record.employeeId);
                                return [ empName, formatTimeWithColor(record.checkInAt, "IN"), formatTimeWithColor(record.checkOutAt, "OUT"), <Badge value={record.status} /> ];
                            })}
                        />
                    ) : <Empty text="No punch records found for today." />}
                </Panel>
            )}

            {!userContext?.isEmployee && (
                <Panel title="Pending Leave Approvals Task Queue" action={<button className="btn btn-secondary" onClick={loadPendingLeaves}>Refresh Queue</button>}>
                    {pendingLeaves.length ? (
                        <DataTable
                            columns={["Employee", "Type", "Duration", "Reason", "Actions"]}
                            rows={pendingLeaves.map((req) => [
                                shortId(req.employeeId), req.leaveType, `${req.startDate} to ${req.endDate}`, req.reason || "-",
                                <div className="flex gap-1.5" key={req.id}>
                                    <button className="btn min-h-8 px-2.5 py-1 text-xs bg-brand text-white rounded-md font-semibold" onClick={() => handleDecision(req.id, "APPROVED")}>Approve</button>
                                    <button className="btn min-h-8 px-2.5 py-1 text-xs bg-coral/10 text-coral hover:bg-coral/20 border border-coral/20 rounded-md font-semibold" onClick={() => handleDecision(req.id, "REJECTED")}>Reject</button>
                                </div>
                            ])}
                        />
                    ) : <Empty text="No pending leave requests found requiring management review actions." />}
                </Panel>
            )}

            <Panel title="Leave balances status tracker">
                {balances.length ? (
                    <DataTable
                        columns={["Type", "Entitled", "Used", "Available"]}
                        rows={balances.map((item) => {
                            const entitled = Number(item.openingBalance || 0);
                            const used = Number(item.consumed || 0);
                            return [ item.leaveType, entitled, used, entitled - used ];
                        })}
                    />
                ) : <Empty text="No data streams parsed." />}
            </Panel>
        </Page>
    );
}

function Payroll({ api, selectedEmployee, runAction, userContext }) {
    const [run, setRun] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
    const [payrollRun, setPayrollRun] = useState(null);
    const [employeeId, setEmployeeId] = useState(selectedEmployee);
    const [payslips, setPayslips] = useState([]);

    useEffect(() => { setEmployeeId(selectedEmployee); }, [selectedEmployee]);

    async function calculate(event) {
        event.preventDefault();
        await runAction(async () => {
            const nextRun = await api.post("/api/v1/payroll/runs", { year: Number(run.year), month: Number(run.month) });
            setPayrollRun(nextRun);
        }, "Payroll calculated");
    }

    async function approve() { await runAction(async () => { setPayrollRun(await api.post(`/api/v1/payroll/runs/${payrollRun.id}/approve`, {})); }, "Payroll approved"); }
    async function loadPayslips() { await runAction(async () => { setPayslips(await api.get((!userContext?.isEmployee && payrollRun?.id) ? `/api/v1/payroll/runs/${payrollRun.id}/payslips` : `/api/v1/payroll/employees/${employeeId}/payslips`)); }); }

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
                        {userContext?.isEmployee ? <div className="text-sm font-medium p-2 border border-line bg-panel rounded w-full">Active verification token target: <span className="font-mono text-xs text-brand">{employeeId}</span></div> : <Input label="Employee ID lookup manual override" value={employeeId} onChange={setEmployeeId} />}
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

    useEffect(() => { setEmployeeId(selectedEmployee); }, [selectedEmployee]);

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

    useEffect(() => { if (employeeId && userContext?.isEmployee) { loadPerformance(); } }, [employeeId]);

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
                        <Field label="Dynamic Description Content Field"><textarea className="field min-h-24" value={goal.description} onChange={(event) => setGoal({ ...goal, description: event.target.value })} /></Field>
                        <button className="btn btn-primary" disabled={!employeeId}>Save goal</button>
                    </form>
                </Panel>

                {!userContext?.isEmployee && (
                    <Panel title="Create performance evaluation metrics matrix">
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={createReview}>
                            <Input label="Cycle" value={review.cycle} onChange={(cycle) => setReview({ ...review, cycle })} required />
                            <Input label="Manager rating" type="number" min="1" max="5" step="0.1" value={review.managerRating} onChange={(managerRating) => setReview({ ...run, managerRating })} required />
                            <Input label="Peer rating" type="number" min="1" max="5" step="0.1" value={review.peerRating} onChange={(peerRating) => setReview({ ...review, peerRating })} required />
                            <Input label="Self rating" type="number" min="1" max="5" step="0.1" value={review.selfRating} onChange={(selfRating) => setReview({ ...review, selfRating })} required />
                            <Field label="Feedback"><textarea className="field min-h-24" value={review.feedback} onChange={(event) => setReview({ ...review, feedback: event.target.value })} /></Field>
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

function Documents({ api, runAction, userContext, currentEmployeeId, token }) {
    const [file, setFile] = useState(null);
    const [documentType, setDocumentType] = useState("ID_CARD");

    const [pendingDocs, setPendingDocs] = useState([]);
    const [myDocs, setMyDocs] = useState([]);

    async function loadPending() { if (userContext?.isEmployee) return; await runAction(async () => { setPendingDocs(await api.get("/api/v1/documents/pending")); }); }
    async function loadMyDocs() { if (!userContext?.isEmployee || !currentEmployeeId) return; await runAction(async () => { setMyDocs(await api.get(`/api/v1/documents/me?employeeId=${currentEmployeeId}`)); }); }

    useEffect(() => { loadPending(); loadMyDocs(); }, [userContext, currentEmployeeId]);

    async function upload(event) {
        event.preventDefault();
        if (!file) return alert("Please select a file to upload.");
        if (!currentEmployeeId) return alert("System error: Missing Employee ID context.");

        const formData = new FormData();
        formData.append("file", file); formData.append("documentType", documentType); formData.append("employeeId", currentEmployeeId);

        await runAction(async () => { await api.post("/api/v1/documents/upload", formData, true); setFile(null); document.getElementById("file-upload-input").value = ""; await loadMyDocs(); }, "Document uploaded successfully. Awaiting management review.");
    }

    async function verifyDoc(id, isVerified) { await runAction(async () => { await api.patch(`/api/v1/documents/${id}/verify?verified=${isVerified}`); await loadPending(); }, `Document status successfully updated to ${isVerified ? "Approved" : "Rejected"}.`); }
    async function deleteMyDoc(docId) { if (!window.confirm("Are you sure you want to permanently delete this document?")) return; await runAction(async () => { await api.request("DELETE", `/api/v1/documents/${docId}?employeeId=${currentEmployeeId}`); await loadMyDocs(); }, "Document permanently deleted from the secure vault."); }

    async function viewDoc(docId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/documents/${docId}/download`, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error("Could not load file.");
            window.open(URL.createObjectURL(await response.blob()), '_blank');
        } catch (e) { alert("Failed to view document: " + e.message); }
    }

    return (
        <Page title="Document Compliance Center" subtitle="Secure vault for identity verification and corporate record tracking.">
            {userContext?.isEmployee ? (
                <div className="grid gap-6">
                    <Panel title="Submit New Record">
                        <form className="grid gap-4 sm:grid-cols-2" onSubmit={upload}>
                            <Select label="Document Category" value={documentType} onChange={setDocumentType} options={["ID_CARD", "PASSPORT", "TAX_FORM", "CERTIFICATION", "OFFER_LETTER"]} />
                            <Field label="Target File"><input id="file-upload-input" type="file" className="field pt-1.5 cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20" onChange={(e) => setFile(e.target.files[0])} required /></Field>
                            <button className="btn btn-primary sm:col-span-2">Upload and Request Approval</button>
                        </form>
                    </Panel>

                    <Panel title="My Uploaded Records" action={<button className="btn btn-secondary" onClick={loadMyDocs}>Refresh</button>}>
                        {myDocs.length ? (
                            <DataTable
                                columns={["Type", "File Name", "Status", "Actions"]}
                                rows={myDocs.map(doc => [
                                    <Badge value={doc.documentType} />, doc.fileName,
                                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${doc.verified ? "bg-brand text-white" : "bg-gold/20 text-gold"}`}>{doc.verified ? "APPROVED" : "PENDING"}</span>,
                                    <div className="flex gap-1.5" key={doc.id}>
                                        <button className="btn min-h-8 px-2.5 py-1 text-xs bg-panel border border-line rounded-md hover:bg-line font-semibold" onClick={() => viewDoc(doc.id)}>View</button>
                                        <button className="btn min-h-8 px-2.5 py-1 text-xs bg-coral/10 text-coral border border-coral/20 rounded-md hover:bg-coral/20 font-semibold" onClick={() => deleteMyDoc(doc.id)}>Delete</button>
                                    </div>
                                ])}
                            />
                        ) : <Empty text="You have not uploaded any records yet." />}
                    </Panel>
                </div>
            ) : (
                <Panel title="Pending Verification Queue" action={<button className="btn btn-secondary" onClick={loadPending}>Refresh Queue</button>}>
                    {pendingDocs.length ? (
                        <DataTable
                            columns={["Owner ID", "Type", "File Name", "Actions"]}
                            rows={pendingDocs.map(doc => [
                                <span className="font-mono text-xs">{shortId(doc.employeeId)}</span>, <Badge value={doc.documentType} />, doc.fileName,
                                <div className="flex gap-1.5" key={doc.id}>
                                    <button className="btn min-h-8 px-2.5 py-1 text-xs bg-panel border border-line rounded-md hover:bg-line font-semibold" onClick={() => viewDoc(doc.id)}>View</button>
                                    <button className="btn min-h-8 px-2.5 py-1 text-xs bg-brand text-white rounded-md font-semibold" onClick={() => verifyDoc(doc.id, true)}>Approve</button>
                                    <button className="btn min-h-8 px-2.5 py-1 text-xs bg-coral/10 text-coral border border-coral/20 rounded-md hover:bg-coral/20 font-semibold" onClick={() => verifyDoc(doc.id, false)}>Reject</button>
                                </div>
                            ])}
                        />
                    ) : <Empty text="Zero items in the queue. All compliance checks complete." />}
                </Panel>
            )}
        </Page>
    );
}

function VideoMeeting({ candidate, onClose, userContext }) {
    const roomName = `NexusHR-Interview-${candidate.id}`;
    const domain = "meet.jit.si";
    return (
        <div className="fixed inset-0 z-50 bg-panel flex flex-col">
            <div className="flex items-center justify-between bg-white border-b border-line px-6 py-3 shadow-sm">
                <div><h2 className="text-lg font-bold text-ink">Active Interview: {candidate.name}</h2><p className="text-xs font-semibold text-brand">Target Role: {candidate.targetRole}</p></div>
                <div className="flex items-center gap-4">
                    <p className="text-xs text-muted">Share this link with candidate: <br/><code className="bg-panel px-1 py-0.5 rounded select-all">https://{domain}/{roomName}</code></p>
                    <button className="btn min-h-8 px-4 py-2 text-sm bg-coral/10 text-coral hover:bg-coral/20 border border-coral/20 rounded-md font-bold" onClick={onClose}>End Interview</button>
                </div>
            </div>
            <div className="flex-1 bg-ink"><iframe src={`https://${domain}/${roomName}?userInfo.displayName="${userContext?.email}"`} allow="camera; microphone; fullscreen; display-capture; autoplay" style={{ width: '100%', height: '100%', border: 'none' }} title="Interview Room" /></div>
        </div>
    );
}

function Recruitment({ api, runAction, userContext }) {
    const [candidates, setCandidates] = useState([]);
    const [activeMeeting, setActiveMeeting] = useState(null);

    async function loadCandidates() { await runAction(async () => { setCandidates(await api.get("/api/v1/recruitment/candidates")); }); }
    useEffect(() => { loadCandidates(); }, []);

    async function updateStatus(id, newStatus) { await runAction(async () => { await api.patch(`/api/v1/recruitment/candidates/${id}/status`, { status: newStatus }); await loadCandidates(); }, `Candidate moved to ${newStatus}`); }

    if (activeMeeting) return <VideoMeeting candidate={activeMeeting} onClose={() => setActiveMeeting(null)} userContext={userContext} />;

    return (
        <Page title="Applicant Tracking System" subtitle="Manage incoming applications and coordinate interviews.">
            <Panel title="Candidate Pipeline" action={<button className="btn btn-secondary" onClick={loadCandidates}>Refresh</button>}>
                {candidates.length ? (
                    <DataTable
                        columns={["Name", "Email", "Target Role", "Applied", "Status", "Actions"]}
                        rows={candidates.map(c => [
                            <span className="font-semibold" key={`name-${c.id}`}>{c.name}</span>, c.email, c.targetRole, c.appliedDate, <Badge value={c.status} key={`badge-${c.id}`}/>,
                            <div className="flex gap-1.5" key={c.id}>
                                {c.status === "INTERVIEWING" ? <button className="btn min-h-8 px-2.5 py-1 text-xs bg-brand text-white rounded-md font-semibold flex items-center gap-1 shadow-sm" onClick={() => setActiveMeeting(c)}>🎥 Join Call</button> : <button className="btn min-h-8 px-2.5 py-1 text-xs bg-brand/10 text-brand hover:bg-brand/20 rounded-md font-semibold" onClick={() => updateStatus(c.id, "INTERVIEWING")}>Schedule</button>}
                                <button className="btn min-h-8 px-2.5 py-1 text-xs bg-panel border border-line text-ink hover:bg-line rounded-md font-semibold" onClick={() => updateStatus(c.id, "HIRED")}>Hire</button>
                                <button className="btn min-h-8 px-2.5 py-1 text-xs bg-coral/10 text-coral hover:bg-coral/20 rounded-md font-semibold" onClick={() => updateStatus(c.id, "REJECTED")}>Reject</button>
                            </div>
                        ])}
                    />
                ) : <Empty text="No candidates have applied yet." />}
            </Panel>
        </Page>
    );
}

function Insights({ api, insights, selectedEmployee, refresh, runAction }) {
    const [employeeId, setEmployeeId] = useState(selectedEmployee);
    const [employeeInsight, setEmployeeInsight] = useState(null);

    async function loadEmployeeInsight() { await runAction(async () => { setEmployeeInsight(await api.get(`/api/v1/insights/employees/${employeeId}`)); }); }

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
        await runAction(async () => { await api.post("/api/v1/notifications", form); setForm({ recipient: "", channel: "EMAIL", subject: "", body: "" }); }, "Notification queued");
    }

    return (
        <Page title="Notifications" subtitle="Queue email, SMS, or in-app notifications through the backend service.">
            <Panel title="Send notification">
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
                    <Input label="Recipient" value={form.recipient} onChange={(recipient) => setForm({ ...form, recipient })} required />
                    <Select label="Channel" value={form.channel} onChange={(channel) => setForm({ ...form, channel })} options={["EMAIL", "SMS", "IN_APP"]} />
                    <Input label="Subject" value={form.subject} onChange={(subject) => setForm({ ...form, subject })} required />
                    <div />
                    <Field label="Body"><textarea className="field min-h-32" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></Field>
                    <button className="btn btn-primary self-end">Queue notification</button>
                </form>
            </Panel>
        </Page>
    );
}

function Page({ title, subtitle, children }) { return ( <section className="space-y-4 px-4 py-6 lg:px-8"> <div> <h2 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h2> <p className="mt-1 text-sm text-muted">{subtitle}</p> </div> {children} </section> ); }
function Panel({ title, action, children }) { return ( <section className="rounded-lg border border-line bg-white shadow-sm"> <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-3"> <h3 className="text-base font-bold text-ink">{title}</h3> {action} </div> <div className="p-4">{children}</div> </section> ); }
function Stat({ label, value }) { return ( <div className="rounded-lg border border-line bg-white p-4 shadow-sm"> <p className="text-sm font-medium text-muted">{label}</p> <p className="mt-2 text-3xl font-bold text-ink">{value}</p> </div> ); }
function DataTable({ columns, rows }) { if (!rows.length) return <Empty text="No records found." />; return ( <div className="overflow-x-auto"> <table className="min-w-full border-separate border-spacing-0 text-left text-sm"> <thead> <tr> {columns.map((column) => ( <th key={column} className="border-b border-line bg-panel px-3 py-2 text-xs font-semibold uppercase text-muted">{column}</th> ))} </tr> </thead> <tbody> {rows.map((row, rowIndex) => ( <tr key={rowIndex}> {row.map((cell, cellIndex) => ( <td key={cellIndex} className="border-b border-line px-3 py-3 align-top text-ink">{cell}</td> ))} </tr> ))} </tbody> </table> </div> ); }
function Field({ label, action, children }) { return ( <label className="block"> <div className="flex justify-between items-center mb-1"> <span className="label block">{label}</span> {action} </div> {children} </label> ); }
function Input({ label, value, onChange, type = "text", ...props }) { return ( <Field label={label}> <input className="field" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...props} /> </Field> ); }
function Select({ label, value, onChange, options }) { return ( <Field label={label}> <select className="field" value={value} onChange={(event) => onChange(event.target.value)}> {options.map((option) => <option key={option} value={option}>{option}</option>)} </select> </Field> ); }
function EmployeeSelect({ employees, value, onChange }) { return ( <Field label="Employee"> <select className="field" value={value || ""} onChange={(event) => onChange(event.target.value)} required> <option value="">Choose employee</option> {employees.map((employee) => ( <option key={employee.id} value={employee.id}> {employee.employeeCode} - {employee.firstName} {employee.lastName} </option> ))} </select> </Field> ); }
function Badge({ value }) { return <span className="inline-flex rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">{value || "-"}</span>; }
function Empty({ text }) { return <p className="rounded-md border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-muted">{text}</p>; }
function InsightCard({ insight }) { return ( <div className="rounded-lg border border-line bg-panel p-4"> <p className="text-xs font-semibold uppercase text-muted">{shortId(insight.employeeId)}</p> <div className="mt-3 grid grid-cols-2 gap-2"> <Stat label="Attrition risk" value={formatPercent(insight.attritionRisk)} /> <Stat label="Engagement" value={formatPercent(insight.engagementScore)} /> </div> <p className="mt-4 text-sm font-semibold text-ink">Skill gaps</p> <p className="mt-1 text-sm text-muted">{(insight.skillGaps || []).join(", ") || "-"}</p> <p className="mt-4 text-sm font-semibold text-ink">Recommendations</p> <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted"> {(insight.recommendations || ["No recommendations"]).map((item) => <li key={item}>{item}</li>)} </ul> </div> ); }

function createApi(token) {
    async function request(method, path, body, isFormData = false) {
        const absolutePath = `${API_BASE_URL}${path}`;
        const headers = { Authorization: `Bearer ${token}` };
        if (!isFormData) headers["Content-Type"] = "application/json";
        const response = await fetch(absolutePath, { method, headers, body: isFormData ? body : (body === undefined ? undefined : JSON.stringify(body)) });
        return parseResponse(response);
    }
    return {
        get: (path) => request("GET", path),
        post: (path, body, isFormData) => request("POST", path, body, isFormData),
        put: (path, body) => request("PUT", path, body),
        patch: (path, body) => request("PATCH", path, body),
        request: (method, path, body, isFormData) => request(method, path, body, isFormData)
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
function money(value) { const number = Number(value || 0); return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(number); }
function formatPercent(value) { if (value === undefined || value === null || value === "-") return "-"; return `${Math.round(Number(value))}%`; }

export default App;