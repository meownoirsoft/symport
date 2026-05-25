import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

export default withAuth(function middleware(_req: NextRequest) {
  // custom logic can go here later (e.g., role-based access)
}, {
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/chat/:path*",
    "/documents/:path*",
    "/capture/:path*",
    "/note/:path*",
    "/contexts/:path*",
    "/settings/:path*",
    "/api/documents/:path*",
    "/api/wiskr/:path*",
    "/api/admin/:path*",
    "/api/settings/:path*",
    "/api/saved-prompts/:path*",
  ],
};


