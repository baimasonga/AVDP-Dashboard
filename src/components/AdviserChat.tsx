import React, { useState } from "react";
import { askAdvisor } from "../lib/db";
import { MessageSquare, Calendar, Sparkles, Send, Bot, AlertTriangle, ShieldCheck, User } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

interface AdviserChatProps {
  currentDistrict: string | null;
  activeCommodity: string;
  isLowBandwidth: boolean;
}

export default function AdviserChat({
  currentDistrict,
  activeCommodity,
  isLowBandwidth
}: AdviserChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      sender: "bot",
      text: `### AVDP Intelligent Policy Adviser

Welcome to the decision support terminal. I am configured with the real-time operational database for the Agriculture Value Chain Development Project (AVDP) in Sierra Leone.

**Active filter context in current workspace:**
* Regional District Target: \`${currentDistrict || "All Sierra Leone"}\`
* Commodity Crop Focus: \`${activeCommodity || "All Crops"}\`

Select one of the query prompt ideas below, or formulate a customized question. I will generate actionable strategy plans using server-cached regional parameters.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const promptIdeas = [
    {
      label: "Crop Yield Strategy",
      text: `Propose a localized crop yield enhancement plan for smallholder ${activeCommodity !== "All" ? activeCommodity : "Rice"} farmers in ${currentDistrict || "Kailahun/Kenema"} districts.`
    },
    {
      label: "Logistics & Roads Solutions",
      text: "How does climate-resilient road rehabilitation affect agricultural yields and export logistics in low-lying Southern districts?"
    },
    {
      label: "Swamp Irrigation & Rice",
      text: "What sustainable crop fertilization and Inland Valley Swamps (IVS) water methods can mitigate low baseline Rice yields during transition seasons?"
    }
  ];

  const handlePostQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    // Add user message to UI
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion("");
    setIsLoading(true);

    try {
      const text = await askAdvisor({
        question: queryText,
        currentDistrict: currentDistrict || undefined,
        activeCommodity: activeCommodity !== "All" ? activeCommodity : undefined,
      });

      const botMsg: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: "bot",
        text: text || "I was unable to assess strategy indices at this moment. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const botErrMsg: Message = {
        id: `msg-bot-err-${Date.now()}`,
        sender: "bot",
        text: `### ⚠️ Strategic Engine Interruption
        
The advisor system encountered a connection difficulty. Please verify that your Gemini API Key is configured in **Settings > Secrets** panel.
        
*System details: ${err.message || "Endpoint Timeout."}*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botErrMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm relative flex flex-col justify-between" id="ai-advisor-container">
      
      {/* Bot Chat Header */}
      <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            AVDP Smart Decision-Support AI Adviser
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Query deep analytics from live agricultural summaries. Supported by server-side Gemini.
          </p>
        </div>
        <div className="text-[10px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Offline Cache Included
        </div>
      </div>

      {/* Messages Scrollbox */}
      <div className="h-72 overflow-y-auto mb-4 bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 space-y-4 font-mono text-xs pr-1">
        {messages.map((m) => (
          <div 
            key={m.id}
            className={`flex flex-col ${
              m.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Header sender label */}
            <span className="text-[9px] text-slate-500 font-bold mb-1 tracking-wider uppercase flex items-center gap-1">
              {m.sender === "user" ? (
                <>
                  <User className="w-2.5 h-2.5" /> STAKEHOLDER
                </>
              ) : (
                <>
                  <Bot className="w-2.5 h-2.5 text-emerald-400" /> GEMINI PREDICTIVE ADVISER
                </>
              )}
              &bull; {m.timestamp}
            </span>

            {/* Bubble layout */}
            <div 
              className={`p-3 rounded-xl max-w-sm md:max-w-md border leading-relaxed break-words whitespace-pre-wrap ${
                m.sender === "user" 
                  ? "bg-slate-900 border-slate-700/60 text-slate-100" 
                  : m.text.includes("⚠️")
                    ? "bg-red-950/20 border-red-500/30 text-slate-200"
                    : "bg-[#090d16]/80 border-slate-800 text-slate-300"
              }`}
            >
              {/* Highlight bullet paragraphs briefly */}
              {m.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 animate-pulse text-[11px] font-mono pl-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Gemini evaluating historical crop indexes and compiling reports...
          </div>
        )}
      </div>

      {/* Quick Prompts options */}
      <div className="mt-2 mb-4">
        <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-2 font-semibold">
          Recommended Query Directions
        </label>
        <div className="flex flex-wrap gap-2">
          {promptIdeas.map((idea, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePostQuery(idea.text)}
              disabled={isLoading}
              className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all text-left max-w-xs truncate cursor-pointer font-medium disabled:opacity-40"
            >
              &bull; {idea.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input container */}
      <div className="relative">
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handlePostQuery(inputQuestion); }}
          placeholder="Ask policy advisor: Propose a road rehab outcome..."
          disabled={isLoading}
          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-3 pl-4 pr-12 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 font-mono"
        />
        <button
          onClick={() => handlePostQuery(inputQuestion)}
          disabled={isLoading || !inputQuestion.trim()}
          className="absolute right-2 top-2 p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/30 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
