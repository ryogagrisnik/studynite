export function ProgressRing({ value, total }:{ value:number; total:number }){
  const pct = Math.max(0, Math.min(100, Math.round((value/total)*100)));
  return (
    <div style={{width:48,height:48,borderRadius:'50%',border:'4px solid #FCEBD7',position:'relative'}}>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#4A2E1C'}}>
        {total - value}/{total}
      </div>
    </div>
  );
}
