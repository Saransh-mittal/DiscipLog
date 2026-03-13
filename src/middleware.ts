import { withAuth } from "next-auth/middleware";

export default withAuth({});

export const config = {
  matcher: ["/dashboard/:path*", "/api/logs/:path*", "/api/summarize/:path*"],
};
