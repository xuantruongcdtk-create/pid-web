/**
 * Translate raw Supabase / network errors into user-facing Vietnamese.
 * Used by login + register handlers so "Failed to fetch" never shows up
 * in the UI.
 */

interface AnyError {
  message?: string;
  status?: number;
  name?: string;
}

const PATTERNS: Array<{ test: (e: AnyError) => boolean; msg: string }> = [
  // Network — fetch failed before reaching Supabase
  {
    test: (e) =>
      /failed to fetch|network ?error|networkerror|load failed|fetch failed/i.test(
        e.message ?? "",
      ) || e.name === "TypeError",
    msg: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau ít phút.",
  },
  // Configuration — placeholder URL was used (dev mode)
  {
    test: (e) => /placeholder\.supabase\.co/i.test(e.message ?? ""),
    msg: "Hệ thống chưa được cấu hình Supabase. Vui lòng liên hệ quản trị viên.",
  },
  // Invalid API key
  {
    test: (e) =>
      /invalid api key|invalid jwt|jwt expired|invalid_grant/i.test(e.message ?? ""),
    msg: "Khóa truy cập Supabase không hợp lệ. Vui lòng liên hệ quản trị viên.",
  },
  // Rate limit
  {
    test: (e) =>
      /rate limit|too many requests/i.test(e.message ?? "") || e.status === 429,
    msg: "Bạn đã thử quá nhiều lần. Vui lòng chờ 60 giây rồi thử lại.",
  },
  // User already registered
  {
    test: (e) => /already (registered|exists)|user already/i.test(e.message ?? ""),
    msg: "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
  },
  // Invalid credentials on sign-in
  {
    test: (e) => /invalid login credentials|invalid (email|password)/i.test(e.message ?? ""),
    msg: "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.",
  },
  // Email not confirmed
  {
    test: (e) => /email not confirmed/i.test(e.message ?? ""),
    msg: "Email chưa được xác thực. Vui lòng kiểm tra hộp thư và bấm vào link xác nhận.",
  },
  // Password requirements
  {
    test: (e) => /password should be at least/i.test(e.message ?? ""),
    msg: "Mật khẩu phải có ít nhất 6 ký tự.",
  },
  // OAuth: provider not enabled
  {
    test: (e) => /provider is not enabled|unsupported_provider/i.test(e.message ?? ""),
    msg: "Đăng nhập Google chưa được bật trên máy chủ. Vui lòng dùng email/mật khẩu.",
  },
];

export function friendlyAuthError(err: unknown): string {
  if (!err) return "Đã xảy ra lỗi không xác định.";
  const e: AnyError =
    typeof err === "object"
      ? (err as AnyError)
      : { message: typeof err === "string" ? err : String(err) };

  for (const { test, msg } of PATTERNS) {
    if (test(e)) return msg;
  }
  // Fall back to the raw message if we don't have a translation
  return e.message?.trim() || "Đã xảy ra lỗi không xác định.";
}
