"use client";

import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import WordGuessingGameAbi from "./abis/WordGuessingGame.json";

const CONTRACT_ADDRESS = "0x8a81920Aa74E1779f604487011be7f45D3Bf327c";

interface GameLog {
  player: string;
  guess: string;
  similarity: number;
  proximity: string;
}

const WordGuessingGame = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userGuess, setUserGuess] = useState<string>("");
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [prizePool, setPrizePool] = useState<string>("0");
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const BACKEND_API_URL = "http://127.0.0.1:3000/guess"; // 백엔드 API URL

  // 메타마스크 연결
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask is not installed!");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        checkIfOwner(accounts[0]);
        setFeedback(`Connected to wallet: ${accounts[0]}`);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setFeedback("Failed to connect wallet.");
    }
  };

  // 지갑 연결 해제
  const disconnectWallet = () => {
    setWalletAddress(null);
    setFeedback("Wallet disconnected.");
  };

  // 컨트랙트 인스턴스 가져오기
  const getContract = async (): Promise<Contract> => {
    if (!window.ethereum) {
      throw new Error("No crypto wallet found");
    }
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, WordGuessingGameAbi, signer);
  };

  // 현재 연결된 계정이 Owner인지 확인
  const checkIfOwner = async (account: string) => {
    try {
      const contract = await getContract();
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
    } catch (error) {
      console.error("Failed to check owner:", error);
    }
  };

  // 상금 풀 및 게임 상태 가져오기
  const fetchGameState = async () => {
    try {
      const contract = await getContract();
      const [pool, ended] = await contract.getGameState();
      setPrizePool(formatEther(pool));
      setGameEnded(ended);
    } catch (error) {
      console.error("Failed to fetch game state:", error);
    }
  };

  // 백엔드로 단어 및 지갑 주소 보내기
  const sendGuessToBackend = async () => {
    try {
      const response = await fetch(BACKEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: userGuess,
          walletAddress: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send guess to backend.");
      }

      const result = await response.json();
      console.log("Backend Response:", result);

      // 로그 정보 업데이트
      const similarity = result.similarity || 0; // 백엔드에서 제공하는 유사도 값
      const proximity = result.proximity || "Unknown"; // 등수 또는 거리 정보
      setGameLogs((prev) => [
        {
          player: walletAddress || "Unknown",
          guess: userGuess,
          similarity,
          proximity,
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Error sending guess to backend:", error);
      setFeedback("Failed to send guess to backend.");
    }
  };

  // 단어 추측 제출
  const handleSubmitGuess = async () => {
    if (!userGuess) {
      setFeedback("Please enter a word.");
      return;
    }

    try {
      const contract = await getContract();
      const tx = await contract.guessWord(userGuess, {
        value: parseEther("0.001"),
      });
      await tx.wait();

      setFeedback(`Your guess "${userGuess}" has been submitted.`);

      // 백엔드로 데이터 전송
      await sendGuessToBackend();

      // 게임 상태 갱신
      fetchGameState();
    } catch (error) {
      console.error("Failed to submit guess:", error);
      setFeedback("Failed to submit your guess.");
    }
  };

  useEffect(() => {
    if (walletAddress) {
      fetchGameState();
    }
  }, [walletAddress]);

  return (
    <div style={{ backgroundColor: "#f9f9f9", minHeight: "100vh", padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "#0070f3" }}>Word Guessing Game</h1>
        <button
          onClick={walletAddress ? disconnectWallet : connectWallet}
          style={{
            padding: "10px 20px",
            backgroundColor: walletAddress ? "#dc3545" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {walletAddress ? "Disconnect Wallet" : "Connect Wallet"}
        </button>
      </header>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <h2 style={{ color: "#28a745" }}>Prize Pool: {prizePool} ETH</h2>
        {isOwner && (
          <button
            onClick={() => alert("New game feature not implemented in this code!")}
            style={{
              padding: "10px 20px",
              marginTop: "10px",
              backgroundColor: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Start New Game
          </button>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <input
          type="text"
          value={userGuess}
          onChange={(e) => setUserGuess(e.target.value)}
          placeholder="Enter your guess"
          style={{
            padding: "10px",
            fontSize: "16px",
            width: "50%",
            borderRadius: "5px",
            border: "1px solid #ddd",
            marginBottom: "10px",
          }}
        />
        <button
          onClick={handleSubmitGuess}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Submit Guess
        </button>
      </div>

      {feedback && <p style={{ textAlign: "center", marginTop: "10px" }}>{feedback}</p>}

      <div style={{ marginTop: "30px" }}>
        <h3>Game Logs</h3>
        <ul>
          {gameLogs.map((log, idx) => (
            <li key={idx}>
              <strong>Player:</strong> {log.player} | <strong>Guess:</strong> {log.guess} |{" "}
              <strong>Similarity:</strong> {log.similarity}% |{" "}
              <strong>Proximity:</strong> {log.proximity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WordGuessingGame;
