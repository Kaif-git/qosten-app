import React, { useState } from 'react';

export default function PasswordOverlay() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');

  const submit = () => {
    // TODO: wire real password flow
    if (password.trim().length > 0) setVisible(false);
  };

  if (!visible) return null;
  return (
    <div className="password-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,0.7)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000}}>
      <div className="password-prompt" style={{background:'#fff',padding:30,borderRadius:8,boxShadow:'0 4px 8px rgba(0,0,0,0.2)',textAlign:'center'}}>
        <h2>Enter Password</h2>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/>
        <button onClick={submit}>Submit</button>
      </div>
    </div>
  );
}