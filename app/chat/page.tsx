'use client'

import { useChat } from 'ai/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import React from 'react'

export default function ChatPage() {
  const supabase = createClient()
  const [authHeader, setAuthHeader] = useState<string>('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

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
          content: '',
          timestamp: new Date().toISOString()
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

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    if (isAtBottom.current) {
      scrollToBottom()
    }
  }, [messages])

  // Add scroll listener to track if we're at bottom
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollContainer) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      isAtBottom.current = Math.abs(scrollHeight - clientHeight - scrollTop) < 10
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] w-4/5 mx-auto">
      <Card className="w-full">
        <div className="flex h-full flex-col">
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
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
                    className={`rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap ${
                      message.role === 'assistant'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {message.content.split('\n').map((line, index, array) => (
                      <React.Fragment key={index}>
                        {line}
                        {index < array.length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
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