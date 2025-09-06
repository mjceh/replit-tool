# Overview

Facebook Auto-Post is a web-based tool designed to automate posting content to multiple Facebook groups simultaneously. The application provides a mobile-optimized interface for users to compose posts, select target groups, and execute batch posting operations. It features group management capabilities, post preview functionality, and real-time progress tracking during the posting process.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a traditional web architecture with vanilla HTML, CSS, and JavaScript. The frontend is built as a single-page application with:

- **Mobile-first responsive design** using CSS custom properties and flexbox layouts
- **Component-based UI structure** with distinct sections for post composition, group selection, and progress tracking
- **Real-time updates** via EventSource for streaming progress updates during posting operations
- **Local storage integration** for persisting user preferences and group sets
- **File upload handling** for image attachments with client-side preview

## Backend Architecture
The backend is implemented as a Flask-based Python proxy server that:

- **Acts as a middleware** between the frontend and Facebook's GraphQL API
- **Handles authentication** using Facebook's dtsg tokens and cookie-based sessions
- **Implements request proxying** with optional HTTP proxy support for development/debugging
- **Provides streaming endpoints** for real-time progress updates during bulk operations
- **Manages Facebook API interactions** including group fetching and post creation

## Authentication Strategy
The system uses Facebook's session-based authentication:

- **Cookie-based sessions** with Facebook's authentication cookies
- **DTSG token validation** for CSRF protection
- **AV (user ID) parameter** for user identification
- **Direct GraphQL API communication** bypassing Facebook's official SDK

## Data Flow
The application follows a client-server-proxy pattern:

1. **Frontend** sends requests to the Flask proxy server
2. **Proxy server** forwards requests to Facebook's GraphQL API
3. **Facebook API** responses are processed and forwarded back to the frontend
4. **Real-time updates** are streamed back via Server-Sent Events

# External Dependencies

## Facebook Integration
- **Facebook GraphQL API** - Primary interface for all Facebook operations
- **Facebook Authentication System** - Session-based authentication using cookies and DTSG tokens

## Python Backend Dependencies
- **Flask** - Web framework for the proxy server
- **Requests** - HTTP client library for API communication
- **urllib3** - Low-level HTTP client with proxy support

## Development Tools
- **HTTP Proxy Support** - Optional integration with tools like Burp Suite for debugging
- **SSL Verification Controls** - Configurable SSL verification for development environments

## Browser APIs
- **EventSource API** - For real-time progress updates
- **File API** - For image upload and preview functionality
- **localStorage API** - For persisting user data and preferences

## Note on Database
The current implementation does not use a traditional database. All data persistence is handled through:
- **Browser localStorage** for client-side data (group sets, preferences)
- **Facebook's servers** as the primary data source for groups and posts
- **In-memory storage** in the Flask application for temporary session data