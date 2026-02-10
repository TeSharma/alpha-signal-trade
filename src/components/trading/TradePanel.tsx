import React, { useState } from "react";
import { useContract } from "../hooks/useContract";

const TradePanel = () => {
  const tradingPlatform = useContract("TradingPlatform", true); // write access
  const [status, setStatus] = useState("");

  const executeTrade = async (pair: string, amount: string, direction: "BUY" | "SELL") => {
    if (!tradingPlatform) return setStatus("⏳ Contract not ready");

    try {
      setStatus("🚀 Sending transaction...");
      const tx = await tradingPlatform.executeTrade(pair, ethers.parseUnits(amount, 18), direction === "BUY");
      await tx.wait();
      setStatus("✅ Trade recorded on-chain!");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message || err}`);
    }
  };

  return (
    <div>
      <button onClick={() => executeTrade("EUR/USD", "100", "BUY")}>
        Execute Buy
      </button>
