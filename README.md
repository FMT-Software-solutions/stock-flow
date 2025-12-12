# Stock Flow

A comprehensive React application project for FMT Software Solutions that can be packaged as both an Electron desktop app and a web application. This project includes user management, app versioning system, and a complete Supabase backend setup.

## 🚀 Features

- **React 19** with TypeScript
- **React Router DOM** with HashRouter for Electron compatibility
- **Comprehensive Authentication System** with protected routes
- **Electron** support for desktop applications
- **Supabase** integration for backend services
- **User Management System** with authentication and profiles
- **App Versioning System** for release management
- **Auto-Update System** for seamless application updates
- **Row Level Security (RLS)** policies for data protection
- **Tailwind CSS v4** for styling
- **shadcn/ui** component library
- **Bun** as package manager and runtime
- **TypeScript** with comprehensive type definitions

## 📋 Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Node.js](https://nodejs.org/) (v20 or higher)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for database management)
- A Supabase project (hosted)

## 🛠️ Getting Started

### 1. Clone and Setup

```bash
git clone <repository-url>
cd stock-flow
```

### 2. Run Setup Script

**Important:** Run the setup script first to customize your project:

```bash
node scripts/setup.js
```

This script will automatically update all template references across the codebase with your project details. See the [Template Customization](#-template-customization) section below for detailed information about what gets updated.

### 3. Install Dependencies

```bash
bun install
```

### 4. Environment Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env or .env.local
   ```

2. Update `.env` with your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_DOWNLOADS_PAGE_URL=https://your-website.com/downloads
   ```

### 5. Database Setup

**Simple Setup:** This template includes a complete database snapshot that sets up everything in one go.

```bash
# Using Supabase CLI (Recommended)
supabase db reset
```

**Using Supabase Dashboard:**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/dump.sql`
4. Execute the SQL

**What's Included in dump.sql:**

- All database tables (user_profiles, auth_users, app_versions, etc.)
- Row Level Security (RLS) policies
- Database functions and triggers
- Indexes and constraints
- Sample data (if any)

**Note:** The `supabase/dump.sql` file contains the complete database schema and replaces the need for individual migration files.

### 6. Edge Function Authentication

**Important:** This template includes secure edge functions that use Supabase's native authentication system to prevent unauthorized access.

#### Authentication Method:

Edge functions in this template use **Supabase Auth tokens** for security:

- **Authenticated Requests:** Users with valid session tokens can access edge functions
- **Anonymous Requests:** Unauthenticated users can access specific functions (like OTP requests) using the anon key

#### Setup Steps:

1. **Deploy All Edge Functions:**

   ```bash
   # Deploy all edge functions
   supabase functions deploy send-otp
   supabase functions deploy submit-issue
   supabase functions deploy publish-releases
   ```

2. **Create Storage Bucket:**

   - Go to your Supabase project dashboard
   - Navigate to Storage
   - Create a new bucket (e.g., "org-logos" or as needed by your application)
   - Configure bucket policies as required

3. **Configure Email Service (Required for OTP):**
   - Go to your Supabase project dashboard
   - Navigate to Edge Functions → Settings
   - Add a new secret: `RESEND_API_KEY`
   - Get your API key from [Resend.com](https://resend.com)

#### Security Features:

- **Native Auth Integration:** Uses Supabase's authentication system
- **Token Validation:** Verifies user sessions and permissions
- **RLS Compliance:** Works seamlessly with Row Level Security
- **Flexible Access:** Supports both authenticated and anonymous requests

#### Edge Functions Included:

- **send-otp:** Secure OTP generation and email delivery for authentication
- **submit-issue:** Issue reporting with optional image upload via Cloudinary
- **publish-releases:** Application release management (if applicable)

#### How It Works:

- Frontend sends requests with `Authorization: Bearer <token>` header
- Edge functions verify the token using Supabase Auth
- Authenticated users get full access, anonymous users get limited access
- No secrets exposed to the frontend bundle

### 7. Cloudinary Configuration (Optional)

**For Image Upload Functionality:** The template includes a secure server-side image upload system using Cloudinary for the issue reporting feature.

#### Setup Steps:

1. **Create a Cloudinary Account:**

   - Sign up at [Cloudinary.com](https://cloudinary.com)
   - Get your Cloud Name, API Key, and API Secret from the dashboard

2. **Configure Edge Function Secrets:**

   In your Supabase project dashboard, go to Edge Functions → Settings and add these secrets:

   ```
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

3. **Deploy the submit-issue Function:**

   ```bash
   supabase functions deploy submit-issue
   ```

#### Security Features:

- **Server-Side Uploads:** Images are uploaded securely from the edge function
- **Signed Authentication:** Uses Cloudinary's signed upload API for security
- **No Client Secrets:** API secrets are never exposed to the frontend
- **Organized Storage:** Images are automatically organized in folders

#### How It Works:

- Users can attach screenshots when reporting issues
- Images are sent to the edge function via FormData
- Edge function generates signed upload parameters
- Images are uploaded to Cloudinary with proper authentication
- Secure URLs are stored in the database

**Note:** Image upload is optional. The issue reporting system works without Cloudinary configuration, but users won't be able to attach screenshots.

### 8. Development

```bash
# Start development server
bun run dev

# Build for production
bun run build
```

### 8. Electron (Desktop App)

```bash
# Install Electron dependencies
bun add -D electron electron-builder

# Run as desktop app
bun run electron:dev

# Build desktop app
bun run electron:build
```

## 📊 Database Schema

### Tables Overview

1. **profiles** - User profile information

   - Personal details (name, email, phone, etc.)
   - Avatar and demographic data
   - RLS enabled for authenticated users

2. **auth_users** - Authentication metadata

   - Links to auth.users and profiles
   - Login tracking and user flags
   - RLS enabled for authenticated users

3. **app_versions** - Application release management
   - Version information and release notes
   - Platform-specific downloads
   - Release status and critical update flags
   - RLS enabled for authenticated users

### Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Authenticated user access** - Only logged-in users can access data
- **Foreign key constraints** for data integrity
- **Unique constraints** to prevent duplicates

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   │   ├── AuthRoute.tsx      # Auth page access control
│   │   └── ProtectedRoute.tsx # Protected route authentication
│   ├── layout/         # Layout components
│   │   ├── Header.tsx         # Fixed header with user info
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── MainLayout.tsx     # Main layout wrapper
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── hooks/              # Custom React hooks
│   ├── queries.ts             # React Query hooks
│   ├── useDebounce.ts         # Debounce hook
│   ├── useLocalStorage.ts     # LocalStorage hook
│   └── useBranchesPreferences.ts # Organization-specific branch preferences
├── pages/              # Application pages
│   ├── auth/          # Authentication pages
│   │   ├── Login.tsx          # Login page
│   │   └── PasswordReset.tsx  # Password reset page
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Users.tsx       # User management
│   ├── AppVersions.tsx # Version management
│   ├── Settings.tsx    # Application settings
│   └── TestRoutes.tsx  # Development testing (dev only)
├── router/             # Routing configuration
│   └── AppRouter.tsx   # Main router setup
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
│   ├── app-versions.ts # App versioning types
│   ├── user-management.ts # User and profile types
│   └── index.ts        # Type exports
├── utils/              # Utility functions
│   └── supabase.ts     # Supabase client configuration
└── ...

supabase/
├── functions/          # Edge functions
│   ├── send-otp/       # OTP email delivery
│   ├── submit-issue/   # Issue reporting with Cloudinary
│   └── publish-releases/ # Release publishing API
├── migrations/         # Individual migration files (legacy)
└── dump.sql           # Complete database snapshot (recommended)
```

## 🧭 Routing System

### Route Structure

The application uses **HashRouter** for Electron compatibility with the following route structure:

#### Public Routes (Unauthenticated)

- `/login` - User login page
- `/password-reset` - Password reset page
- `/new-password` - New password page

#### Protected Routes (Authenticated)

- **All routes are protected by default** except those explicitly defined as public or session-required
- `/dashboard` - Main dashboard (default after login)
- Any new routes you add will automatically be protected

### Authentication Flow

1. **Unauthenticated users** are redirected to `/login`
2. **Authenticated users** accessing auth pages are redirected to `/dashboard`
3. **Route protection** uses two specialized components:
   - **AuthRoute**: Manages access to auth pages (`/login`, `/password-reset`, `/new-password`)
   - **ProtectedRoute**: Handles authentication for all protected application routes
4. **Authentication state** is managed by `AuthContext`

### Adding New Routes

When adding new routes to your application:

- **Protected routes**: Wrap with `ProtectedRoute` in AppRouter
- **Auth routes**: Wrap with `AuthRoute` in AppRouter (rare - only for new auth pages)
- **Public routes**: No wrapper needed (very rare in this template)

### Layout System

Protected routes use a consistent layout:

- **Fixed Header** - User info, notifications, sign-out
- **Fixed Sidebar** - Navigation menu with active state
- **Main Content** - Page content with proper spacing

### Custom Hooks

#### useBranchesPreferences

Manages organization-specific display preferences for the Branches page:

```typescript
import { useBranchesPreferences } from '@/hooks/useBranchesPreferences';

function BranchesPage() {
  const {
    displayMode,
    setDisplayMode,
    pageSize,
    setPageSize,
  } = useBranchesPreferences();

  // Preferences are automatically:
  // - Loaded when organization changes
  // - Saved to localStorage with organization-specific keys
  // - Synced across browser sessions

  return (
    <div>
      <button onClick={() => setDisplayMode('grid')}>Grid View</button>
      <button onClick={() => setDisplayMode('table')}>Table View</button>
      <select
        value={pageSize}
        onChange={(e) => setPageSize(Number(e.target.value))}
      >
        <option value={10}>10 per page</option>
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
      </select>
    </div>
  );
}
```

### User Management

```typescript
import {
  Profile,
  AuthUser,
  AuthUserWithProfile,
} from './types/user-management';

// Type-safe user operations
const user: AuthUserWithProfile = {
  id: 'uuid',
  // profile_id removed - now using unified IDs where auth.users.id matches profiles.id
  is_first_login: false,
  profile: {
    id: 'uuid',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    // ... other profile fields
  },
};
```

### App Versioning

```typescript
import { AppVersion, CreateAppVersionInput } from './types/app-versions';

// Release management
const newVersion: CreateAppVersionInput = {
  version: '1.0.0',
  release_notes: 'Initial release',
  platforms: [
    {
      platform: 'win32',
      download_url: 'https://example.com/app-1.0.0-win32.exe',
      file_size: 50000000,
    },
  ],
};
```

## 🔄 Auto-Update System

The template includes a complete auto-update system for seamless application updates:

### Features

- **Automatic Update Checking**: Periodic checks for new versions
- **Download Progress Tracking**: Real-time download progress with visual indicators
- **User-Controlled Updates**: Users can enable/disable automatic checking
- **Manual Update Checks**: On-demand update checking
- **Restart to Update**: One-click update installation with app restart

### Components

- **UpdateSettings**: Manage auto-update preferences in the Settings page
- **RestartToUpdateButton**: Header button for update installation
- **useAutoUpdateCheck**: Hook for automatic update checking logic
- **updateStore**: Zustand store for update state management

### Configuration

The auto-update system can be configured through:

- Settings page → Updates tab
- Enable/disable automatic checking
- View current version and last check time
- Manual update checks

### Integration Points

- **App.tsx**: Initializes auto-update checking
- **Header**: Displays update button when updates are available
- **Settings**: Provides update management interface

## 🎨 Template Customization

When using this template for a new application, several files contain template-specific references that need to be updated. The `scripts/setup.js` script automatically handles all these updates, but here's a comprehensive list of what gets changed:

### Automated Updates (via setup.js)

The setup script will prompt you for:

- **Project Name**: Your application's display name
- **Project Description**: A brief description of your application

It will then automatically update the following files:

#### 1. Package Configuration

- **`package.json`**:
  - `name`: Updated to kebab-case version of your project name
  - `description`: Updated with your project description

#### 2. Web Application Files

- **`index.html`**:
  - `<title>`: Updated with your project name
  - `<meta name="description">`: Updated with your project description

#### 3. Electron Configuration

- **`electron-builder.yml`**:
  - `productName`: Updated with your project name
  - `appId`: Updated to `com.fmtsoftware.{your-project-kebab-case}`
  - `artifactName`: Updated to `{your-project-kebab-case}-setup-${version}.${ext}`
  - `shortcutName`: Updated with your project name
  - `menuCategory`: Updated with your project name

#### 4. Application UI

- **`src/components/shared/HelpDrawer.tsx`**:
  - Application title in the help drawer
  - Application description text

#### 5. Error Pages

- **`electron-app/error.html`**:
  - Page title updated to `{Your Project Name} - Error`
  - Error message updated to reference your project name

#### 6. Electron Main Process

- **`electron-app/main.ts`**:
  - Temporary directory name for updates changed from `fmt-template-updates` to `{your-project-kebab-case}-updates`

#### 7. Documentation

- **`README.md`**:
  - Main title updated from "FMT Template 1" to your project name
  - Project description in the first paragraph
  - Clone directory reference updated to your project's kebab-case name

### Name Format Conversions

The setup script automatically generates different name formats from your input:

- **Original**: "My Awesome App"
- **kebab-case**: "my-awesome-app" (for package.json, URLs, file names)
- **camelCase**: "myAwesomeApp" (for JavaScript variables)
- **PascalCase**: "MyAwesomeApp" (for component names)
- **Title Case**: "My Awesome App" (for display names)

### Files NOT Modified

The following files are intentionally **NOT** modified by the setup script:

- **Email templates** in `supabase/functions/`
- **Database migration files**
- **Environment configuration files** (`.env.example`, etc.)
- **Source code logic** and **component implementations**
- **Styling and theme files**
- **Asset files** (icons, images, etc.)

### Manual Updates Required

After running the setup script, you may want to manually update:

1. **Icons and Favicons**: Replace `public/favicon.ico` and `public/icon.png` with your app's icons
2. **App Icons**: Update Electron app icons referenced in `electron-builder.yml`
3. **Branding Colors**: Customize the color scheme in your CSS/Tailwind configuration
4. **About/Help Content**: Update any additional help or about content specific to your app
5. **License Information**: Update license details if different from the template

### Verification

After running the setup script, verify the changes by:

1. Checking that `package.json` has your project name and description
2. Opening `index.html` to see your project title
3. Running `bun run build` to ensure all references are updated correctly
4. Testing both web and Electron builds

## 🚀 Deployment

### Web Application

1. Build the project:

   ```bash
   bun run build
   ```

2. Deploy the `dist/` folder to your hosting provider

### Desktop Application

1. Configure Electron builder in `package.json`
2. Build for your target platforms:
   ```bash
   bun run electron:build
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun run build` to ensure no type errors
5. Submit a pull request

## 📄 License

This template is proprietary to FMT Software Solutions.

## 🆘 Support

For support and questions, contact FMT Software Solutions development team.

---

**Note:** This is a template project. Customize it according to your specific application requirements.
