import { cookies, headers } from "next/headers";
import { env } from "@/lib/platform-env";
import { sessionUser } from "@/lib/auth/email-otp";
import { SESSION_COOKIE } from "@/lib/auth/http";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin";
const SIGN_OUT_PATH = "/signout";
const CALLBACK_PATH = "/callback";

// On ChatGPT Sites a trusted dispatcher set these headers. On the Node runtime (ADR-0001) any client could
// send them, so they are ignored unless ACADEMY_TRUST_IDENTITY_HEADERS=1, which only local synthetic tests set.
// Without the flag, the signed-in user comes from the email one-time-code session cookie (ACA-US-1.4).
const trustIdentityHeaders = () => process.env.ACADEMY_TRUST_IDENTITY_HEADERS === "1";

// The signed-in user. On the Node runtime this is the email one-time-code session (ACA-US-1.4); the
// function keeps its v0.17 name so the routes that call it are unchanged.
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (!trustIdentityHeaders()) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token || !env.DB) return null;
    const user = await sessionUser(env.DB, token);
    return user ? { userId: user.userId, email: user.email, displayName: user.email, fullName: null } : null;
  }
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
