import React, { useState } from "react";

// Legacy component — retained for build compatibility only
const TradePanel = () => {
  const [status, setStatus] = useState("");

  return (
    <div>
      <p className="text-muted-foreground">Legacy component — use TradingForm instead</p>
      <p>{status}</p>
    </div>
  );
};

export default TradePanel;
