# Test accounts

All seeded accounts use the same password:

```
Password123!
```

Re-create them at any time with:

```powershell
cd backend
npm.cmd run db:seed
```

## ABC Technologies

| Name | Email | Role | Branch access |
| --- | --- | --- | --- |
| Rahul Sharma | `rahul@abctech.dev` | Org Admin | All branches: Hyderabad, Bangalore, Chennai |
| Priya Nair | `priya@abctech.dev` | Tenant Admin | Hyderabad |
| Arjun Reddy | `arjun@abctech.dev` | Member | Hyderabad |
| Sneha Iyer | `sneha@abctech.dev` | Tenant Admin | Bangalore |
| Aisha Khan | `aisha@abctech.dev` | Member | Chennai |

## XYZ Solutions

| Name | Email | Role | Branch access |
| --- | --- | --- | --- |
| Meera Joshi | `meera@xyzsolutions.dev` | Org Admin | All branches: Mumbai, Pune |
| Kiran Patil | `kiran@xyzsolutions.dev` | Member | Mumbai |

## Suggested test scenarios

| Goal | Sign in as | What to check |
| --- | --- | --- |
| Full admin view | `rahul@abctech.dev` | Org switcher, all branches, member management |
| Tenant admin limits | `priya@abctech.dev` | Can manage Hyderabad boards, cannot delete the branch |
| Member limits | `arjun@abctech.dev` | Can move/create tasks, cannot manage boards or columns |
| Cross-tenant isolation | `meera@xyzsolutions.dev` | Sees only XYZ Solutions data; ABC branch ids return 403/404 |
| Real-time presence | `rahul@abctech.dev` + `priya@abctech.dev` in two browsers | Live cursors/presence and instant task moves |
| Conflict handling | Same task open in two browsers | Second stale save returns a 409 conflict dialog |

## API smoke test (PowerShell)

```powershell
$body = @{ email = 'rahul@abctech.dev'; password = 'Password123!' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/auth/login `
  -Method POST -ContentType 'application/json' -Body $body `
  -SessionVariable session

# The tenant id comes from the login response's memberships.
Invoke-RestMethod -Uri http://localhost:5000/api/boards `
  -Headers @{ 'X-Tenant-Id' = '<tenant-id-from-memberships>' } -WebSession $session
```
