
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  accountMode: 'demo' | 'live';
  isWalletConnected: boolean;
  userBalance: number;
  trades: any[];
}

interface AppContextType {
  state: AppState;
  setAccountMode: (mode: 'demo' | 'live') => void;
  setWalletConnected: (connected: boolean) => void;
  updateBalance: (balance: number) => void;
  addTrade: (trade: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    accountMode: 'demo',
    isWalletConnected: false,
    userBalance: 10000, // Demo balance
    trades: []
  });

  const setAccountMode = (mode: 'demo' | 'live') => {
    setState(prev => ({ 
      ...prev, 
      accountMode: mode,
      userBalance: mode === 'demo' ? 10000 : 0 
    }));
  };

  const setWalletConnected = (connected: boolean) => {
    setState(prev => ({ ...prev, isWalletConnected: connected }));
  };

  const updateBalance = (balance: number) => {
    setState(prev => ({ ...prev, userBalance: balance }));
  };

  const addTrade = (trade: any) => {
    setState(prev => ({ ...prev, trades: [...prev.trades, trade] }));
  };

  return (
    <AppContext.Provider value={{
      state,
      setAccountMode,
      setWalletConnected,
      updateBalance,
      addTrade
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
