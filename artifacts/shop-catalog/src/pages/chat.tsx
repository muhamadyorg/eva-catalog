import { useEffect, useState } from "react";
import { ChatWindow, ChatMessage } from "@/components/chat-window";
import { useAuth } from "@/components/auth-provider";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function UserChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/chat/my/messages`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { conversation: { id: number }; messages: ChatMessage[] };
          setConversationId(data.conversation.id);
          setMessages(data.messages);
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function handleSend(data: FormData | { content: string }): Promise<Response> {
    if (data instanceof FormData) {
      return fetch(`${BASE_URL}/api/chat/my/messages`, {
        method: "POST",
        credentials: "include",
        body: data,
      });
    }
    return fetch(`${BASE_URL}/api/chat/my/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async function handleEdit(id: number, content: string) {
    await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  async function handleDelete(id: number) {
    await fetch(`${BASE_URL}/api/chat/messages/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
  }

  return (
    <div className="h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-border overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h1 className="font-semibold text-sm">Qo'llab-quvvatlash xizmati</h1>
        <p className="text-xs text-muted-foreground">Savollaringizni yuboring — tez orada javob beramiz</p>
      </div>
      {conversationId ? (
        <ChatWindow
          conversationId={conversationId}
          messages={messages}
          onSend={handleSend}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
          recipientName="Qo'llab-quvvatlash"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {isLoading ? "Yuklanmoqda..." : "Chat yuklanmadi"}
        </div>
      )}
    </div>
  );
}
