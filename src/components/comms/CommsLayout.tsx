"use client";

import { useState } from "react";
import ConversationSidebar from "./ConversationSidebar";
import ConversationView from "./ConversationView";

interface CommsLayoutProps {
  initialFilter?: string;
}

export default function CommsLayout({ initialFilter }: CommsLayoutProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div
        className={`w-80 flex-shrink-0 border-r border-border flex flex-col ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationSidebar
          onSelectConversation={setActiveConversationId}
          activeConversationId={activeConversationId}
          initialFilter={initialFilter}
        />
      </div>

      {/* Right panel */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${
          !activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConversationId ? (
          <ConversationView
            conversationId={activeConversationId}
            onBack={() => setActiveConversationId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <p className="text-sm">Select a conversation</p>
              <p className="text-xs mt-1 text-text-dim">
                or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
