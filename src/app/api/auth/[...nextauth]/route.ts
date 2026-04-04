import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        await connectToDatabase();
        const existingUser = await User.findOne({ email: user.email });
        
        if (!existingUser) {
          await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
          });
        }
        return true;
      } catch (error) {
        console.error("Sign in error:", error);
        return false;
      }
    },
    async session({ session }) {
      if (session.user) {
        await connectToDatabase();
        const dbUser = await User.findOne({ email: session.user.email });
        if (dbUser) {
          const enriched = session.user as typeof session.user & { id?: string; plan?: string };
          // Expose the MongoDB Object ID as string on the user object for querying logs
          enriched.id = dbUser._id.toString();
          // Expose the subscription plan so the frontend can show pro features
          enriched.plan = dbUser.subscription?.plan || "free";
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/signin',
    signOut: '/signout',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
