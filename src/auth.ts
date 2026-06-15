import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
const allowedEmails = new Set([...parseEmailList(process.env.ALLOWED_EMAILS), ...adminEmails]);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      return !!email && allowedEmails.has(email);
    },
    jwt({ token }) {
      const email = token.email?.toLowerCase();
      token.isAdmin = !!email && adminEmails.has(email);
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
});
