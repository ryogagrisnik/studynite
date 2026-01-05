export default function Privacy() {
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="stack">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="muted"><em>Effective September 2025</em></p>
        <h3>What data we collect</h3>
        <p>Account info for hosts, quiz metadata, party scores, and basic usage events.</p>
        <h3>How we use data</h3>
        <p>To generate quizzes, run multiplayer sessions, and improve StudyNite.</p>
        <h3>Uploaded materials</h3>
        <p>
          Source files and pasted text are processed to create quizzes and then discarded. We retain
          generated quizzes only.
        </p>
        <h3>Party data retention</h3>
        <p>Party results are stored for creators and automatically deleted after 30 days.</p>
        <h3>Cookies & tracking</h3>
        <p>We use cookies for authentication and session continuity.</p>
        <h3>Third-party services</h3>
        <p>Hosting, analytics, OCR, and email providers may process data on our behalf.</p>
        <h3>Data rights</h3>
        <p>Contact us to request, delete, or export your data.</p>
      </div>
    </div>
  );
}
