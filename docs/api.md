# API Conventions

- Base URL: `/api`
- Auth: `Authorization: Bearer <jwt>`
- Core endpoints:
  - `GET /products`
  - `POST /products`
  - `PATCH /products/:id`
  - `DELETE /products/:id`
  - `GET /inventory`
  - `POST /transfers`
  - `PATCH /transfers/:id/approve`
  - `PATCH /transfers/:id/reject`
  - `PATCH /transfers/:id/complete`

## Example: Login

Request:
```json
{
  "email": "admin@inventory.local",
  "password": "Admin@123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "user": {
      "id": "usr_1",
      "name": "System Admin",
      "role": "ADMIN"
    }
  }
}
```
