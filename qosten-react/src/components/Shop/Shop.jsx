import React, { useState } from 'react';
import { useShop } from '../../context/ShopContext';
import './Shop.css';

const shopItems = [
  // EXP Multipliers
  {
    id: 'exp-2x',
    name: '2x EXP Multiplier',
    description: 'Double your experience points for all activities',
    type: 'expMultiplier',
    multiplier: 2,
    price: 150,
    icon: '⚡',
    category: 'multiplier',
    color: '#4CAF50'
  },
  {
    id: 'exp-3x',
    name: '3x EXP Multiplier',
    description: 'Triple your experience points for all activities',
    type: 'expMultiplier',
    multiplier: 3,
    price: 300,
    icon: '⚡⚡',
    category: 'multiplier',
    color: '#2196F3'
  },
  {
    id: 'exp-4x',
    name: '4x EXP Multiplier',
    description: 'Quadruple your experience points for all activities',
    type: 'expMultiplier',
    multiplier: 4,
    price: 500,
    icon: '⚡⚡⚡',
    category: 'multiplier',
    color: '#9C27B0'
  },
  
  // Streak Freezes
  {
    id: 'streak-1',
    name: 'Streak Freeze (1x)',
    description: 'Protect your streak for 1 day',
    type: 'streakFreeze',
    quantity: 1,
    price: 50,
    icon: '❄️',
    category: 'freeze',
    color: '#00BCD4'
  },
  {
    id: 'streak-3',
    name: 'Streak Freeze (3x)',
    description: 'Protect your streak for 3 days',
    type: 'streakFreeze',
    quantity: 3,
    price: 130,
    icon: '❄️❄️',
    category: 'freeze',
    color: '#00BCD4'
  },
  {
    id: 'streak-7',
    name: 'Streak Freeze (7x)',
    description: 'Protect your streak for 7 days',
    type: 'streakFreeze',
    quantity: 7,
    price: 280,
    icon: '❄️❄️❄️',
    category: 'freeze',
    color: '#00BCD4'
  },
  {
    id: 'streak-14',
    name: 'Streak Freeze (14x)',
    description: 'Protect your streak for 14 days',
    type: 'streakFreeze',
    quantity: 14,
    price: 500,
    icon: '❄️❄️❄️❄️',
    category: 'freeze',
    color: '#00BCD4'
  }
];

export default function Shop() {
  const { bonds, purchaseItem, activeMultiplier, streakFreezes } = useShop();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [purchaseMessage, setPurchaseMessage] = useState('');

  const handlePurchase = (item) => {
    const success = purchaseItem(item);
    
    if (success) {
      setPurchaseMessage(`✅ Successfully purchased ${item.name}!`);
      setTimeout(() => setPurchaseMessage(''), 3000);
    } else {
      setPurchaseMessage(`❌ Not enough bonds! You need ${item.price - bonds} more bonds.`);
      setTimeout(() => setPurchaseMessage(''), 3000);
    }
  };

  const filteredItems = selectedCategory === 'all' 
    ? shopItems 
    : shopItems.filter(item => item.category === selectedCategory);

  return (
    <div className="shop-container">
      <div className="shop-header">
        <h1>🏪 Shop</h1>
        <div className="bonds-display">
          <span className="bonds-icon">💎</span>
          <span className="bonds-amount">{bonds}</span>
          <span className="bonds-label">Bonds</span>
        </div>
      </div>

      {purchaseMessage && (
        <div className={`purchase-message ${purchaseMessage.includes('✅') ? 'success' : 'error'}`}>
          {purchaseMessage}
        </div>
      )}

      {/* Active Items Display */}
      <div className="active-items">
        <h3>Active Items</h3>
        <div className="active-items-grid">
          <div className="active-item-card">
            <div className="active-item-icon">⚡</div>
            <div className="active-item-info">
              <div className="active-item-label">EXP Multiplier</div>
              <div className="active-item-value">
                {activeMultiplier ? `${activeMultiplier.multiplier}x` : '1x'}
              </div>
            </div>
          </div>
          <div className="active-item-card">
            <div className="active-item-icon">❄️</div>
            <div className="active-item-info">
              <div className="active-item-label">Streak Freezes</div>
              <div className="active-item-value">{streakFreezes}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <button 
          className={selectedCategory === 'all' ? 'active' : ''}
          onClick={() => setSelectedCategory('all')}
        >
          All Items
        </button>
        <button 
          className={selectedCategory === 'multiplier' ? 'active' : ''}
          onClick={() => setSelectedCategory('multiplier')}
        >
          ⚡ EXP Multipliers
        </button>
        <button 
          className={selectedCategory === 'freeze' ? 'active' : ''}
          onClick={() => setSelectedCategory('freeze')}
        >
          ❄️ Streak Freezes
        </button>
      </div>

      {/* Shop Items Grid */}
      <div className="shop-items-grid">
        {filteredItems.map(item => (
          <div key={item.id} className="shop-item-card">
            <div className="item-icon" style={{ backgroundColor: item.color }}>
              {item.icon}
            </div>
            <div className="item-content">
              <h3 className="item-name">{item.name}</h3>
              <p className="item-description">{item.description}</p>
              
              {item.type === 'expMultiplier' && (
                <div className="item-detail">
                  <span className="multiplier-badge">{item.multiplier}x EXP</span>
                </div>
              )}
              
              {item.type === 'streakFreeze' && (
                <div className="item-detail">
                  <span className="quantity-badge">{item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}</span>
                </div>
              )}
              
              <div className="item-footer">
                <div className="item-price">
                  <span className="price-icon">💎</span>
                  <span className="price-amount">{item.price}</span>
                </div>
                <button 
                  className={`purchase-btn ${bonds >= item.price ? 'can-afford' : 'cannot-afford'}`}
                  onClick={() => handlePurchase(item)}
                  disabled={bonds < item.price}
                >
                  {bonds >= item.price ? 'Purchase' : 'Not Enough Bonds'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="shop-info">
        <h3>ℹ️ How to Earn Bonds</h3>
        <p>Complete milestones in the Roadmap to earn bonds and unlock shop items!</p>
      </div>
    </div>
  );
}
