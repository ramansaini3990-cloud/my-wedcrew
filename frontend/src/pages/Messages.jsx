import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Messages = () => {
  const location = useLocation();
  const { user, token } = useContext(AuthContext);
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const messagesEndRef = useRef(null);
  const [initialSelectDone, setInitialSelectDone] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !initialSelectDone) {
      const activeId = location.state?.activeConversationId;
      if (activeId) {
        const convToSelect = conversations.find(c => c.id === activeId || c._id === activeId);
        if (convToSelect) {
          selectConversation(convToSelect);
        }
      }
      setInitialSelectDone(true);
    }
  }, [conversations, initialSelectDone, location.state]);

  useEffect(() => {
    if (socket) {
      socket.on('receive_message', (message) => {
        const msgConvId = String(message.conversation_id || message.conversationId);
        const activeConvId = String(activeConv?._id || activeConv?.id);
        
        if (activeConv && msgConvId === activeConvId) {
          setMessages(prev => {
            if (prev.find(m => (m._id || m.id) === (message._id || message.id))) return prev;
            return [...prev, message];
          });
          scrollToBottom();
        }
        fetchConversations();
      });

      socket.on('error', (err) => {
        setError(err);
      });

      return () => {
        socket.off('receive_message');
        socket.off('error');
      };
    }
  }, [socket, activeConv]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const getValidId = (obj) => {
        if (!obj) return null;
        if (typeof obj === 'string') return obj;
        if (typeof obj === 'object') return String(obj._id || obj.id || '');
        return String(obj);
      };

      const userIdStr = String(user.id || user._id);
      
      // Deduplicate based on the other user's ID
      const uniqueChatsMap = new Map();
      
      res.data.forEach(conv => {
        const companyId = getValidId(conv.company_id);
        const freelancerId = getValidId(conv.freelancer_id);
        
        let otherUserId = null;
        if (companyId === userIdStr) {
          otherUserId = freelancerId;
        } else {
          otherUserId = companyId;
        }

        // Only add if we haven't seen this user, OR if this conversation has a newer last_message_at
        if (otherUserId) {
          if (!uniqueChatsMap.has(otherUserId)) {
            uniqueChatsMap.set(otherUserId, conv);
          } else {
            const existingConv = uniqueChatsMap.get(otherUserId);
            const existingDate = existingConv.last_message_at ? new Date(existingConv.last_message_at) : new Date(0);
            const newDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(0);
            if (newDate > existingDate) {
               uniqueChatsMap.set(otherUserId, conv);
            }
          }
        }
      });

      setConversations(Array.from(uniqueChatsMap.values()));
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403 && err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setIsLocked(true);
      } else {
        setError('Failed to load conversations.');
      }
    }
  };

  const selectConversation = async (conv) => {
    setIsLocked(false);
    setActiveConv(conv);
    const convId = conv.id || conv._id;
    if (socket) {
      socket.emit('join_conversation', convId);
    }
    try {
      const res = await axios.get(`http://localhost:5000/api/chat/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403 && err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setIsLocked(true);
      }
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || !socket) return;

    const convId = activeConv.id || activeConv._id;
    
    const getValidId = (obj) => {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'object') {
        const id = obj._id || obj.id;
        if (id) return String(id);
      }
      return String(obj);
    };

    let receiverId = null;
    const userIdStr = getValidId(user);
    const companyIdStr = getValidId(activeConv.company_id);
    
    if (companyIdStr === userIdStr) {
      receiverId = getValidId(activeConv.freelancer_id);
    } else {
      receiverId = getValidId(activeConv.company_id);
    }

    if (!receiverId || typeof receiverId !== 'string') {
       setError('Failed to identify message receiver.');
       return;
    }
    
    socket.emit('send_message', {
      conversationId: convId,
      text: newMessage,
      message: newMessage,
      receiverId: receiverId
    }, (response) => {
      if (response && response.error) {
        setError(response.error);
      } else if (response && response.success && response.message) {
        setMessages(prev => {
          if (prev.find(m => (m._id || m.id) === (response.message._id || response.message.id))) return prev;
          return [...prev, response.message];
        });
        scrollToBottom();
        fetchConversations();
      }
    });

    setNewMessage('');
  };

  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  return (
    <div className="bg-brand-bg pt-[90px] pb-6 px-4 flex justify-center items-start" style={{ height: '100vh' }}>
      <div className="w-full max-w-[1200px] h-full flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-[320px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col hidden md:flex">
          <div className="h-[60px] px-4 flex items-center border-b border-gray-100 bg-brand-surface">
            <h2 className="text-lg font-bold text-brand-navy">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <p className="p-4 text-brand-textSec text-sm text-center">No conversations yet.</p>
            ) : (
              conversations.map(conv => {
                const convId = conv.id || conv._id;
                let otherUser = {};
                const extractId = (obj) => {
                  if (!obj) return null;
                  if (typeof obj === 'object') return String(obj._id || obj.id || '');
                  return String(obj);
                };
                const userIdStr = String(user.id || user._id);
                const companyIdStr = extractId(conv.company_id);
                if (companyIdStr === userIdStr) {
                  otherUser = typeof conv.freelancer_id === 'object' ? conv.freelancer_id : { name: 'Freelancer' };
                } else {
                  otherUser = typeof conv.company_id === 'object' ? conv.company_id : { name: 'Company' };
                }

                const isActive = (activeConv?.id || activeConv?._id) === convId;

                return (
                  <div 
                    key={convId} 
                    onClick={() => selectConversation(conv)}
                    className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${isActive ? 'bg-brand-primary/5 border-l-4 border-l-brand-primary' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-sm uppercase flex-shrink-0">
                        {(otherUser.name || otherUser.company_name || 'U').charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-brand-navy text-[15px] truncate">
                          {otherUser.name || otherUser.company_name || 'Unknown'}
                        </div>
                        <div className="text-[13px] text-brand-textSec truncate mt-0.5">
                          {conv.last_message?.message || conv.last_message?.text || 'No messages'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#F9FAFB] relative min-w-0">
          {isLocked ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-brand-navy mb-2">Messages Locked</h3>
              <p className="text-brand-textSec text-center max-w-md mb-6">
                An active subscription is required for both users to access chat.
              </p>
              <button 
                onClick={() => window.location.href = '/pricing'}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-full font-medium hover:bg-brand-primaryLight transition-all shadow-sm"
              >
                View Plans / Subscribe
              </button>
            </div>
          ) : activeConv ? (
            <>
              {/* Chat Header */}
              <div className="h-[60px] px-6 border-b border-gray-200 bg-white flex items-center shadow-sm z-10 flex-shrink-0">
                {(() => {
                  let otherUser = {};
                  const extractId = (obj) => {
                    if (!obj) return null;
                    if (typeof obj === 'object') return String(obj._id || obj.id || '');
                    return String(obj);
                  };
                  const userIdStr = String(user.id || user._id);
                  const companyIdStr = extractId(activeConv.company_id);
                  if (companyIdStr === userIdStr) {
                    otherUser = typeof activeConv.freelancer_id === 'object' ? activeConv.freelancer_id : { name: 'Freelancer' };
                  } else {
                    otherUser = typeof activeConv.company_id === 'object' ? activeConv.company_id : { name: 'Company' };
                  }
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-xs uppercase">
                        {(otherUser.name || otherUser.company_name || 'U').charAt(0)}
                      </div>
                      <span className="font-bold text-[16px] text-brand-navy">
                        {otherUser.name || otherUser.company_name || 'Chat'}
                      </span>
                    </div>
                  );
                })()}
              </div>
              
              {/* Message List */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4"
              >
                {messages.map((msg, index) => {
                  const msgId = msg.id || msg._id || index;
                  const senderId = msg.sender_id || msg.senderId;
                  const isMine = String(senderId) === String(user.id || user._id);
                  return (
                    <div key={msgId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[75%] md:max-w-[65%] text-[15px] leading-relaxed shadow-sm ${
                        isMine 
                          ? 'bg-brand-primary text-white rounded-br-sm' 
                          : 'bg-white border border-gray-100 text-brand-navy rounded-bl-sm'
                      }`}>
                        {msg.message || msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Error Banner */}
              {error && (
                <div className="px-4 py-2 bg-red-50 text-brand-danger text-sm text-center border-t border-red-100 flex-shrink-0">
                  {error}
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex gap-3 items-end max-w-4xl mx-auto">
                  <textarea 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-white border border-[#e0e0e0] rounded-[24px] px-[18px] py-[12px] focus:outline-none focus:border-brand-primary focus:ring-0 shadow-none resize-none text-[15px] text-brand-navy max-h-[120px] custom-scrollbar"
                    rows="1"
                    disabled={!!error}
                  />
                  <button 
                    type="submit"
                    disabled={!!error || !newMessage.trim()}
                    className="h-[48px] px-6 bg-brand-primary text-white rounded-full hover:bg-brand-primaryLight disabled:opacity-50 font-medium transition-colors shadow-sm flex items-center justify-center flex-shrink-0"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-brand-textSec bg-[#F9FAFB]">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-gray-100">
                <svg className="w-8 h-8 text-brand-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="font-medium text-[15px]">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
