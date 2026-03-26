import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: '/signin',
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/api/logs/:path*", "/api/summarize/:path*", "/api/categories/:path*", "/api/onboarding/:path*", "/api/commitments/:path*"],
};
