# Shop & Roadmap System - Implementation Guide

## Overview
This implementation adds a complete Shop and Roadmap system to your Qosten React application. Users can earn bonds through EXP milestones and spend them on shop items.

## Files Created

### 1. Context
- **`src/context/ShopContext.js`**
  - Manages bonds, EXP, purchases, and milestones
  - Persists data in localStorage
  - Provides hooks for all shop/roadmap functionality

### 2. Shop Component
- **`src/components/Shop/Shop.jsx`**
  - Displays purchasable items
  - Shows current bonds balance
  - Categories: EXP Multipliers & Streak Freezes
  
- **`src/components/Shop/Shop.css`**
  - Complete styling for shop interface
  - Responsive design
  - Animated purchase effects

### 3. Roadmap Component
- **`src/components/Roadmap/Roadmap.jsx`**
  - 10 EXP milestones (100 - 15,000 EXP)
  - Progress tracking and visualization
  - Claimable bond rewards
  
- **`src/components/Roadmap/Roadmap.css`**
  - Milestone progression styling
  - Visual status indicators (locked/claimable/completed)
  - Progress bars and animations

### 4. Integration
- **`src/App.js`** - Added ShopProvider and routes
- **`src/components/TabContainer/TabContainer.jsx`** - Added Shop & Roadmap tabs

## Shop Items

### EXP Multipliers
| Item | Multiplier | Price (Bonds) |
|------|-----------|---------------|
| 2x EXP Multiplier | 2x | 150 |
| 3x EXP Multiplier | 3x | 300 |
| 4x EXP Multiplier | 4x | 500 |

### Streak Freezes
| Item | Duration | Price (Bonds) |
|------|----------|---------------|
| Streak Freeze 1x | 1 day | 50 |
| Streak Freeze 3x | 3 days | 130 |
| Streak Freeze 7x | 7 days | 280 |
| Streak Freeze 14x | 14 days | 500 |

## Roadmap Milestones

| Level | Title | EXP Required | Bonds Reward |
|-------|-------|--------------|--------------|
| 1 | Beginner 🌱 | 100 | 20 |
| 2 | Novice 📚 | 250 | 50 |
| 3 | Learner 📖 | 500 | 80 |
| 4 | Student 🎓 | 1,000 | 150 |
| 5 | Scholar 📜 | 2,000 | 250 |
| 6 | Expert 🏆 | 3,500 | 400 |
| 7 | Master ⭐ | 5,000 | 600 |
| 8 | Sage 🔮 | 7,500 | 900 |
| 9 | Legend 👑 | 10,000 | 1,200 |
| 10 | Grandmaster 💎 | 15,000 | 2,000 |

## Key Features

### Shop
- ✅ Bond balance display
- ✅ Active items tracker (current multiplier & streak freezes)
- ✅ Category filtering (All, Multipliers, Freezes)
- ✅ Purchase validation (insufficient funds handling)
- ✅ Success/error messages
- ✅ Responsive design

### Roadmap
- ✅ Current EXP & bonds display
- ✅ 10 progressive milestones
- ✅ Visual progress bars
- ✅ Three states: Locked, Claimable, Completed
- ✅ Claim rewards button
- ✅ Milestone connectors with status colors
- ✅ Persistent progress (localStorage)

## Usage

### Accessing the System
1. Navigate to the **🏪 Shop** tab to view and purchase items
2. Navigate to the **🗺️ Roadmap** tab to track progress and claim rewards

### For Future Integration

#### Adding EXP to User Actions
```javascript
import { useShop } from '../../context/ShopContext';

function YourComponent() {
  const { addExp, activeMultiplier } = useShop();
  
  const handleQuestionComplete = () => {
    const baseExp = 10;
    const multiplier = activeMultiplier?.multiplier || 1;
    const totalExp = baseExp * multiplier;
    addExp(totalExp);
  };
}
```

#### Using Streak Freezes
```javascript
import { useShop } from '../../context/ShopContext';

function StreakComponent() {
  const { streakFreezes, setStreakFreezes } = useShop();
  
  const useStreakFreeze = () => {
    if (streakFreezes > 0) {
      setStreakFreezes(streakFreezes - 1);
      // Protect user's streak
    }
  };
}
```

#### Manually Adding Bonds (Admin/Testing)
```javascript
const { addBonds } = useShop();
addBonds(100); // Adds 100 bonds
```

## Data Persistence
All data is stored in localStorage:
- `userBonds` - Current bond balance
- `purchasedItems` - Purchase history
- `activeMultiplier` - Current EXP multiplier
- `streakFreezes` - Available streak freeze count
- `completedMilestones` - Claimed milestone IDs
- `currentExp` - Total accumulated EXP

## Styling
The components use inline styles and CSS files with:
- Gradient backgrounds
- Smooth animations
- Hover effects
- Responsive breakpoints
- Status-based colors

## Next Steps for Full Functionality
1. **Integrate EXP earning** - Add `addExp()` calls when users complete activities
2. **Implement multiplier logic** - Apply multiplier when calculating EXP rewards
3. **Add streak system** - Implement daily streak tracking and freeze usage
4. **Remove test controls** - The test EXP buttons are currently hidden/commented out
5. **Add purchase confirmations** - Consider adding modal dialogs for purchases
6. **Implement time-based multipliers** - Track when multipliers expire (if desired)

## Notes
- All shop items are **non-functional** until integrated with your application logic
- The visual interface and state management are complete
- localStorage ensures persistence across sessions
- Test controls are hidden but available in code for future development
