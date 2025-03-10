'use client'

import { useChat } from 'ai/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ChatPage() {
  const supabase = createClient()
  const [authHeader, setAuthHeader] = useState<string>('')

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setAuthHeader(`Bearer ${session.access_token}`)
      }
    }
    getSession()
  }, [supabase.auth])

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    headers: {
      'Authorization': authHeader
    },
    onResponse: (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      // Create initial assistant message
      setMessages(current => [
        ...current,
        {
          id: current.length.toString(),
          role: 'assistant',
          content: ''
        }
      ]);

      const decoder = new TextDecoder();
      const readChunks = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n').filter(Boolean);
            
            for (const line of lines) {
              if (line.startsWith('0:')) {
                const jsonStr = line.slice(2);
                try {
                  const parsed = JSON.parse(jsonStr);
                  
                  // Update the last message with new content
                  setMessages(current => {
                    const lastMessage = current[current.length - 1];
                    if (lastMessage?.role === 'assistant') {
                      return [
                        ...current.slice(0, -1),
                        {
                          ...lastMessage,
                          content: lastMessage.content + parsed.content
                        }
                      ];
                    }
                    return current;
                  });
                } catch (e) {
                  console.error('Failed to parse JSON:', jsonStr);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error reading stream:', error);
        }
      };

      readChunks();
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24">
      <Card className="w-full max-w-4xl">
        <div className="flex h-[80vh] flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={`flex ${
                    message.role === 'assistant'
                      ? 'justify-start'
                      : 'justify-end'
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.role === 'assistant'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t p-4 w-full"
          >
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
} 