import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;

      if (!token) {
        return false;
      }

      if (pathname.startsWith("/admin")) {
        return token.role === "ADMIN";
      }

      if (pathname.startsWith("/seller")) {
        return token.role === "SELLER" || token.role === "ADMIN";
      }

      if (pathname.startsWith("/buyer")) {
        return ["BUYER", "SELLER", "ADMIN"].includes(String(token.role));
      }

      return true;
    },
  },
});

export const config = {
  matcher: ["/buyer/:path*", "/seller/:path*", "/admin/:path*"],
};
