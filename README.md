# NexusHR Frontend

React + Vite + Tailwind CSS frontend for the NexusHR Spring Boot backend.

## Requirements

- Node.js 20+
- NexusHR backend running on `http://localhost:8080`

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The Vite dev server proxies `/api` and `/actuator` requests to the backend, so the backend does not need a separate CORS configuration during local development.

Default backend login:

```text
email: admin@nexushr.local
password: ChangeMe123!
```

## Covered Backend Areas

- `POST /api/v1/auth/login`
- Employee directory, creation, role assignment, and offboarding
- Attendance punch, leave request, leave balance, and attendance dashboard
- Payroll calculation, approval, payslip lookup, and CSV export
- Performance goals and reviews
- Organization and employee workforce insights
- Notification queueing
