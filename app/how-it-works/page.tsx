import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
export default async function HowItWorksPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const isAuthed = Boolean(userId);
  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">How RunePrep works</h1>
          <p className="page-sub">
            Upload your material, generate study items, and host a focused multiplayer review.
          </p>
        </div>
      </div>

      <section className="two-col quest-achievement-section">
        <div className="card how-card rpg-reveal">
          <div className="how-grid">
            <div className="stack how-copy">
              <h2 className="card-title">Quest log</h2>
              <p className="card-sub">
                RunePrep keeps things clean: you pick the counts, we generate the content, and the
                host runs the pace for everyone.
              </p>
              <div className="stack how-steps">
                <div className="how-step">
                  <span className="badge">1</span>
                  <div>
                    <strong>Upload</strong>
                    <p className="muted">
                      Paste notes or upload PDFs/images. OCR is included for scans.
                    </p>
                  </div>
                </div>
                <div className="how-step">
                  <span className="badge">2</span>
                  <div>
                    <strong>Generate</strong>
                    <p className="muted">
                      Choose how many quiz questions you want. Edit anytime.
                    </p>
                  </div>
                </div>
                <div className="how-step">
                  <span className="badge">3</span>
                  <div>
                    <strong>Host</strong>
                    <p className="muted">
                      Share a link or code. Everyone answers together while the host advances.
                    </p>
                  </div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <Link className="btn btn-outline" href="/party/join">
                  Join with a code
                </Link>
                <Link className="btn btn-outline" href="/dashboard">
                  View saved quizzes
                </Link>
              </div>
            </div>
            <div className="how-visual">
              <img
                className="rogue-hero avatar-float"
                src="/avatars/rogue.jpeg"
                alt="Rogue avatar"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
