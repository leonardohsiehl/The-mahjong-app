import { useState } from "react";

export default function App() {
  const [players, setPlayers] = useState(["You", "P2", "P3", "P4"]);
  const [values, setValues] = useState([0,0,0,0]);
  const [status, setStatus] = useState(["lose","lose","lose","lose"]);
  const [result, setResult] = useState("");

  function toggle(i){
    const s=[...status];
    s[i]=s[i]==="win"?"lose":"win";
    setStatus(s);
  }

  function update(i,val){
    const v=[...values];
    v[i]=Number(val||0);
    setValues(v);
  }

  function calc(){
    let total=values.reduce((a,b)=>a+b,0);
    if(total!==0){
      setResult("Not balanced");
      return;
    }

    let losers=[];
    let winners=[];

    players.forEach((p,i)=>{
      if(status[i]==="lose") losers.push({p,amt:values[i]});
      else winners.push({p,amt:values[i]});
    });

    let res=[];
    losers.forEach(l=>{
      let debt=Math.abs(l.amt);
      winners.forEach(w=>{
        if(debt>0 && w.amt>0){
          let pay=Math.min(debt,w.amt);
          res.push(`${l.p} pays ${w.p}: ${pay}`);
          debt-=pay;
          w.amt-=pay;
        }
      });
    });

    setResult(res.join("\n"));
  }

  return (
    <div style={{padding:20,fontFamily:"sans-serif"}}>
      <h2>Mahjong Settlement</h2>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {players.map((p,i)=>(
          <div key={i}
            onClick={()=>toggle(i)}
            style={{
              padding:10,
              border:"2px solid",
              background:status[i]==="win"?"#c8f7c5":"#f7c5c5"
            }}>
            <div>{p}</div>
            <input
              value={values[i]}
              onClick={e=>e.stopPropagation()}
              onChange={e=>update(i,e.target.value)}
            />
          </div>
        ))}
      </div>

      <button onClick={calc} style={{marginTop:20}}>Calculate</button>

      <pre style={{marginTop:20,background:"#eee",padding:10}}>
        {result}
      </pre>
    </div>
  );
}