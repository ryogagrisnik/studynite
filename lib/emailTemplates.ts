export function verificationEmailTemplate(link: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Verify your StudyNite email</h2>
      <p>Click the button below to confirm your email address and unlock your dashboard.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background:#16A34A;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify email</a>
      </p>
      <p>Or copy this link into your browser:</p>
      <code style="display:block;background:#DCFCE7;padding:12px;border-radius:8px;word-break:break-all;">${link}</code>
      <p>If you didn’t create a StudyNite account, you can ignore this email.</p>
    </div>
  `;
}

export function passwordResetTemplate(link: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Reset your StudyNite password</h2>
      <p>You requested to reset your password. Click below to choose a new one.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background:#16A34A;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Reset password</a>
      </p>
      <p>This link will expire soon for your security.</p>
      <p>If you didn’t request a reset, no action is required.</p>
    </div>
  `;
}
