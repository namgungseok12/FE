"use client";

import React, { useState, useEffect } from "react";
import { groth16 } from "snarkjs";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import WordGuessingGameAbi from "./abis/WordGuessingGame.json";

//gamelog interface
interface GameLog {
  player: string;
  guess: string;
  similarity: number;
  proximity: string;
}

const BACKEND_API_URL = "http://127.0.0.1:3000";
const CONTRACT_ADDRESS = "0x041E42De0b65D57459FB1fB51438bEc6ca766e6c";

//zk
function toAsciiArray20(str: string): number[] {
  const arr = new Array(20).fill(0);
  for (let i = 0; i < 20; i++) {
    arr[i] = str.charCodeAt(i) || 0;
  }
  return arr;
}

export default function WordGuessingGamePage() {

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [prizePool, setPrizePool] = useState<string>("0");
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [userGuess, setUserGuess] = useState<string>("");
  const [guess, setGuess] = useState<string>("");
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);


//connect wallet
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
        setFeedback(`Connected to wallet: ${accounts[0]}`);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setFeedback("Failed to connect wallet.");
    }
  };

  //disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress(null);
    setFeedback("Wallet disconnected.");
  };

  //contract import
  const getContract = async (): Promise<Contract> => {
    if (!window.ethereum) {
      throw new Error("No crypto wallet found");
    }
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, WordGuessingGameAbi, signer);
  };


  //fetching game state(pool, ended)
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

  //fetching game logs
  const fetchGameLogs = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/logs?cursor=0&pageSize=100`);
      if (!response.ok) {
        throw new Error("Failed to fetch game logs from backend");
      }
      const logs = await response.json();
      setGameLogs(logs);
      localStorage.setItem("gameLogs", JSON.stringify(logs));
    } catch (error) {
      console.error("Error fetching game logs:", error);
    }
  };


  const handleSubmitGuess = async () => {
    if (!walletAddress) {
      setFeedback("You must connect your wallet.");
      return;
    }
    if (!userGuess) {
      setFeedback("Please enter a word.");
      return;
    }
    //alreadyguessed
    const alreadyGuessed = gameLogs.some((log) => log.guess === userGuess);
    if (alreadyGuessed) {
      setFeedback(`You have already guessed the word "${userGuess}".`);
      return;
    }
    try {
      const contract = await getContract();
      const tx = await contract.guessWord({
        value: parseEther("0.001"),
      }); 
      setFeedback(`Your guess "${userGuess}" has been submitted.`);
      await sendGuessToBackend(userGuess);
      await fetchGameLogs();
      

    } catch (error) {
      console.error("Failed to submit guess:", error);
      setFeedback("Failed to submit your guess.");
    }
  };

  //post guess,walletAddress
  const sendGuessToBackend = async (guessWord: string) => {
    if (!walletAddress) return;
    try {
      console.log("backend:", { word: guessWord, walletAddress });
      const response = await fetch(`${BACKEND_API_URL}/guess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: guessWord,
          walletAddress: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send guess to backend.");
      }

      const result = await response.json();
      console.log("Backend Response:", result);
      if(result.similarity == 1){
        setFeedback(`Congratulations! Player ${walletAddress} has won the prize!`);
      }
      //log update
      const newLog = {
        player: walletAddress,
        guess: guessWord,
        similarity: result.similarity || 0,
        proximity: result.proximity || "far",
      };
      
      setGameLogs((prevLogs) => {
        const updatedLogs = [newLog, ...prevLogs];
        localStorage.setItem("gameLogs", JSON.stringify(updatedLogs));
        return updatedLogs;
      });
    } catch (error) {
      console.error("Error sending guess to backend:", error);
      setFeedback("Failed to send guess to backend.");
    }
  };




  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await fetchGameState();
        await fetchGameLogs();
      } catch (error) {
        console.error("Error updating game data:", error);
      }
    }, 0.001); 
  
    return () => clearInterval(interval);
  }, [gameEnded, walletAddress]);
  

  return (
    <div
      style={{
        backgroundColor: "#0C0C0C", 
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "'Cinzel', serif", 
        color: "#FFD700",
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #FFD700", 
          paddingBottom: "10px",
        }}
      >
        <h1 style={{ fontSize: "36px", margin: 0, textShadow: "0 0 10px #FFD700" }}>
          Word Guessing Game
        </h1>
        <div>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #FFD700, #FF4500)", 
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "18px", 
                boxShadow: "0 0 10px #FF4500",
              }}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={disconnectWallet}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #FF4500, #FF6347)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "18px", 
                boxShadow: "0 0 10px #FF4500",
              }}
            >
              Disconnect Wallet
            </button>
          )}
        </div>
      </header>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "28px",
            color: gameEnded ? "#FF4500" : "#00FF00",
            textShadow: "0 0 10px #FFD700",
          }}
        >
          {gameEnded ? "Game Over" : "Game in Progress"}
        </h2>
      </div>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "40px",
            color: "#FFD700",
            textShadow: "0 0 15px #FFD700",
          }}
        >
          Prize Pool: {prizePool} ETH
        </h2>
      </div>
  

      <div style={{ textAlign: "center" }}>
        <input
          type="text"
          value={userGuess}
          onChange={(e) => setUserGuess(e.target.value)}
          placeholder="Enter your guess"
          style={{
            padding: "15px",
            fontSize: "16px",
            width: "50%",
            border: "2px solid #FFD700", 
            borderRadius: "10px",
            backgroundColor: "#1A1A2E",
            color: "#FFD700",
            marginBottom: "10px",
            outline: "none", 
          }}
          onFocus={(e) => (e.target.style.border = "2px solid #FFD700")} // 포커스 시 테두리 흰색으로 변경 -> 취소(구림)
          onBlur={(e) => (e.target.style.border = "2px solid #FFD700")} // 포커스 해제 시 금색으로 복구
        />
        <br />
        <button
          onClick={handleSubmitGuess}
          style={{
            padding: "10px 25px",
            background: walletAddress
            ? "linear-gradient(90deg, #FFD700, #FF4500)"
            : "#555555", // 지갑 미연결 시 회색
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "18px", 
            boxShadow: "0 0 10px #FFD700",
          }}
        >
          Submit Guess
        </button>
      </div>
  
      {/* 피드백 메시지 */}
      {feedback && (
        <p
          style={{
            textAlign: "center",
            marginTop: "10px",
            color: "#FF4500",
            fontWeight: "bold",
            textShadow: "0 0 5px #FF6347",
          }}
        >
          {feedback}
        </p>
      )}
  
      {/* 게임 로그 */}
      <div style={{ marginTop: "30px" }}>
        <h3 style={{ color: "#FFD700", textShadow: "0 0 10px #FFD700" }}>
          Game Logs
        </h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {gameLogs.map((log, idx) => (
            <li
              key={idx}
              style={{
                backgroundColor: "#1A1A2E",
                color: "#FFD700",
                marginBottom: "10px",
                padding: "15px",
                borderRadius: "10px",
                boxShadow: "0 0 10px #FFD700",
                border: "1px solid #FFD700",
              }}
            >
              <strong>Player:</strong> {log.player} | <strong>Guess:</strong>{" "}
              {log.guess} | <strong>Similarity:</strong> {log.similarity} |{" "}
              <strong>Proximity:</strong>{isNaN(Number(log.proximity)) ? log.proximity : `${log.proximity}/1000`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
  
};
