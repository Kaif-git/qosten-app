import React, { createContext, useContext, useState, useEffect } from 'react';

const ShopContext = createContext();

export function ShopProvider({ children }) {
  const [bonds, setBonds] = useState(() => {
    const saved = localStorage.getItem('userBonds');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [purchasedItems, setPurchasedItems] = useState(() => {
    const saved = localStorage.getItem('purchasedItems');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeMultiplier, setActiveMultiplier] = useState(() => {
    const saved = localStorage.getItem('activeMultiplier');
    return saved ? JSON.parse(saved) : null;
  });

  const [streakFreezes, setStreakFreezes] = useState(() => {
    const saved = localStorage.getItem('streakFreezes');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [completedMilestones, setCompletedMilestones] = useState(() => {
    const saved = localStorage.getItem('completedMilestones');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentExp, setCurrentExp] = useState(() => {
    const saved = localStorage.getItem('currentExp');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('userBonds', bonds.toString());
  }, [bonds]);

  useEffect(() => {
    localStorage.setItem('purchasedItems', JSON.stringify(purchasedItems));
  }, [purchasedItems]);

  useEffect(() => {
    localStorage.setItem('activeMultiplier', JSON.stringify(activeMultiplier));
  }, [activeMultiplier]);

  useEffect(() => {
    localStorage.setItem('streakFreezes', streakFreezes.toString());
  }, [streakFreezes]);

  useEffect(() => {
    localStorage.setItem('completedMilestones', JSON.stringify(completedMilestones));
  }, [completedMilestones]);

  useEffect(() => {
    localStorage.setItem('currentExp', currentExp.toString());
  }, [currentExp]);

  const purchaseItem = (item) => {
    if (bonds >= item.price) {
      setBonds(bonds - item.price);
      setPurchasedItems([...purchasedItems, { ...item, purchasedAt: Date.now() }]);
      
      // Handle different item types
      if (item.type === 'expMultiplier') {
        setActiveMultiplier(item);
      } else if (item.type === 'streakFreeze') {
        setStreakFreezes(streakFreezes + item.quantity);
      }
      
      return true;
    }
    return false;
  };

  const addExp = (amount) => {
    setCurrentExp(currentExp + amount);
  };

  const completeMilestone = (milestoneId, bondsReward) => {
    if (!completedMilestones.includes(milestoneId)) {
      setCompletedMilestones([...completedMilestones, milestoneId]);
      setBonds(bonds + bondsReward);
      return true;
    }
    return false;
  };

  const addBonds = (amount) => {
    setBonds(bonds + amount);
  };

  const value = {
    bonds,
    purchasedItems,
    activeMultiplier,
    streakFreezes,
    currentExp,
    completedMilestones,
    purchaseItem,
    addExp,
    completeMilestone,
    addBonds,
    setActiveMultiplier,
    setStreakFreezes
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
