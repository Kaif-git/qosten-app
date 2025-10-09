import React from 'react';
import { NavLink } from 'react-router-dom';

const tabStyle = {
  padding: '10px 15px',
  cursor: 'pointer',
  background: '#e0e0e0',
  borderRadius: 5,
  marginRight: 5,
  display: 'inline-block',
  fontSize: 14,
  textDecoration: 'none',
};

export default function TabContainer() {
  return (
    <div className="tab-container" style={{display:'flex', marginBottom:15, overflowX:'auto', whiteSpace:'nowrap', paddingBottom:5}}>
      <NavLink to="/import" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import Questions</NavLink>
      <NavLink to="/bank" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Question Bank</NavLink>
      <NavLink to="/add" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Add New Question</NavLink>
      <NavLink to="/import-math" style={({isActive}) => ({...tabStyle, background: isActive ? '#e67e22' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>📐 Math Questions</NavLink>
      <NavLink to="/import-mcq" style={({isActive}) => ({...tabStyle, background: isActive ? '#9b59b6' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>📝 MCQ Questions</NavLink>
      <NavLink to="/prompts" style={({isActive}) => ({...tabStyle, background: isActive ? '#2196F3' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>🤖 AI Prompts</NavLink>
      {/* <NavLink to="/shop" style={({isActive}) => ({...tabStyle, background: isActive ? '#764ba2' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>🏪 Shop</NavLink> */}
      {/* <NavLink to="/roadmap" style={({isActive}) => ({...tabStyle, background: isActive ? '#f5576c' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>🗺️ Roadmap</NavLink> */}
      <NavLink to="/import-cq" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import CQ</NavLink>
      <NavLink to="/import-sq" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import SQ</NavLink>
      <NavLink to="/import-bn" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import Bangla Questions</NavLink>
      <NavLink to="/import-cq-bn" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import Bangla CQ</NavLink>
      <NavLink to="/import-sq-bn" style={({isActive}) => ({...tabStyle, background: isActive ? '#4CAF50' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>Import Bangla SQ</NavLink>
      <NavLink to="/translate-test" style={({isActive}) => ({...tabStyle, background: isActive ? '#28a745' : '#e0e0e0', color: isActive ? '#fff' : '#000'})}>🌐 Translation Test</NavLink>
    </div>
  );
}
