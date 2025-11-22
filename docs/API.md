# API Documentation

Base URL: `http://localhost:4000`

All authenticated endpoints require the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

## Authentication

### Register User

**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" // optional
}
```

**Response:** `201 Created`
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Login

**POST** `/auth/login`

Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Logout

**POST** `/auth/logout`

🔒 Requires authentication

Invalidate the current session.

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

### Get Session

**GET** `/auth/session`

🔒 Requires authentication

Get current user session information.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## User Management

### Get Current User

**GET** `/user/me`

🔒 Requires authentication

Get detailed information about the current user.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "organizationId": "uuid",
    "organization": {
      "id": "uuid",
      "name": "My Organization"
    }
  }
}
```

### Update User

**PUT** `/user/update`

🔒 Requires authentication

Update user profile information.

**Request Body:**
```json
{
  "name": "Jane Doe", // optional
  "password": "newpassword123" // optional
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create API Key

**POST** `/user/api-key`

🔒 Requires authentication

Generate a new API key for programmatic access.

**Response:** `201 Created`
```json
{
  "apiKey": {
    "id": "uuid",
    "key": "vf_abc123...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### List API Keys

**GET** `/user/api-keys`

🔒 Requires authentication

Get all API keys for the current user.

**Response:** `200 OK`
```json
{
  "apiKeys": [
    {
      "id": "uuid",
      "key": "vf_abc123...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Delete API Key

**DELETE** `/user/api-key/:id`

🔒 Requires authentication

Delete a specific API key.

**Response:** `200 OK`
```json
{
  "message": "API key deleted successfully"
}
```

## Projects

### Create Project

**POST** `/projects/create`

🔒 Requires authentication

Create a new automation project.

**Request Body:**
```json
{
  "name": "My Automation",
  "description": "Automate form filling" // optional
}
```

**Response:** `201 Created`
```json
{
  "project": {
    "id": "uuid",
    "userId": "uuid",
    "name": "My Automation",
    "description": "Automate form filling",
    "plan": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### List Projects

**GET** `/projects/list`

🔒 Requires authentication

Get all projects for the current user.

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Automation",
      "description": "Automate form filling",
      "plan": { /* plan object */ },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "executions": [
        {
          "id": "uuid",
          "status": "completed",
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Get Project

**GET** `/projects/:id`

🔒 Requires authentication

Get detailed information about a specific project.

**Response:** `200 OK`
```json
{
  "project": {
    "id": "uuid",
    "name": "My Automation",
    "description": "Automate form filling",
    "plan": {
      "summary": "Fill out the contact form",
      "steps": [
        {
          "id": 1,
          "action": "navigate",
          "description": "Navigate to the website",
          "target": "https://example.com/contact"
        }
      ]
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "executions": []
  }
}
```

### Update Project

**PUT** `/projects/:id/update`

🔒 Requires authentication

Update project information.

**Request Body:**
```json
{
  "name": "Updated Name", // optional
  "description": "Updated description", // optional
  "plan": { /* plan object */ } // optional
}
```

**Response:** `200 OK`
```json
{
  "project": { /* updated project */ }
}
```

### Delete Project

**DELETE** `/projects/:id/delete`

🔒 Requires authentication

Delete a project and all its executions.

**Response:** `200 OK`
```json
{
  "message": "Project deleted successfully"
}
```

## Agent Interaction

### Chat with Agent

**POST** `/agent/chat`

🔒 Requires authentication

Send a message to the AI agent to generate an automation plan.

**Request Body:**
```json
{
  "projectId": "uuid",
  "prompt": "Fill out a contact form on example.com with my details"
}
```

**Response:** `200 OK`
```json
{
  "plan": {
    "summary": "Fill out the contact form with user details",
    "steps": [
      {
        "id": 1,
        "action": "navigate",
        "description": "Navigate to the contact page",
        "target": "https://example.com/contact"
      },
      {
        "id": 2,
        "action": "type",
        "description": "Enter name in the name field",
        "target": "#name",
        "value": "John Doe"
      },
      {
        "id": 3,
        "action": "click",
        "description": "Click the submit button",
        "target": "#submit"
      }
    ]
  },
  "response": "I'll help you fill out the contact form...",
  "message": "Plan generated successfully"
}
```

### Run Automation

**POST** `/agent/run`

🔒 Requires authentication

Execute the automation plan for a project.

**Request Body:**
```json
{
  "projectId": "uuid"
}
```

**Response:** `202 Accepted`
```json
{
  "execution": {
    "id": "uuid",
    "status": "running",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Execution started"
}
```

### Get Execution Status

**GET** `/agent/execution/:executionId`

🔒 Requires authentication

Get the status and results of an execution.

**Response:** `200 OK`
```json
{
  "execution": {
    "id": "uuid",
    "projectId": "uuid",
    "status": "completed",
    "logs": null,
    "result": {
      "success": true,
      "results": [
        {
          "stepId": 1,
          "action": "navigate",
          "success": true,
          "result": { "success": true, "url": "https://example.com" }
        }
      ],
      "summary": "Executed 3 steps"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:01:00.000Z",
    "project": {
      "id": "uuid",
      "name": "My Automation"
    }
  }
}
```

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message or array of errors"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

The API includes rate limiting (100 requests per 15 minutes per IP).

When rate limited, you'll receive:
```json
{
  "error": "Too many requests, please try again later"
}
```

## Execution Status Values

- `pending` - Queued for execution
- `running` - Currently executing
- `completed` - Successfully completed
- `failed` - Failed with errors

## Automation Actions

Available actions in automation plans:

- `navigate` - Navigate to a URL
- `click` - Click an element
- `type` - Type text into a field
- `extract` - Extract text from an element
- `screenshot` - Take a screenshot
- `wait` - Wait for a specified time
