# Production invitations

Deploy the latest main commit to Vercel Production and Render.

- Public frontend: `https://sayiig-urjih-myanga.vercel.app`
- Backend: `https://sayiig-urjih-myanga.onrender.com`
- Render production CORS and Clerk JWT authorized parties use only the public frontend origin, from `shared/deployment.js`.
- Set Vercel `VITE_API_URL` and `VITE_SOCKET_URL` to the backend origin, and configure the matching `VITE_CLERK_PUBLISHABLE_KEY` and Render `CLERK_SECRET_KEY` for the same Clerk application.
- Configure that Clerk application's production frontend domain and social provider redirects for the public frontend. Account dashboard changes are not applied by repository commits.
- Share links use `/room/CODE?invite=TOKEN` for private rooms. Never distribute a deployment-specific Preview URL: Vercel Deployment Protection may require Vercel SSO before either server-side or client-side redirects execute.
- The SPA rewrite serves `index.html` for room deep links. Preview redirects preserve path and query. Clerk sign-in/sign-up redirects retain the relative invitation URL.

Automated verification uses separate signed Clerk fixture identities, separate game sessions and independent Socket.IO clients against a real temporary MongoDB replica set. It covers private-link joins, repeat joins, reconnects and identical room membership. It does not claim to exercise two real browser profiles or hosted Clerk/social-provider login screens.
