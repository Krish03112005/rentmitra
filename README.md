# Livora

Livora is an Expo Router real estate app for listing, searching, saving, and managing properties. It uses Clerk for authentication and Supabase for listing data, saved properties, contact lookup, and property image storage.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router
- Clerk Expo authentication
- Supabase database and storage
- NativeWind and Tailwind CSS

## Setup Guide

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/Krish03112005/rentmitra.git
cd rentmitra
```

### 2. Install Dependencies

```bash
npm install
```

This project uses Expo SDK 54. If you change Expo packages later, prefer:

```bash
npx expo install <package-name>
```

### 3. Create Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Add your own Clerk and Supabase values:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY =
EXPO_PUBLIC_SUPABASE_URL =
EXPO_PUBLIC_SUPABASE_KEY =
```

Example shape:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_your_supabase_publishable_key
```

Do not commit `.env`. It is ignored by Git. Keep the repository public only with placeholder values in `.env.example` and this README.

### 4. Configure Clerk

1. Create a Clerk application.
2. Copy the publishable key into `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Enable Google OAuth if you want the Google sign-in button to work.
4. Add the Livora deep link scheme in Clerk OAuth redirects:

```text
livora://sso-callback
```

### 5. Configure Supabase

1. Create a Supabase project.
2. Copy the project URL into `EXPO_PUBLIC_SUPABASE_URL`.
3. Copy the publishable or anon key into `EXPO_PUBLIC_SUPABASE_KEY`.
4. Configure Clerk as a Supabase third-party auth provider.
5. Run the SQL in `supabase/property_ownership.sql` from the Supabase SQL Editor.
6. Confirm the `property-images` storage bucket and policies exist after running the SQL.

### 6. Run the App

```bash
npx expo start
```

Then choose one of the Expo launch options:

- Development build
- Android emulator
- iOS simulator
- Expo Go, if every native module you need is supported there

### 7. Run Project Checks

```bash
npm run lint
npx tsc --noEmit
npm run check:supabase
```

Or run everything together:

```bash
npm run health
```

The Supabase check needs network access and valid `.env` values.

## Publishing Safely

Before pushing a public repository, make sure:

- `.env` is not staged.
- Only `.env.example` contains placeholder values.
- No service role keys or private Clerk keys are committed.
- `npm run lint` and `npx tsc --noEmit` pass.

Suggested commit message for README/setup updates:

```text
docs: add setup guide and environment variables
```

## Useful Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
npm run check:supabase
npm run health
```
