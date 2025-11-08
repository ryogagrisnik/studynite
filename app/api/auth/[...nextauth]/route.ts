import NextAuth from "next-auth";
// Update the import path if the correct location is different, for example:
import { authOptions } from "@/lib/auth"; // if using baseUrl or path alias

// Or, if the file does not exist, create it at the expected path:
// /Users/ryogagrisnik/Downloads/blobprep_full_randomized/lib/auth.ts

export const runtime = "nodejs";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
