'use client'
import { useState } from 'react';
import { renderMathToHtml } from '@/lib/math/renderMathToHtml';

export function Accordion({ items }:{ items:{q:string,a:string}[] }){
  const [open, setOpen] = useState<number|null>(0);
  return (
    <div style={{display:'grid',gap:12}}>
      {items.map((it, i)=>(
        <div key={i} style={{border:'2px solid #FCEBD7',borderRadius:12,overflow:'hidden'}}>
          <button onClick={()=>setOpen(open===i?null:i)} style={{width:'100%',textAlign:'left',padding:'14px 16px',background:'#fff'}}>
            <span
              style={{fontWeight:800}}
              dangerouslySetInnerHTML={{ __html: renderMathToHtml(it.q) ?? it.q }}
            />
            <span style={{float:'right',color:'#F77F00'}}>{open===i?'–':'+'}</span>
          </button>
          {open===i && (
            <div
              style={{background:'#fff7ef',padding:'14px 16px',color:'#4A2E1C'}}
              dangerouslySetInnerHTML={{ __html: renderMathToHtml(it.a) ?? it.a }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
