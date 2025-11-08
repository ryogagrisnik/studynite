import Link from 'next/link';
export default function NotFound(){
  return (
    <div className="section center">
      <div style={{fontSize:48}}>🐡</div>
      <h1>Lost at sea? Let’s get you back.</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <Link className="btn btn-primary" href="/">Return Home →</Link>
      <div style={{marginTop:8}}><Link href="/practice">Go to Practice Page instead</Link></div>
    </div>
  );
}
