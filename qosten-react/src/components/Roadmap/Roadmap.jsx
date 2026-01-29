import React from 'react';
import { useShop } from '../../context/ShopContext';
import './Roadmap.css';

const milestones = [
  { id: 'milestone-1', exp: 100, bonds: 20, title: 'Beginner', icon: '🌱' },
  { id: 'milestone-2', exp: 250, bonds: 50, title: 'Novice', icon: '📚' },
  { id: 'milestone-3', exp: 500, bonds: 80, title: 'Learner', icon: '📖' },
  { id: 'milestone-4', exp: 1000, bonds: 150, title: 'Student', icon: '🎓' },
  { id: 'milestone-5', exp: 2000, bonds: 250, title: 'Scholar', icon: '📜' },
  { id: 'milestone-6', exp: 3500, bonds: 400, title: 'Expert', icon: '🏆' },
  { id: 'milestone-7', exp: 5000, bonds: 600, title: 'Master', icon: '⭐' },
  { id: 'milestone-8', exp: 7500, bonds: 900, title: 'Sage', icon: '🔮' },
  { id: 'milestone-9', exp: 10000, bonds: 1200, title: 'Legend', icon: '👑' },
  { id: 'milestone-10', exp: 15000, bonds: 2000, title: 'Grandmaster', icon: '💎' }
];

export default function Roadmap() {
  const { currentExp, completedMilestones, completeMilestone, bonds } = useShop();

  const handleClaimReward = (milestone) => {
    const success = completeMilestone(milestone.id, milestone.bonds);
    if (success) {
      alert(`🎉 Congratulations! You earned ${milestone.bonds} bonds!`);
    }
  };

  const getMilestoneStatus = (milestone) => {
    if (completedMilestones.includes(milestone.id)) {
      return 'completed';
    }
    if (currentExp >= milestone.exp) {
      return 'claimable';
    }
    return 'locked';
  };

  const getProgressPercentage = (milestone, prevExp = 0) => {
    const range = milestone.exp - prevExp;
    const progress = Math.min(currentExp - prevExp, range);
    return (progress / range) * 100;
  };

  return (
    <div className="roadmap-container">
      <div className="roadmap-header">
        <h1>🗺️ EXP Roadmap</h1>
        <div className="exp-bonds-display">
          <div className="exp-display">
            <span className="exp-icon">⚡</span>
            <span className="exp-amount">{currentExp}</span>
            <span className="exp-label">Total EXP</span>
          </div>
          <div className="bonds-display-small">
            <span className="bonds-icon">💎</span>
            <span className="bonds-amount">{bonds}</span>
            <span className="bonds-label">Bonds</span>
          </div>
        </div>
      </div>

      <div className="roadmap-info">
        <p>
          Complete milestones by earning experience points to unlock bond rewards! 
          Use bonds in the Shop to purchase EXP multipliers and streak freezes.
        </p>
      </div>

      {/* Test Controls - Hidden for now, will be added in later updates */}
      {/* <div className="test-controls">
        <h3>🧪 Test Controls (Development Only)</h3>
        <div className="test-buttons">
          <button onClick={() => handleAddTestExp(50)}>+50 EXP</button>
          <button onClick={() => handleAddTestExp(100)}>+100 EXP</button>
          <button onClick={() => handleAddTestExp(500)}>+500 EXP</button>
          <button onClick={() => handleAddTestExp(1000)}>+1000 EXP</button>
        </div>
      </div> */}

      <div className="milestones-container">
        {milestones.map((milestone, index) => {
          const status = getMilestoneStatus(milestone);
          const prevExp = index > 0 ? milestones[index - 1].exp : 0;
          const progressPercentage = getProgressPercentage(milestone, prevExp);

          return (
            <div key={milestone.id} className="milestone-wrapper">
              {index > 0 && (
                <div className={`milestone-connector ${status !== 'locked' ? 'active' : ''}`}></div>
              )}
              
              <div className={`milestone-card ${status}`}>
                <div className="milestone-icon-container">
                  <div className="milestone-icon">{milestone.icon}</div>
                  {status === 'completed' && (
                    <div className="completed-badge">✓</div>
                  )}
                  {status === 'claimable' && (
                    <div className="claimable-pulse"></div>
                  )}
                </div>

                <div className="milestone-content">
                  <h3 className="milestone-title">{milestone.title}</h3>
                  <div className="milestone-exp">{milestone.exp} EXP</div>
                  <div className="milestone-reward">
                    <span className="reward-icon">💎</span>
                    <span className="reward-amount">+{milestone.bonds} Bonds</span>
                  </div>

                  {status !== 'completed' && (
                    <div className="milestone-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                      <div className="progress-text">
                        {currentExp >= milestone.exp 
                          ? 'Ready to claim!' 
                          : `${currentExp} / ${milestone.exp} EXP`}
                      </div>
                    </div>
                  )}

                  {status === 'claimable' && (
                    <button 
                      className="claim-btn"
                      onClick={() => handleClaimReward(milestone)}
                    >
                      🎁 Claim Reward
                    </button>
                  )}

                  {status === 'completed' && (
                    <div className="completed-text">✅ Claimed</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="roadmap-footer">
        <h3>💡 How to Earn EXP</h3>
        <ul>
          <li>Complete questions and exercises</li>
          <li>Maintain daily streaks</li>
          <li>Achieve perfect scores</li>
          <li>Use EXP multipliers from the Shop for bonus points!</li>
        </ul>
      </div>
    </div>
  );
}
