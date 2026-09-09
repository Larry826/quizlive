import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "quizlive_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || "development-only-change-me";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createAdminSessionValue() {
  const payload = JSON.stringify({
    role: "admin",
    issuedAt: Date.now(),
    nonce: crypto.randomUUID(),
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminSessionValue(value?: string) {
  if (!value) {
    return false;
  }

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return false;
  }

  const expected = sign(encoded);
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !timingSafeEqual(givenBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      role?: string;
      issuedAt?: number;
    };
    return payload.role === "admin" && typeof payload.issuedAt === "number";
  } catch {
    return false;
  }
}

export async function isAdminRequest() {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setAdminCookie(value: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export async function requireAdmin() {
  if (!(await isAdminRequest())) {
    throw new Error("ADMIN_UNAUTHORIZED");
  }
}

