# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/8f009a9a-6732-4bbd-8cac-732a48431dec

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/8f009a9a-6732-4bbd-8cac-732a48431dec) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Connect the frontend to your backend

Create a `.env` file in the project root (you can copy from `.env.example`) and configure it to match your backend.

For your provided Docker setup, backend app is exposed on `localhost:8080`, so use:

```env
VITE_DEV_PORT=5173
VITE_API_BASE_URL=http://localhost:8080
VITE_API_PROXY_TARGET=http://localhost:8080
```

Why these values:
- Frontend runs on `5173` to avoid port conflict with backend `8080`.
- Backend API calls target `http://localhost:8080`.

You can also configure only one connection strategy:

1. **Direct API base URL** (best for deployed environments):

```env
VITE_API_BASE_URL=http://localhost:8080
```

2. **Local dev proxy** (avoids browser CORS issues in development):

```env
VITE_API_PROXY_TARGET=http://localhost:8080
```

Then restart the Vite dev server:

```sh
npm run dev
```

> Notes:
> - All frontend API calls use the `/api/...` route prefix.
> - If both values are set, requests still resolve to your backend at `localhost:8080`.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/8f009a9a-6732-4bbd-8cac-732a48431dec) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
